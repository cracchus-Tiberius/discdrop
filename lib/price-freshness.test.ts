import test from 'node:test';
import assert from 'node:assert';
import { isEntryCurrent, MAX_PRICE_AGE_DAYS } from './price-freshness.ts';

const REF = new Date('2026-10-20T04:00:00.000Z').getTime();
const daysBefore = (n: number) =>
  new Date(REF - n * 86_400_000).toISOString();

test('an entry scraped this morning is current', () => {
  assert.strictEqual(isEntryCurrent({ lastScraped: daysBefore(0) }, REF), true);
});

test('an entry a day old is current — one missed run must not blank a store', () => {
  assert.strictEqual(isEntryCurrent({ lastScraped: daysBefore(1) }, REF), true);
});

test('an entry exactly at the cutoff is still current', () => {
  assert.strictEqual(
    isEntryCurrent({ lastScraped: daysBefore(MAX_PRICE_AGE_DAYS) }, REF),
    true
  );
});

test('an entry past the cutoff is not current', () => {
  assert.strictEqual(
    isEntryCurrent({ lastScraped: daysBefore(MAX_PRICE_AGE_DAYS + 1) }, REF),
    false
  );
});

test('the Discsport case: 42 days stale is not current', () => {
  // The entries that sat on the live site as though scraped that morning.
  assert.strictEqual(
    isEntryCurrent({ lastScraped: '2026-09-08T07:19:27.485Z' }, REF),
    false
  );
});

test('a missing lastScraped means unknown, not old — keep the entry', () => {
  assert.strictEqual(isEntryCurrent({}, REF), true);
});

test('an unparseable lastScraped is kept rather than silently dropped', () => {
  assert.strictEqual(isEntryCurrent({ lastScraped: 'not a date' }, REF), true);
});
