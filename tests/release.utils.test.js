import { describe, it, expect } from 'vitest';
import { compareVersion, computeReleaseModules, diffHighlight, validateRelease, bumpPatch, latestVersion } from '../modules/ReleaseManagement/utils.js';

describe('compareVersion', () => {
  it('orders properly', () => {
    expect(compareVersion('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareVersion('1.10.0', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersion('1.2.0', '1.2')).toBe(0);
  });
});

describe('computeReleaseModules', () => {
  it('uses explicit modules list', () => {
    expect(computeReleaseModules({ modules: ['A', 'B', 'A'] })).toEqual(['A','B']);
  });
  it('extracts from _files when missing', () => {
    const r = { _files: ['added: modules/Foo/index.js', 'modified: modules/Bar/util.js', 'README.md'] };
    expect(computeReleaseModules(r).sort()).toEqual(['Bar','Foo']);
  });
});

describe('diffHighlight', () => {
  it('highlights word differences', () => {
    const { aHtml, bHtml } = diffHighlight('hello world', 'hello brave world');
    expect(aHtml).toContain('hello');
    expect(bHtml).toContain('brave');
  });
});

describe('validateRelease', () => {
  it('flags missing fields and invalid semver/date', () => {
    expect(validateRelease({})).toEqual(expect.arrayContaining(['version:missing','date:missing']));
    expect(validateRelease({ version: '1.2', date: '2025-13-99' })).toEqual(expect.arrayContaining(['version:semver','date:format']));
  });
  it('accepts minimal valid object', () => {
    expect(validateRelease({ version: '1.2.3', date: '2025-09-15', status: 'Stable', description: { en: 'ok' } })).toHaveLength(0);
  });
});

describe('version helpers', () => {
  it('bumpPatch increases patch', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4');
    expect(bumpPatch('invalid')).toBe('0.0.1');
  });
  it('latestVersion finds top', () => {
    const list = [{version:'1.0.9'},{version:'1.2.0'},{version:'1.1.5'}];
    expect(latestVersion(list)).toBe('1.2.0');
  });
});
