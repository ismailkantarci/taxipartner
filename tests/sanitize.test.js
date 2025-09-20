import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../modules/core.moduleLoader/sanitize.js';

describe('sanitizeHTML', () => {
  it('removes scripts, event handlers, javascript: and style attrs', () => {
    const input = "<div onclick=\"alert('x')\" style=\"color:red\">ok<script>alert(1)</script><a href=\"javascript:alert(2)\">x</a></div>";
    const out = sanitizeHTML(input);
    expect(out).not.toMatch(/onclick/);
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toMatch(/ok/);
  });
});
