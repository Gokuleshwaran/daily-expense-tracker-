#!/usr/bin/env node
// PreToolUse hook: stops Claude from reading or changing secret .env files.
// .env.example files are allowed. Exit code 2 blocks the tool call and
// the message on stderr is shown to Claude.

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    process.exit(0); // never block on a hook bug
  }

  const toolInput = input.tool_input || {};
  const filePath = String(toolInput.file_path || toolInput.path || '');
  const name = filePath.split(/[\\/]/).pop() || '';

  const isSecretEnv = /^\.env(\..+)?$/.test(name) && name !== '.env.example';

  if (isSecretEnv) {
    console.error(
      `Blocked: "${name}" holds secrets (database password, JWT secret) and must not be read or edited. ` +
        'Ask the user to change it themselves, or edit the matching .env.example instead.'
    );
    process.exit(2);
  }
  process.exit(0);
});
