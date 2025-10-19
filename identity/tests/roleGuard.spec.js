import assert from 'node:assert/strict';
import test from 'node:test';
import { assignRole } from '../src/roleGuard.js';
test('Superadmin mevcutken yeni rol atanamaz', () => {
    const user = { id: 'user-1', roles: ['Superadmin'], mfaEnabled: true, sessions: [] };
    assert.throws(() => assignRole(user, 'HR Manager'), /'Superadmin'/);
});
test("'Wirtschaftsprüfer' ile 'Steuerberater' uyumsuz", () => {
    const user = { id: 'user-2', roles: ['Wirtschaftsprüfer'], sessions: [] };
    assert.throws(() => assignRole(user, 'Steuerberater'), /'Wirtschaftsprüfer' ile 'Steuerberater' birlikte atanamaz\./);
});
test('Kontroller ataması için claims zorunludur', () => {
    const user = { id: 'user-3', roles: [] };
    assert.throws(() => assignRole(user, 'Kontroller'), /'Kontroller' rolü için en az bir kiracı/);
});
test("'Fahrer' ile 'Gewerberechtliche GF' birlikte atanabilir", () => {
    const user = { id: 'user-4', roles: ['Fahrer'], sessions: [] };
    const updated = assignRole(user, 'Gewerberechtliche GF');
    assert.deepEqual(new Set(updated.roles), new Set(['Fahrer', 'Gewerberechtliche GF']));
    assert.equal(updated.mfaEnabled, true);
    assert.deepEqual(updated.sessions, []);
});
test('Mevcut rolde iken tekil rol atanamaz', () => {
    const user = { id: 'user-5', roles: ['Mitarbeiter'], sessions: [] };
    assert.throws(() => assignRole(user, 'Kontroller'), /'Kontroller' rolü tekil olduğu için mevcut rollerle birlikte atanamaz\./);
});
