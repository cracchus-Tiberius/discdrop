// scripts/check-deploy-provenance.mjs — refuse to deploy over work this
// checkout does not have.
//
// Confirmed in production 2026-09-05. Two days of catalog work sat committed
// locally but unpushed. The 08:46 UTC cron scraped against the old catalog,
// committed, pushed and deployed — rolling the live site back to data that
// predated fifteen brand re-attributions and a whole new store. Nothing
// failed; the run was green. It was caught because someone happened to be
// watching, and fixing it was a race against the next cron.
//
// CI cannot see unpushed local commits — that is not knowable from inside a
// GitHub runner. So the question is asked the other way round: the live site
// says which commit it was built from, and this refuses to deploy if that
// commit is not in the history being deployed.
//
//   live sha is an ancestor of HEAD  -> normal. Deploy.
//   live sha is unknown to us        -> the site was deployed from somewhere
//                                       with commits we do not have. Refuse.
//   no version.json / unreachable    -> first run after this landed, or the
//                                       site is down. Warn, allow.
//   live build was dirty             -> deployed from an uncommitted tree, so
//                                       its sha does not identify it. Warn,
//                                       allow — a human did that deliberately.
//
// Fails open on everything except the one case it exists to catch, because a
// guard that blocks the daily deploy on its own hiccups is worse than the
// problem.
//
// Usage: node scripts/check-deploy-provenance.mjs [--url=https://discdrop.net]

import { execSync } from 'node:child_process';

const url = (process.argv.find((a) => a.startsWith('--url=')) || '--url=https://discdrop.net')
  .slice('--url='.length)
  .replace(/\/$/, '');

const warn = (msg) => console.log(`::warning title=Deploy provenance::${msg}`);

function haveCommit(sha) {
  try {
    execSync(`git cat-file -e ${sha}^{commit}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isAncestorOfHead(sha) {
  try {
    execSync(`git merge-base --is-ancestor ${sha} HEAD`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// A 404 and a 403 mean opposite things, and this check used to report both as
// "expected on the first deploy". On 2026-09-07 the runner got a 403 — the CDN
// challenging it, while the same URL served 200 from a laptop — and the log
// said the site had never been deployed. That is a false all-clear on the one
// signal this check exists to give, so the two cases are now separated and the
// blocked one says so out loud.
async function readLiveVersion() {
  const ATTEMPTS = 3;
  let lastStatus = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${url}/version.json`, {
        headers: { 'User-Agent': 'DiscDrop deploy-provenance check' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { version: await res.json() };
      lastStatus = `HTTP ${res.status}`;
      // Nothing there to read: no version.json has ever been published, which
      // is the genuine first-deploy case.
      if (res.status === 404) return { firstDeploy: true };
    } catch (err) {
      lastStatus = err.message;
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  return { unreadable: lastStatus };
}

const result = await readLiveVersion();
if (result.firstDeploy) {
  console.log(`${url}/version.json does not exist yet — nothing has been deployed with a version stamp. Proceeding.`);
  process.exit(0);
}
if (result.unreadable) {
  warn(
    `Could not read ${url}/version.json after 3 attempts (${result.unreadable}). This is NOT the same as ` +
    `a first deploy: something is there, we just cannot see it, so this run does not know what is live. ` +
    `Proceeding anyway rather than blocking the daily deploy on someone else's outage — but if the site ` +
    `rolls back after this run, this is why, and the fix is to compare against the Cloudflare deployment ` +
    `API with the token this workflow already has.`
  );
  process.exit(0);
}
const live = result.version;

const head = execSync('git rev-parse HEAD').toString().trim();
console.log(`live:  ${live.sha} (${live.builtBy || '?'}${live.dirty ? ', dirty' : ''}, ${live.builtAt || '?'})`);
console.log(`local: ${head}`);

if (live.sha === head) {
  console.log('Live site is already this exact commit. Deploy is a no-op re-publish; proceeding.');
  process.exit(0);
}

if (live.dirty) {
  warn(`The live site was deployed from a working tree with uncommitted changes (sha ${live.sha} does not identify it). Cannot verify provenance; allowing, since that deploy was a deliberate manual act.`);
  process.exit(0);
}

if (haveCommit(live.sha) && isAncestorOfHead(live.sha)) {
  console.log('Live commit is an ancestor of HEAD — this deploy moves the site forward. Proceeding.');
  process.exit(0);
}

const reason = haveCommit(live.sha)
  ? `commit ${live.sha} exists here but is NOT an ancestor of HEAD — the branches have diverged`
  : `commit ${live.sha} does not exist in this checkout at all`;

console.log(`::error title=Refusing to deploy over unpushed work::The live site was built from a commit this checkout does not have: ${reason}. Deploying now would roll the site back to whatever this run produced and discard that work. This is what happened on 2026-09-05, when a cron deployed over two days of unpushed catalog changes.`);
console.log('::error::Push the work the live site was built from, or re-run this workflow once main contains it. Nothing has been deployed.');
process.exit(1);
