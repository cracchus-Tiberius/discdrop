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
  return `Write a 2-3 sentence disc golf disc description in Norwegian Bokmål for the ${disc.brand} ${disc.name}. Flight numbers: Speed ${disc.flight.speed}, Glide ${disc.flight.glide}, Turn ${disc.flight.turn}, Fade ${disc.flight.fade}. Type: ${typeLabel}. Keep it practical and friendly — what player suits it and what is it known for? Do not state a numeric speed/glide/turn/fade value anywhere in the text other than the exact ones given above — if you reference a flight number, it must match exactly. Only mention a specific plastic type by name if you are confident it is a real, commonly available plastic for this exact disc; if unsure, use a generic phrase like "ulike plasttyper" instead of inventing one. Answer in plain text only, no quotes.`;
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

async function generateOne(client, disc, attempt = 1) {
  let text;
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: buildPrompt(disc) }],
    });
    text = msg.content[0]?.text?.trim() ?? '';
  } catch (err) {
    if (attempt < 3 && err.status === 429) {
      console.log(`  ↻ Rate limited on ${disc.brand} ${disc.name} — waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/3`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return generateOne(client, disc, attempt + 1);
    }
    throw err;
  }

  if (text && hasSpeedMismatch(text, disc.flight.speed) && attempt < 3) {
    console.log(`  ↻ Speed mismatch in generated text for ${disc.brand} ${disc.name} (real speed ${disc.flight.speed}) — retry ${attempt + 1}/3`);
    return generateOne(client, disc, attempt + 1);
  }
  if (text && hasSpeedMismatch(text, disc.flight.speed)) {
    console.warn(`  ⚠ Giving up after 3 attempts — ${disc.brand} ${disc.name} still has a speed mismatch, saving anyway (needs manual review)`);
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
