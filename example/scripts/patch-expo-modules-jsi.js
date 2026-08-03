#!/usr/bin/env node
/**
 * Xcode 26.2 / Swift 6.2 fails compiling expo-modules-jsi Date coding:
 *   abs(milliseconds) <= maxJavaScriptDateMilliseconds
 *   → "type of expression is ambiguous without a type annotation"
 *
 * Upstream: https://github.com/expo/expo/issues/47957
 * Prefer Xcode 26.4+ when available; until then rewrite the guard without abs().
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI',
  'Coding',
  'JavaScriptCodable+Date.swift'
);

if (!fs.existsSync(target)) {
  console.log('[patch-expo-modules-jsi] skip — package not installed');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const from =
  'guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {';
const to =
  'guard milliseconds.isFinite, milliseconds >= -maxJavaScriptDateMilliseconds, milliseconds <= maxJavaScriptDateMilliseconds else {';

if (source.includes(to)) {
  console.log('[patch-expo-modules-jsi] already applied');
  process.exit(0);
}

if (!source.includes(from)) {
  console.warn(
    '[patch-expo-modules-jsi] pattern not found — expo-modules-jsi may already be fixed; leave as-is'
  );
  process.exit(0);
}

fs.writeFileSync(target, source.replace(from, to));
console.log('[patch-expo-modules-jsi] applied Xcode 26.2 Date.swift workaround');
