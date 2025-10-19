import type { Request, Response } from 'express';
import express from 'express';

import { prisma } from './db.js';

const LANG_WHITELIST = new Set(['de-AT', 'tr', 'en']);
const THEME_WHITELIST = new Set(['light', 'dark', 'system', 'autoSun']);

function mapProfile(user: {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  preferredLanguage?: string | null;
  preferredTheme?: string | null;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    preferredLanguage: user.preferredLanguage ?? null,
    preferredTheme: user.preferredTheme ?? null,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export const profileRouter = express.Router();

profileRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any)?.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Yetkisiz' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
    return;
  }

  res.json({ ok: true, profile: mapProfile(user) });
});

profileRouter.put('/', async (req: Request, res: Response) => {
  const userId = (req as any)?.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Yetkisiz' });
    return;
  }

  const { fullName, phone, preferredLanguage, preferredTheme } = req.body ?? {};

  const updates: Record<string, string | null> = {};

  if (fullName !== undefined) {
    if (fullName !== null && typeof fullName !== 'string') {
      res.status(400).json({ ok: false, error: 'Ad/soyad metin veya null olmalıdır.' });
      return;
    }
    if (typeof fullName === 'string' && fullName.trim().length > 160) {
      res.status(400).json({ ok: false, error: 'Ad/soyad 160 karakteri aşamaz.' });
      return;
    }
    updates.fullName = fullName ? fullName.trim() : null;
  }

  if (phone !== undefined) {
    if (phone !== null && typeof phone !== 'string') {
      res.status(400).json({ ok: false, error: 'Telefon metin veya null olmalıdır.' });
      return;
    }
    if (typeof phone === 'string' && phone.trim().length > 40) {
      res.status(400).json({ ok: false, error: 'Telefon 40 karakteri aşamaz.' });
      return;
    }
    updates.phone = phone ? phone.trim() : null;
  }

  if (preferredLanguage !== undefined) {
    if (preferredLanguage !== null && typeof preferredLanguage !== 'string') {
      res.status(400).json({ ok: false, error: 'Dil seçimi metin veya null olmalıdır.' });
      return;
    }
    if (typeof preferredLanguage === 'string' && !LANG_WHITELIST.has(preferredLanguage)) {
      res.status(400).json({ ok: false, error: 'Desteklenmeyen dil kodu.' });
      return;
    }
    updates.preferredLanguage = preferredLanguage ?? null;
  }

  if (preferredTheme !== undefined) {
    if (preferredTheme !== null && typeof preferredTheme !== 'string') {
      res.status(400).json({ ok: false, error: 'Tema seçimi metin veya null olmalıdır.' });
      return;
    }
    if (typeof preferredTheme === 'string' && !THEME_WHITELIST.has(preferredTheme)) {
      res.status(400).json({ ok: false, error: 'Desteklenmeyen tema seçimi.' });
      return;
    }
    updates.preferredTheme = preferredTheme ?? null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ ok: false, error: 'Güncellenecek alan bulunamadı.' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates
  });

  res.json({ ok: true, profile: mapProfile(updated) });
});
