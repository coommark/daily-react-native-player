#!/usr/bin/env node
/**
 * Assert npm pack contents match the publish allow/deny lists.
 * Must include native + build + plugin artifacts; must exclude example/agent noise.
 * Also asserts package.json / podspec / gradle version lockstep.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const MUST_INCLUDE = [
  'package/build/index.js',
  'package/android/',
  'package/ios/',
  'package/expo-module.config.json',
  'package/LICENSE',
  'package/app.plugin.js',
  'package/plugin/build/',
];

const MUST_EXCLUDE = [
  'package/example/',
  'package/prompt.txt',
  'package/.agents/',
  'package/internal/',
  'package/AGENTS.md',
  'package/.cursorrules',
];

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

function assertVersionLockstep(errors) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const pkgVersion = pkg.version;

  const podspec = fs.readFileSync(
    path.join(root, 'ios', 'DailyReactNativePlayer.podspec'),
    'utf8'
  );
  const podMatch = podspec.match(/s\.version\s*=\s*'([^']+)'/);
  if (!podMatch) {
    errors.push('could not parse s.version from ios/DailyReactNativePlayer.podspec');
  } else if (podMatch[1] !== pkgVersion) {
    errors.push(
      `version mismatch: package.json (${pkgVersion}) != podspec (${podMatch[1]})`
    );
  }

  const gradle = fs.readFileSync(path.join(root, 'android', 'build.gradle'), 'utf8');
  const gradleMatch = gradle.match(/versionName\s+"([^"]+)"/);
  if (!gradleMatch) {
    errors.push('could not parse versionName from android/build.gradle');
  } else if (gradleMatch[1] !== pkgVersion) {
    errors.push(
      `version mismatch: package.json (${pkgVersion}) != android versionName (${gradleMatch[1]})`
    );
  }

  const topVersion = gradle.match(/^version\s*=\s*'([^']+)'/m);
  if (topVersion && topVersion[1] !== pkgVersion) {
    errors.push(
      `version mismatch: package.json (${pkgVersion}) != android build.gradle version (${topVersion[1]})`
    );
  }
}

const files = listPackedFiles();
const errors = [];

assertVersionLockstep(errors);

for (const item of MUST_INCLUDE) {
  if (!hasPrefix(files, item) && !files.includes(item)) {
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
  const starts = files.some((f) => f === item || f.startsWith(item));
  if (starts) {
    errors.push(`forbidden pack entry present: ${item}`);
  }
}

if (errors.length) {
  console.error('pack:check failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  console.error('\nPacked paths (sample):\n' + files.slice(0, 40).join('\n'));
  process.exit(1);
}

console.log(`pack:check ok (${files.length} files, version lockstep ok)`);
