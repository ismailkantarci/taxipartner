import { describe, expect, it } from 'vitest';
import {
  bumpPatch,
  compareVersion,
  computeReleaseModules,
  diffHighlight,
  latestVersion,
  validateRelease,
} from '../modules/ReleaseManagement/utils.js';

describe('compareVersion', () => {
  it('handles semantic ordering with different lengths', () => {
    expect(compareVersion('1.2.3', '1.3.0')).toBeLessThan(0);
    expect(compareVersion('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersion('2.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersion('1.2.0', '1.2')).toBe(0);
  });
});

describe('computeReleaseModules', () => {
  it('deduplicates modules from direct array input', () => {
    expect(computeReleaseModules({ modules: ['core', 'core', 'ui'] })).toEqual(['core', 'ui']);
  });

  it('extracts modules from file change hints', () => {
    const result = computeReleaseModules({
      _files: [
        'added: modules/ReleaseManagement/index.module.js',
        'modified: modules/core.state/app.state.module.js',
        'removed: modules/core.state/app.state.module.js',
        'modified: src/styles/main.css',
      ],
    });
    expect(result).toEqual(['ReleaseManagement', 'core.state']);
  });
});

describe('diffHighlight', () => {
  it('wraps additions in highlight spans', () => {
    const { bHtml } = diffHighlight('hello world', 'hello brave world');
    expect(bHtml).toContain('brave');
    expect(bHtml).toMatch(/<span class="bg-yellow-200/);
  });
});

describe('validateRelease', () => {
  it('detects missing required fields', () => {
    const errors = validateRelease({});
    expect(errors).toContain('version:missing');
    expect(errors).toContain('date:missing');
  });

  it('validates status and description object content', () => {
    const errors = validateRelease({
      version: '1.2.3',
      date: '2024-01-01',
      status: 'experimental',
      description: {},
    });
    expect(errors).toContain('status:unknown');
    expect(errors).toContain('description:empty');
  });
});

describe('bumpPatch', () => {
  it('increments the patch component', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4');
    expect(bumpPatch('invalid')).toBe('0.0.1');
  });
});

describe('latestVersion', () => {
  it('returns highest semantic version', () => {
    const list = [
      { version: '1.2.3' },
      { version: '1.10.0' },
      { version: '1.9.5' },
    ];
    expect(latestVersion(list)).toBe('1.10.0');
  });
});
