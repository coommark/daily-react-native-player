#!/usr/bin/env node
/**
 * Assert example/ native projects contain T2 config-plugin injections.
 * Run after: cd example && npx expo prebuild
 *
 * Usage (from repo root):
 *   node internal/module_scripts/assert-prebuild.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const example = path.join(root, 'example');
const errors = [];

function fail(msg) {
  errors.push(msg);
}

// --- iOS Info.plist ---
const iosDir = path.join(example, 'ios');
function findInfoPlists(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'Pods' && entry.name !== 'build') {
      findInfoPlists(full, out);
    } else if (entry.name === 'Info.plist') {
      out.push(full);
    }
  }
  return out;
}

const plists = findInfoPlists(iosDir);
if (!plists.length) {
  fail('No iOS Info.plist found under example/ios (run expo prebuild first)');
} else {
  const hasAudio = plists.some((p) => {
    const text = fs.readFileSync(p, 'utf8');
    return (
      text.includes('UIBackgroundModes') &&
      (text.includes('<string>audio</string>') || text.includes('audio'))
    );
  });
  if (!hasAudio) {
    fail('UIBackgroundModes audio not found in any example iOS Info.plist');
  }
}

// --- AndroidManifest ---
const manifestPath = path.join(
  example,
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);
if (!fs.existsSync(manifestPath)) {
  fail('example/android/.../AndroidManifest.xml missing (run expo prebuild first)');
} else {
  const xml = fs.readFileSync(manifestPath, 'utf8');
  const must = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.POST_NOTIFICATIONS',
    'expo.modules.dailyreactnativeplayer.PlaybackService',
    'mediaPlayback',
  ];
  for (const item of must) {
    if (!xml.includes(item)) {
      fail(`AndroidManifest missing: ${item}`);
    }
  }
}

if (errors.length) {
  console.error('assert-prebuild failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('assert-prebuild ok');
