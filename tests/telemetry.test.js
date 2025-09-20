import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Telemetry } from '../modules/core.telemetry/index.module.js';

describe('Telemetry logging', () => {
  beforeEach(() => {
    localStorage.clear();
    Telemetry._last = {};
    vi.useFakeTimers();
    // Configure small max
    globalThis.AppConfigRef = { telemetry: { maxEntries: 3 } };
  });

  it('scrubs sensitive fields', () => {
    Telemetry.log('info', { email: 'a@b.com', token: 'Bearer abc123' });
    const arr = JSON.parse(localStorage.getItem('Telemetry') || '[]');
    const entry = arr[0] || {};
    expect(JSON.stringify(entry)).not.toContain('a@b.com');
    expect(JSON.stringify(entry)).not.toContain('Bearer abc123');
  });

  it('throttles error events', () => {
    Telemetry.log('error', { x: 1 });
    Telemetry.log('error', { x: 2 });
    let arr = JSON.parse(localStorage.getItem('Telemetry') || '[]');
    expect(arr.length).toBe(1);
    // advance time beyond throttle window
    vi.advanceTimersByTime(2100);
    Telemetry.log('error', { x: 3 });
    arr = JSON.parse(localStorage.getItem('Telemetry') || '[]');
    expect(arr.length).toBe(2);
  });

  it('respects maxEntries cap', () => {
    for (let i = 0; i < 10; i++) Telemetry.log('perf', { n: i });
    const arr = JSON.parse(localStorage.getItem('Telemetry') || '[]');
    expect(arr.length).toBeLessThanOrEqual(3);
  });
});

