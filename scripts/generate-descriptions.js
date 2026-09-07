// scripts/generate-descriptions.js
// Generates Norwegian disc descriptions via Anthropic API (Haiku)
// Usage: node scripts/generate-descriptions.js
// Resumable: skips discs already in disc-descriptions.json
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// discs.js uses ES module syntax — strip export keywords for CommonJS execution
const discsPath = path.join(__dirname, '..', 'data', 'discs.js');
const discsRaw = fs.readFileSync(discsPath, 'utf8').replace(/\bexport\s+(const|function|class)\b/g, '$1');
const discsCode = discsRaw + '\nmodule.exports = { discs };';
const discsModule = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('module', 'exports', 'require', '__dirname', '__filename', discsCode)(
  discsModule, discsModule.exports, require, __dirname, __filename
);
const discs = discsModule.exports.discs;

const OUT_PATH = path.join(__dirname, '..', 'data', 'disc-descriptions.json');
// Haiku's Norwegian is not good enough for text that ships as the only prose
// on a page. Its 2026-09-06 batch produced Cyrillic characters mid-word
// ("консистente"), a missing space ("er enDistance Driver"), Swedish and
// Danish loanwords ("golfare", "pålidelig", "lettkastad") and several invented
// ones ("veirvindinger", "flyfoto" for flight, "vielsiddig"). The checks below
// catch the mechanical faults; the rest is a model問題, so use a better one.
// 700 short descriptions is a trivial amount of work to pay properly for.
const MODEL = 'claude-sonnet-5';
// A model that thinks first spends part of its budget before writing a word.
// At 256 six of 59 descriptions came back cut off mid-sentence ("Disken
// finnes") and were saved that way.
const MAX_TOKENS = 900;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 15000;
const RETRY_DELAY_MS = 30000;

