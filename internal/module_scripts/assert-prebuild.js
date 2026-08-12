#!/usr/bin/env node
/**
 * Assert example/ native projects contain T2 config-plugin injections.
 * Run after: cd example && npx expo prebuild
 *
 * Usage (from repo root):
 *   node internal/module_scripts/assert-prebuild.js
 *   node internal/module_scripts/assert-prebuild.js --platform android
 *   yarn assert:prebuild -- --platform android
 *
 * --platform android|ios|all (default: all)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const example = path.join(root, 'example');
const errors = [];

function fail(msg) {
  errors.push(msg);
}

function parsePlatform(argv) {
  const idx = argv.indexOf('--platform');
  if (idx === -1) return 'all';
  const value = argv[idx + 1];
  if (!value || value.startsWith('-')) {
    fail('--platform requires android, ios, or all');
    return 'all';
  }
  if (value !== 'android' && value !== 'ios' && value !== 'all') {
    fail(`Invalid --platform ${value} (expected android, ios, or all)`);
    return 'all';
  }
  return value;
}

const platform = parsePlatform(process.argv.slice(2));
const checkIos = platform === 'ios' || platform === 'all';
const checkAndroid = platform === 'android' || platform === 'all';

// --- iOS Info.plist ---
if (checkIos) {
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
}

// --- AndroidManifest ---
if (checkAndroid) {
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
    if (!xml.includes('android:stopWithTask="false"') && !xml.includes("android:stopWithTask=\"false\"")) {
      // Expo may serialize differently
      if (!/stopWithTask["\s]*=["\s]*false/.test(xml)) {
        fail('AndroidManifest missing stopWithTask=false (ContinuePlayback wiring)');
      }
    }
    if (!xml.includes('androidx.media3.session.MediaSessionService')) {
      fail('AndroidManifest missing MediaSessionService intent-filter action');
    }
  }
}

if (errors.length) {
  console.error('assert-prebuild failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(`assert-prebuild ok (platform=${platform})`);
