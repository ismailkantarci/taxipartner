import { assignRole } from './roleGuard.js';
const fakeDb = new Map();
async function loadUser(userId) {
    if (!fakeDb.has(userId)) {
        fakeDb.set(userId, { id: userId, roles: [], sessions: [] });
    }
    return fakeDb.get(userId);
}
async function saveUser(user) {
    fakeDb.set(user.id, user);
}
export async function postAssignRole(req, res) {
    try {
        const user = await loadUser(req.params.userId);
        const updated = assignRole(user, req.body.role);
        await saveUser(updated);
        res.status(200).json({ ok: true, roles: updated.roles });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu.';
        res.status(400).json({ ok: false, error: message });
    }
}
