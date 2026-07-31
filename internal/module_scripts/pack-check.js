#!/usr/bin/env node
/**
 * Assert npm pack contents match the publish allow/deny lists.
 * Must include native + build artifacts; must exclude example/agent noise.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();

const MUST_INCLUDE = [
  'package/build/index.js',
  'package/android/',
  'package/ios/',
  'package/expo-module.config.json',
  'package/LICENSE',
];

const MUST_EXCLUDE = [
  'package/example/',
  'package/prompt.txt',
  'package/.agents/',
  'package/internal/',
  'package/AGENTS.md',
  'package/.cursorrules',
];

// Plugin artifacts required after T2 scaffold (optional until present)
const PLUGIN_OPTIONAL_UNTIL_PRESENT = ['app.plugin.js', 'plugin/build'];

function listPackedFiles() {
  // --ignore-scripts avoids prepare printing "Building plugin" into stdout
  const result = spawnSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  const stdout = result.stdout.trim();
  // Find JSON array/object even if npm prepends logs
  const jsonStart = Math.min(
    ...['[', '{']
      .map((c) => {
        const i = stdout.indexOf(c);
        return i === -1 ? Number.POSITIVE_INFINITY : i;
      })
      .filter((i) => Number.isFinite(i))
  );
  if (!Number.isFinite(jsonStart)) {
    console.error('pack:check could not find JSON in npm pack output');
    console.error(stdout);
    process.exit(1);
  }
  const parsed = JSON.parse(stdout.slice(jsonStart));
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const files = (entry.files || []).map((f) =>
    typeof f === 'string' ? f : f.path || f.name
  );
  // npm dry-run paths are relative without "package/" prefix in some versions;
  // normalize to package/<path>
  return files.map((f) => (f.startsWith('package/') ? f : `package/${f}`));
}

function hasPrefix(files, prefix) {
  return files.some((f) => f === prefix || f.startsWith(prefix));
}

function hasExactOrFile(files, needle) {
  if (needle.endsWith('/')) {
    return hasPrefix(files, needle);
  }
  return files.includes(needle) || files.some((f) => f.endsWith('/' + path.basename(needle)) && f.includes(needle.replace(/^package\//, '')));
}

const files = listPackedFiles();
const errors = [];

for (const item of MUST_INCLUDE) {
  if (!hasPrefix(files, item) && !files.includes(item)) {
    // also try without trailing slash for dirs
    const alt = item.endsWith('/') ? item.slice(0, -1) : item;
    const found =
      files.includes(item) ||
      files.includes(alt) ||
      files.some((f) => f.startsWith(item) || f.startsWith(alt + '/'));
    if (!found) {
      errors.push(`missing required pack entry: ${item}`);
    }
  }
}

for (const item of MUST_EXCLUDE) {
  const found = files.some(
    (f) => f === item || f.startsWith(item) || f.includes('/' + item.replace(/^package\//, ''))
  );
  // tighter: only flag if path starts with the exclude prefix
  const starts = files.some((f) => f === item || f.startsWith(item));
  if (starts) {
    errors.push(`forbidden pack entry present: ${item}`);
  }
}

// If plugin surface exists on disk, require it in the pack
const pluginJs = path.join(root, 'app.plugin.js');
const pluginBuild = path.join(root, 'plugin', 'build');
if (fs.existsSync(pluginJs) || fs.existsSync(pluginBuild)) {
  const need = ['package/app.plugin.js', 'package/plugin/build/'];
  for (const item of need) {
    const found = files.some((f) => f === item || f.startsWith(item));
    if (!found) {
      errors.push(`plugin present on disk but missing from pack: ${item}`);
    }
  }
}

if (errors.length) {
  console.error('pack:check failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  console.error('\nPacked paths (sample):\n' + files.slice(0, 40).join('\n'));
  process.exit(1);
}

console.log(`pack:check ok (${files.length} files)`);
