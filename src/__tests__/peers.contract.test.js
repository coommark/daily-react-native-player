/**
 * Peer / engines contract — Expo 57 support floor must not silently regress.
 */
const pkg = require('../../package.json');

describe('package peers and engines (Expo 57 floor)', () => {
  it('requires Expo SDK 57+ and RN 0.86+', () => {
    expect(pkg.peerDependencies.expo).toMatch(/^>=57/);
    expect(pkg.peerDependencies['react-native']).toMatch(/^>=0\.86/);
  });

  it('does not advertise Expo 53–56 peer floors', () => {
    expect(pkg.peerDependencies.expo).not.toMatch(/5[3-6]/);
  });

  it('pins Node to Expo 57 engine floor', () => {
    expect(pkg.engines.node).toBe('>=22.13.0');
  });

  it('aligns babel-preset-expo to SDK 57 and drops jest-expo', () => {
    expect(pkg.devDependencies['babel-preset-expo']).toMatch(/^~?57\./);
    expect(pkg.devDependencies).not.toHaveProperty('jest-expo');
  });

  it('keeps expo as a required peer (not optional)', () => {
    expect(pkg.peerDependenciesMeta?.expo?.optional).not.toBe(true);
  });

  it('does not bundle expo / react / react-native / expo-modules-core as runtime deps', () => {
    const deps = pkg.dependencies || {};
    for (const name of ['expo', 'react', 'react-native', 'expo-modules-core']) {
      expect(deps).not.toHaveProperty(name);
    }
  });
});
