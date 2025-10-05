import { assignRole } from './roleGuard.js';
import type { RoleName, User } from './types.js';

const fakeDb = new Map<string, User>();

async function loadUser(userId: string): Promise<User> {
  if (!fakeDb.has(userId)) {
    fakeDb.set(userId, { id: userId, roles: [], sessions: [] });
  }
  return fakeDb.get(userId)!;
}

async function saveUser(user: User): Promise<void> {
  fakeDb.set(user.id, user);
}

interface Request {
  params: { userId: string };
  body: { role: RoleName };
}

interface Response {
  status(code: number): Response;
  json(payload: unknown): void;
}

export async function postAssignRole(req: Request, res: Response): Promise<void> {
  try {
    const user = await loadUser(req.params.userId);
    const updated = assignRole(user, req.body.role);
    await saveUser(updated);
    res.status(200).json({ ok: true, roles: updated.roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu.';
    res.status(400).json({ ok: false, error: message });
  }
}
