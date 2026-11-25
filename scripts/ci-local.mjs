#!/usr/bin/env node
// Runs the same checks as .github/workflows/ci.yml on your own machine:
// type check -> unit tests -> production build, for backend/ and frontend/.
//
//   node scripts/ci-local.mjs                 both packages
//   node scripts/ci-local.mjs backend         one package
//   node scripts/ci-local.mjs --install       also run `npm ci` first (like CI does)
//   node scripts/ci-local.mjs --skip-build    quicker: type check + tests only
//
// Exit code is 0 only when every step passes, so it also works as a git hook.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const wanted = args.filter((a) => !a.startsWith('--'));

const ALL = ['backend', 'frontend'];
const packages = wanted.length ? wanted : ALL;
const unknown = packages.filter((p) => !ALL.includes(p));
if (unknown.length) {
  console.error(`Unknown package: ${unknown.join(', ')}. Use: ${ALL.join(', ')}`);
  process.exit(2);
}

const steps = [
  ...(flags.has('--install') ? [{ name: 'Install', cmd: 'npm ci' }] : []),
  { name: 'Type check', cmd: 'npm run typecheck' },
  { name: 'Unit tests', cmd: 'npm test' },
  ...(flags.has('--skip-build') ? [] : [{ name: 'Build', cmd: 'npm run build' }]),
];

const useColor = process.stdout.isTTY;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => paint(32, s);
const red = (s) => paint(31, s);
const bold = (s) => paint(1, s);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

const results = [];

for (const pkg of packages) {
  const cwd = join(root, pkg);
  if (!existsSync(join(cwd, 'node_modules')) && !flags.has('--install')) {
    console.error(red(`\n${pkg}/node_modules is missing. Run with --install (or npm install) first.`));
    process.exit(2);
  }
  for (const step of steps) {
    console.log(bold(`\n▶ ${pkg}: ${step.name}  (${step.cmd})`));
    const started = Date.now();
    const run = spawnSync(step.cmd, { cwd, stdio: 'inherit', shell: true });
    const ok = run.status === 0;
    results.push({ pkg, name: step.name, ok, ms: Date.now() - started });
    if (!ok) {
      // Later steps in this package depend on this one, so skip them (the other package still runs)
      console.error(red(`✖ ${pkg}: ${step.name} failed`));
      break;
    }
  }
}

console.log(bold('\n──────── Summary ────────'));
for (const r of results) {
  console.log(`${r.ok ? green('✔') : red('✖')} ${r.pkg.padEnd(9)} ${r.name.padEnd(11)} ${seconds(r.ms)}`);
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? red(`\n${failed.length} step(s) failed`) : green('\nAll checks passed. Safe to push.'));
process.exit(failed.length ? 1 : 0);
