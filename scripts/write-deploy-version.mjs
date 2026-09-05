// scripts/write-deploy-version.mjs — stamps out/version.json with the commit
// this build came from.
//
// It exists so the live site can be asked "which commit are you?", which is the
// only way CI can detect the failure below. Written into out/ after next build
// rather than kept in public/, so it never shows up as a dirty tracked file
// that changes on every build.

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'out');

function git(cmd, fallback = null) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const payload = {
  sha: git('rev-parse HEAD', 'unknown'),
  ref: process.env.GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD', 'unknown'),
  // A build from a working tree with uncommitted changes cannot be identified
  // by its sha alone; the guard treats that as unknown provenance.
  dirty: git('status --porcelain', '') !== '',
  builtAt: new Date().toISOString(),
  builtBy: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
};

writeFileSync(path.join(OUT, 'version.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`out/version.json: ${payload.sha.slice(0, 8)} (${payload.builtBy}${payload.dirty ? ', dirty' : ''})`);
