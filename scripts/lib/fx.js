'use strict';

// scripts/lib/fx.js — the SEK->NOK rate, fetched once and recorded.
//
// Four scrapers each carried their own copy of this: discsport, discace and
// ugglans fell back to 1.03, discexpress to 1.00. On 2026-09-05 the real rate
// was 0.9724, so the 1.03 fallback overstated every Swedish price by about 6%
// — in the stores' favour, on a site whose whole job is telling you which
// store is cheapest. The comment claiming "~1:1" was true when it was written;
// the krone moved and nobody went back.
//
// A fallback that is a guess ages badly and silently. This one is a dated
// observation, and it says so, so the next person can see how stale it is.
//
// The rate is also returned for recording alongside the prices. Without it,
// a Swedish store's price moving from 199 to 205 kr is indistinguishable from
// the krone moving — which is precisely the currency-drift question the /nytt
// launch checklist has open in CLAUDE.md.

const fetch = require('node-fetch');

const API = 'https://open.er-api.com/v6/latest/SEK';

// Observed 2026-09-05 via the API above. Used only when the API is
// unreachable. Update it, with the date, whenever you notice it has drifted.
const FALLBACK_SEK_NOK = 0.97;
const FALLBACK_OBSERVED_AT = '2026-09-05';

// A rate outside this band is far likelier to be a broken response or a wrong
// base currency than a real move — SEK/NOK has sat between roughly 0.9 and 1.1
// for years. Taking a garbage rate is how the Discexpress USD-as-SEK incident
// turned real prices into fiction.
const MIN_PLAUSIBLE = 0.6;
const MAX_PLAUSIBLE = 1.6;

/**
 * @returns {Promise<{rate:number, source:string, fetchedAt:string}>}
 *   source is 'live' or 'fallback', so a caller can tell a real rate from a
 *   stand-in, and so it lands in the data as one or the other.
 */
async function fetchSekToNok() {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(API, { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.NOK;
    if (typeof rate !== 'number' || !(rate > 0)) throw new Error('no NOK rate in response');
    if (rate < MIN_PLAUSIBLE || rate > MAX_PLAUSIBLE) {
      throw new Error(`rate ${rate} outside the plausible ${MIN_PLAUSIBLE}-${MAX_PLAUSIBLE} band`);
    }
    console.log(`  SEK/NOK rate: ${rate.toFixed(4)} (live)`);
    return { rate, source: 'live', fetchedAt };
  } catch (err) {
    console.log(
      `  ⚠ Could not fetch a live SEK/NOK rate (${err.message}) — falling back to ` +
      `${FALLBACK_SEK_NOK}, observed ${FALLBACK_OBSERVED_AT}. Prices from this run are ` +
      `approximate and the recorded fxRateSource says so.`
    );
    return { rate: FALLBACK_SEK_NOK, source: 'fallback', fetchedAt };
  }
}

/** Store meta fields recording what a run converted with. */
function fxMeta({ rate, source, fetchedAt }) {
  return { fxRate: Number(rate.toFixed(4)), fxRateSource: source, fxRateAt: fetchedAt };
}

module.exports = {
  fetchSekToNok,
  fxMeta,
  FALLBACK_SEK_NOK,
  FALLBACK_OBSERVED_AT,
  MIN_PLAUSIBLE,
  MAX_PLAUSIBLE,
};
