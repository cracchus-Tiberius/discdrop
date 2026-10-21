'use strict';

// Offline tests for Discace's API retry. The scenario they encode is the
// 2026-10-20 run: one network timeout on page 1 took the store out for the
// whole day, because this was the one WooCommerce scraper without the retry
// that scraper.js, frisbeebutikken and starframe all got on 2026-08-22.

const test = require('node:test');
const assert = require('node:assert');
const { fetchApiPageWithRetry } = require('./scrape-discace.js');

const URL = 'https://discaceofsweden.com/wp-json/wc/store/v1/products?per_page=100&page=1';

// No real waiting, and it records that a backoff happened at all.
const stubSleep = (recorder) => (ms) => { recorder.push(ms); return Promise.resolve(); };

const ok = (body = [{ id: 1 }], headers = { 'x-wp-totalpages': '2' }) => ({
  ok: true,
  status: 200,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});

test('a first-attempt network timeout recovers on the retry', async () => {
  // Exactly the 2026-10-20 failure: "request failed: network timeout".
  const slept = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) throw new Error('network timeout at: ' + URL);
    return ok();
  };

  const result = await fetchApiPageWithRetry(URL, { fetchImpl, sleepImpl: stubSleep(slept), backoffMs: 5000 });

  assert.ok(result, 'should have recovered rather than returning null');
  assert.deepStrictEqual(result.data, [{ id: 1 }]);
  assert.strictEqual(calls, 2);
  assert.deepStrictEqual(slept, [5000]);
});

test('the response is returned, not just the body — x-wp-totalpages drives pagination', async () => {
  // Without the headers the loop cannot know there is a page 2, which is how
  // this store silently truncated to page 1 once before (see the baseUrl note).
  const result = await fetchApiPageWithRetry(URL, { fetchImpl: async () => ok(), sleepImpl: stubSleep([]) });
  assert.strictEqual(result.res.headers.get('x-wp-totalpages'), '2');
});

test('it gives up after three attempts and reports null', async () => {
  const slept = [];
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('network timeout'); };

  const result = await fetchApiPageWithRetry(URL, { fetchImpl, sleepImpl: stubSleep(slept) });

  assert.strictEqual(result, null);
  assert.strictEqual(calls, 3);
  assert.strictEqual(slept.length, 2, 'backs off between attempts, not after the last');
});

test('a 5xx is treated as transient and retried', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503, headers: { get: () => null } };
    return ok();
  };

  const result = await fetchApiPageWithRetry(URL, { fetchImpl, sleepImpl: stubSleep([]) });

  assert.ok(result);
  assert.strictEqual(calls, 2);
});

test('a 4xx is not retried — it will say the same thing three times', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 404, headers: { get: () => null } }; };

  const result = await fetchApiPageWithRetry(URL, { fetchImpl, sleepImpl: stubSleep([]) });

  assert.strictEqual(result, null);
  assert.strictEqual(calls, 1);
});

test('a truncated body is retried like any other transient', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('Unexpected end of JSON input'); } };
    return ok();
  };

  const result = await fetchApiPageWithRetry(URL, { fetchImpl, sleepImpl: stubSleep([]) });

  assert.ok(result);
  assert.strictEqual(calls, 2);
});
