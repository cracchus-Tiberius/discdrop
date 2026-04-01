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
  return `Write a 2-3 sentence disc golf disc description in Norwegian Bokmål for the ${disc.brand} ${disc.name}. Flight numbers: Speed ${disc.flight.speed}, Glide ${disc.flight.glide}, Turn ${disc.flight.turn}, Fade ${disc.flight.fade}. Type: ${typeLabel}. Keep it practical and friendly — what player suits it and what is it known for? If there are notable plastic types worth mentioning, include that briefly. Answer in plain text only, no quotes.`;
}

async function generateOne(client, disc, attempt = 1) {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: buildPrompt(disc) }],
    });
    return msg.content[0]?.text?.trim() ?? '';
  } catch (err) {
    if (attempt < 3 && err.status === 429) {
      console.log(`  ↻ Rate limited on ${disc.brand} ${disc.name} — waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/3`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return generateOne(client, disc, attempt + 1);
    }
    throw err;
  }
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
