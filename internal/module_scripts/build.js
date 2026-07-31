#!/usr/bin/env node
const { spawnSyncWithAutoShell } = require('./util');
const fs = require('fs');
const path = require('path');

const SUBTARGETS = ['plugin', 'cli', 'utils', 'scripts'];
const args = process.argv.slice(2);
const target = args[0];

function runTsc(tscArgs) {
  const result = spawnSyncWithAutoShell('tsc', tscArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (SUBTARGETS.includes(target)) {
  const targetDir = path.join(process.cwd(), target);
  if (!fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
    console.log(`tsconfig.json not found in ${target}, skipping build for ${target}`);
    process.exit(0);
  }
  runTsc(['--build', targetDir, ...args.slice(1)]);
  process.exit(0);
}

// Default: one-shot build of main + present subtargets (plugin, …)
runTsc(args);
for (const sub of SUBTARGETS) {
  const targetDir = path.join(process.cwd(), sub);
  if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
    console.log(`Building ${sub}`);
    runTsc(['--build', targetDir]);
  }
}
