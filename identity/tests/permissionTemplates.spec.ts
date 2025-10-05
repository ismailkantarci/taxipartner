import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getTemplate, resolveEffectivePermissions } from '../src/permissionTemplates.js';

test('template exists for Steuerberater', () => {
  const t = getTemplate('Steuerberater');
  assert.ok(t && t.allow.includes('tp.vorbuchhaltung.*'));
});

test('deny removes write-like items for Compliance Officer', () => {
  const t = getTemplate('Compliance Officer');
  assert.ok(t, 'Compliance Officer şablonu bulunamadı');
  const eff = resolveEffectivePermissions(t!);
  assert.ok(!eff.allow.some((p) => p.startsWith('tp.identity.user')));
});

test('Kontroller is read-only shaped', () => {
  const t = getTemplate('Kontroller');
  if (!t) {
    throw new Error('Kontroller şablonu bulunamadı');
  }
  const eff = resolveEffectivePermissions(t);
  assert.ok(eff.allow.includes('tp.finance.report.read'));
});
