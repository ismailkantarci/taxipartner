import express from 'express';
import roleTemplates from '../seeds/seed_role_permissions.json' assert { type: 'json' };
import { DEV_BYPASS_AUTH } from './env.js';
import { getTemplate, resolveEffectivePermissions } from './permissionTemplates.js';

const templatesArray: Array<{ role: string; allow: string[]; deny: string[] }> =
  ((roleTemplates as any).templates as Array<{ role: string; allow: string[]; deny: string[] }>) ?? [];

export const permissionsRouter = express.Router();

permissionsRouter.get('/templates', (_req, res) => {
  res.json({ ok: true, templates: templatesArray });
});

permissionsRouter.get('/roles/:role/effective', (req, res) => {
  const role = req.params.role;
  const template = getTemplate(role);
  if (!template) {
    res.status(404).json({ ok: false, error: 'Rol şablonu yok.' });
    return;
  }
  const effective = resolveEffectivePermissions(template);
  res.json({ ok: true, role, allow: effective.allow });
});

permissionsRouter.post('/templates/:role', (req, res) => {
  if (process.env.NODE_ENV === 'production' || !DEV_BYPASS_AUTH) {
    res.status(403).json({ ok: false, error: 'Sadece geliştirme modunda düzenlenebilir.' });
    return;
  }

  const role = req.params.role;
  const index = templatesArray.findIndex((entry) => entry.role === role);
  if (index === -1) {
    res.status(404).json({ ok: false, error: 'Rol şablonu yok.' });
    return;
  }

  const { allow, deny } = req.body ?? {};
  if (allow !== undefined) {
    if (!Array.isArray(allow) || !allow.every((item) => typeof item === 'string')) {
      res.status(400).json({ ok: false, error: 'allow dizisi string değerler içermelidir.' });
      return;
    }
    templatesArray[index].allow = [...allow];
  }
  if (deny !== undefined) {
    if (!Array.isArray(deny) || !deny.every((item) => typeof item === 'string')) {
      res.status(400).json({ ok: false, error: 'deny dizisi string değerler içermelidir.' });
      return;
    }
    templatesArray[index].deny = [...deny];
  }

  const updatedTemplate = templatesArray[index];
  res.json({
    ok: true,
    template: updatedTemplate,
    note: 'Bu güncelleme runtime içindir; kalıcı olması için seed dosyasını elle güncelleyin.'
  });
});
