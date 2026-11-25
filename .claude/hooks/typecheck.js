#!/usr/bin/env node
// PostToolUse hook: after Claude edits a .ts/.tsx file, type-check the package it belongs to
// (backend/ or frontend/). If there are type errors, exit code 2 sends them back to Claude
// so it fixes them straight away. Skips quietly if dependencies aren't installed yet.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    process.exit(0);
  }

  const filePath = String((input.tool_input || {}).file_path || '');
  if (!/\.(ts|tsx)$/.test(filePath)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const rel = path.relative(projectDir, path.resolve(projectDir, filePath)).split(path.sep).join('/');
  const pkg = ['backend', 'frontend'].find((p) => rel === p || rel.startsWith(`${p}/`));
  if (!pkg) process.exit(0);

  const pkgDir = path.join(projectDir, pkg);
  const tsc = path.join(pkgDir, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!fs.existsSync(tsc)) process.exit(0); // npm install not run yet

  try {
    execFileSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false'], {
      cwd: pkgDir,
      stdio: 'pipe',
      timeout: 110_000,
    });
    process.exit(0);
  } catch (err) {
    const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
    if (!out) process.exit(0); // timeout or crash: don't block work
    const lines = out.split('\n');
    const shown = lines.slice(0, 30).join('\n');
    const more = lines.length > 30 ? `\n…and ${lines.length - 30} more lines` : '';
    console.error(`TypeScript errors in ${pkg}/ after editing ${rel}. Fix them before continuing:\n${shown}${more}`);
    process.exit(2);
  }
});