function loadExisting() {
  if (fs.existsSync(OUT_PATH)) {
    try { return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch {}
  }
  return {};
}

function save(descriptions) {
  fs.writeFileSync(OUT_PATH, JSON.stringify(descriptions, null, 2));
}

function buildPrompt(disc) {
  const typeLabel = { driver: 'driver', fairway: 'fairway driver', midrange: 'midrange', putter: 'putter' }[disc.type] ?? disc.type;
  return `Write a 2-3 sentence disc golf disc description in Norwegian Bokmål for the ${disc.brand} ${disc.name}. Flight numbers: Speed ${disc.flight.speed}, Glide ${disc.flight.glide}, Turn ${disc.flight.turn}, Fade ${disc.flight.fade}. Type: ${typeLabel}. Keep it practical and friendly — what player suits it and what is it known for? If you describe the flight path by direction, use the standard convention for a RIGHT-HANDED BACKHAND thrower: negative turn means the disc turns to the RIGHT early in the flight, and fade means it finishes to the LEFT. Getting this backwards is worse than not mentioning direction at all, so leave direction out if you are unsure. Do not call a turn of -2 or more \"minimal\" or a fade of 3 or more \"mild\" — describe the numbers you were given, not a disc you are thinking of. Do not state a numeric speed/glide/turn/fade value anywhere in the text other than the exact ones given above — if you reference a flight number, it must match exactly. Only mention a specific plastic type by name if you are confident it is a real, commonly available plastic for this exact disc; if unsure, use a generic phrase like "ulike plasttyper" instead of inventing one. Write natural, idiomatic Norwegian Bokmål — no Swedish or Danish words, no English words, and no invented compounds. Write "disk"/"disken"/"disker" — never the English "disc" — except inside a proper noun: a brand name such as Dynamic Discs, Clash Discs or Disc Golf, or the mold name itself. Always write the mold name exactly as given above — Innova\'s "Power Disc" is spelled Disc, and shortening it to "Power" to satisfy this rule is wrong. Answer in plain text only, no quotes.`;
}

// Confirmed in production 2026-08-21: the model (even given the correct
// flight numbers in the prompt) sometimes hallucinates a DIFFERENT speed
// number in the generated prose — e.g. told Speed 6, wrote "speed 10" in the
// description. 26 of 660 existing descriptions (~4%) had this exact bug,
// several badly (a real speed-4 putter described as speed 9-10). Catch it
// before saving: scan for any "speed N" mention and reject if it doesn't
// match the real value within a small tolerance (rounding/half-step language
// like "rundt 9" is fine; a flatly different number is not).
function hasSpeedMismatch(text, realSpeed) {
  const matches = [...text.matchAll(/speed\s*(?:på\s*)?(\d+(?:[.,]\d+)?)/gi)];
  return matches.some((m) => Math.abs(parseFloat(m[1].replace(',', '.')) - realSpeed) > 0.6);
}

// The project writes Norwegian Bokmål and spells it "disk", never the English
// "disc" — that rule is in CLAUDE.md and it is visible on every disc page.
// The model ignores it about as often as it obeys: on 2026-09-06 nineteen of
// the first twenty regenerated descriptions said "en pålitelig disc". Brand
// names are the exception (Dynamic Discs, Clash Discs, Disc Golf), so strip
// those before looking.
function hasEnglishDiscWord(text, disc) {
  return /\bdisc(en|er|ene|s)?\b/i.test(withoutOwnNames(text, disc));
}

// Everything that is a proper noun on this particular disc: its brand, its
// mold name, and the sport's own spellings. Both the "disc" rule and the
// run-together rule have to look past these — Innova's Power Disc really is
// spelled Disc, and TeeDevil, RocX3, RhynoX and AviarX3 really do run two
// words together. Four of those tripped their own check on 2026-09-07.
function withoutOwnNames(text, disc) {
  let out = text;
  for (const phrase of [disc.brand, disc.name, 'Disc Golf', 'Discgolf', 'discgolf']) {
    if (phrase) out = out.split(phrase).join(' ');
  }
  return out;
}

// Anything outside Latin-1 plus the Norwegian letters is a decoding slip, not
// a word. Seen in production: "sin консистente flypath".
function hasForeignScript(text) {
  return /[^\u0000-\u024F\u2010-\u203A\s]/.test(text);
}

// "er enDistance Driver" — two words run together across a case boundary.
// Real Norwegian never does this; product names that legitimately do (GStar,
// McBeth) do not appear in generated prose.
function hasMissingSpace(text, disc) {
  return /[a-zæøå][A-ZÆØÅ]/.test(withoutOwnNames(text, disc));
}

// The model does not know every small manufacturer, and when it doesn't it
// reaches for one it does: Climo Disc Golf's Cliff came back as "Cliff fra
// Clash Discs". Wrong attribution is the exact failure this whole
// regeneration exists to undo, so never save one.
const OTHER_BRANDS = [...new Set(discs.map((d) => d.brand))];
function namesAnotherBrand(text, brand) {
  return OTHER_BRANDS.some(
    (b) => b !== brand && !brand.includes(b) && !b.includes(brand) &&
      new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
  );
}

// A description that stops mid-sentence is worse than none — it is the first
// thing a reader sees on the page.
function isTruncated(text) {
  return !/[.!?]["»)]?\s*$/.test(text);
}

// Claims about how much a disc turns or fades, checked against what it
// actually does. The generated corpus is full of "minimal turn" about discs
// rated -3 and "mild fade" about a fade of 4 — the numbers are quoted
// correctly right next to the sentence that contradicts them. Only flags the
// clear-cut cases; a -1 called "lett" is a matter of taste.
const LITTLE = /(minimal|minimale|lite|liten|litt|svak|svakt|knapt noe|nesten ingen)\s+(\w+\s+){0,2}/;
function overstatesFlight(text, flight) {
  const claims = (word, value, littleAbove, muchBelow) => {
    const re = new RegExp(LITTLE.source + word, 'i');
    if (re.test(text) && Math.abs(value) >= littleAbove) return true;
    return new RegExp(`(mye|stor|kraftig|betydelig)\\s+(\\w+\\s+){0,2}${word}`, 'i').test(text)
      && Math.abs(value) <= muchBelow;
  };
  if (flight.turn != null && claims('turn', flight.turn, 2, 0.5)) return 'turn';
  if (flight.fade != null && claims('fade', flight.fade, 3, 0.5)) return 'fade';
  return null;
}

async function generateOne(client, disc, attempt = 1) {
  let text;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(disc) }],
    });
    // Not content[0]: a model that thinks first puts a thinking block there,
    // and reading position zero blindly turned twelve good responses into
    // "Empty response" on 2026-09-06. Take the first actual text block.
    text = msg.content.find((b) => b.type === 'text')?.text?.trim() ?? '';
    // Soft hyphens and zero-width characters render as nothing, survive JSON
    // and split words for anything that indexes the page. One turned up in
    // "armfart" on 2026-09-06.
    text = text.replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '');
  } catch (err) {
    if (attempt < 3 && err.status === 429) {
      console.log(`  ↻ Rate limited on ${disc.brand} ${disc.name} — waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/3`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return generateOne(client, disc, attempt + 1);
    }
    throw err;
  }

  const overstated = text ? overstatesFlight(text, disc.flight) : null;
  if (overstated && attempt < 3) {
    console.log(`  ↻ Describes ${disc.brand} ${disc.name}'s ${overstated} as something its number is not — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && isTruncated(text) && attempt < 3) {
    console.log(`  ↻ Truncated text for ${disc.brand} ${disc.name} — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && namesAnotherBrand(text, disc.brand) && attempt < 3) {
    console.log(`  ↻ Named a different manufacturer for ${disc.brand} ${disc.name} — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasForeignScript(text) && attempt < 3) {
    console.log(`  ↻ Non-Latin characters in text for ${disc.brand} ${disc.name} — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasMissingSpace(text, disc) && attempt < 3) {
    console.log(`  ↻ Run-together words for ${disc.brand} ${disc.name} — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasEnglishDiscWord(text, disc) && attempt < 3) {
    console.log(`  ↻ Wrote "disc" instead of "disk" for ${disc.brand} ${disc.name} — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasSpeedMismatch(text, disc.flight.speed) && attempt < 3) {
    console.log(`  ↻ Speed mismatch in generated text for ${disc.brand} ${disc.name} (real speed ${disc.flight.speed}) — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasSpeedMismatch(text, disc.flight.speed)) {
    console.warn(`  ⚠ Giving up after 3 attempts — ${disc.brand} ${disc.name} still has a speed mismatch, saving anyway (needs manual review)`);
  }
  if (text && hasEnglishDiscWord(text, disc)) {
    console.warn(`  ⚠ Giving up after 3 attempts — ${disc.brand} ${disc.name} still says "disc", saving anyway (needs manual review)`);
  }
  if (text && namesAnotherBrand(text, disc.brand)) {
    console.warn(`  ⚠ Dropping ${disc.brand} ${disc.name} — still names another manufacturer after 3 attempts. Better no description than a wrong one.`);
    return '';
  }
  if (text && isTruncated(text)) {
    console.warn(`  ⚠ Dropping ${disc.brand} ${disc.name} — still truncated after 3 attempts.`);
    return '';
  }
  if (overstatesFlight(text, disc.flight)) {
    console.warn(`  ⚠ ${disc.brand} ${disc.name} still misdescribes its own flight numbers after 3 attempts (needs manual review)`);
  }
  if (text && (hasForeignScript(text) || hasMissingSpace(text, disc))) {
    console.warn(`  ⚠ Giving up after 3 attempts — ${disc.brand} ${disc.name} still has malformed text, saving anyway (needs manual review)`);
  }
  return text;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const descriptions = loadExisting();

  const todo = discs.filter(d => !descriptions[d.id]);
  const total = discs.length;
  const alreadyDone = total - todo.length;

  console.log(`disc-descriptions generator`);
  console.log(`Total discs: ${total} | Already done: ${alreadyDone} | To generate: ${todo.length}`);
  console.log('='.repeat(50));

  if (todo.length === 0) {
    console.log('Nothing to do — all descriptions already generated.');
    return;
  }

  let generated = 0;
  let errors = 0;

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (disc) => {
      try {
        const text = await generateOne(client, disc);
        if (text) {
          descriptions[disc.id] = text;
          generated++;
        } else {
          errors++;
          console.warn(`  ⚠ Empty response for ${disc.brand} ${disc.name}`);
        }
      } catch (err) {
        errors++;
        console.warn(`  ⚠ Error for ${disc.brand} ${disc.name}: ${err.message}`);
      }
    }));

    // Save after every batch so progress is never lost
    save(descriptions);

    const done = alreadyDone + generated;
    console.log(`Generated ${done}/${total} (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(todo.length / BATCH_SIZE)})`);

    if (i + BATCH_SIZE < todo.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log('='.repeat(50));
  console.log(`Done. Generated ${generated} new descriptions. Errors: ${errors}`);
  console.log(`Saved to ${OUT_PATH}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
