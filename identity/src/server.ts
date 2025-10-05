import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import incompatible from '../seeds/role_incompatible.json' assert { type: 'json' };
import seedRoles from '../seeds/seed_roles.json' assert { type: 'json' };
import { assignRole } from './roleGuard.js';
import type { Claims, RoleName, User } from './types.js';
import { authRouter } from './auth.routes.js';
import { authGuard } from './authGuard.js';
import { scopeGuard } from './scopeGuard.js';
import { permissionGuard } from './permissionGuard.js';
import { inviteRouter } from './invite.routes.js';
import { prisma } from './db.js';
import { createApprovalRequest, applyApproval } from './approveGuard.js';
import { listApprovals } from './approveGuard.prisma.js';
import { applySecurity } from './server.security.js';
import { exportRouter } from './export.routes.js';
import { permissionsRouter } from './permissions.routes.js';
import { usersRouter } from './users.routes.js';
import { ssoRouter } from './sso.routes.js';
import { attachAudit } from './audit.middleware.js';
import { auditRouter } from './audit.routes.js';
import { startTaskScheduler } from './tasks.scheduler.js';
import { tasksRouter } from './tasks.routes.js';
import { notificationsRouter } from './notifications.routes.js';
import { tenantsRouter } from './tenants.routes.js';
import { ousRouter } from './ous.routes.js';
import { companiesRouter } from './companies.routes.js';
import { healthRouter } from './health.routes.js';
import { langHint } from './lang.middleware.js';
import { errorMiddleware } from './error.middleware.js';

const app = express();
app.use(express.json());
applySecurity(app);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(langHint);

app.use('/sso', ssoRouter);
attachAudit(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/seed/roles', (_req, res) => {
  res.json(seedRoles);
});

app.get('/seed/incompatible', (_req, res) => {
  res.json(incompatible);
});

app.use('/auth', authRouter);
app.use('/invite', inviteRouter);
app.use('/export', authGuard, exportRouter);
app.use('/permissions', authGuard, permissionsRouter);
app.use('/api/users', authGuard, usersRouter);
app.use('/audit', authGuard, auditRouter);
app.use('/tasks', authGuard, tasksRouter);
app.use('/notifications', authGuard, notificationsRouter);
app.use('/tenants', authGuard, tenantsRouter);
app.use('/ous', authGuard, ousRouter);
app.use('/companies', authGuard, companiesRouter);
app.use('/health', healthRouter);

async function mapDbUser(userId: string): Promise<User> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } }
  });
  if (!dbUser) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  return {
    id: dbUser.id,
    roles: dbUser.roles.map((entry) => entry.role.name as RoleName),
    claims: dbUser.claimsJson ? JSON.parse(dbUser.claimsJson) : undefined,
    mfaEnabled: dbUser.mfaEnabled,
    sessions: []
  };
}

const apiRouter = express.Router();

apiRouter.post('/assign-role', async (req, res) => {
  const { userId, role, claims } = req.body ?? {};

  if (typeof userId !== 'string' || typeof role !== 'string') {
    res.status(400).json({ ok: false, error: 'Kullanıcı kimliği ve rol alanları zorunludur.' });
    return;
  }

  let targetUser: User;
  try {
    targetUser = await mapDbUser(userId);
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
    return;
  }

  let claimsPayload: Claims | undefined;
  if (claims) {
    claimsPayload = claims as Claims;
    targetUser = { ...targetUser, claims: claimsPayload };
  }

  try {
    const updated = assignRole(targetUser, role as RoleName);
    const dbRole = await prisma.role.findFirst({ where: { name: role } });
    if (!dbRole) {
      res.status(404).json({ ok: false, error: 'Rol bulunamadı.' });
      return;
    }

    const updates: Promise<unknown>[] = [];
    updates.push(
      prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: dbRole.id } },
        update: {},
        create: { userId, roleId: dbRole.id }
      })
    );

    const userUpdate: Record<string, unknown> = {};
    if (claimsPayload) {
      userUpdate.claimsJson = JSON.stringify(claimsPayload);
    }
    if (updated.mfaEnabled !== undefined) {
      userUpdate.mfaEnabled = updated.mfaEnabled;
    }
    if (Object.keys(userUpdate).length > 0) {
      updates.push(prisma.user.update({ where: { id: userId }, data: userUpdate }));
    }

    await Promise.all(updates);
    res.json({ ok: true, roles: updated.roles, mfaEnabled: updated.mfaEnabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu.';
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post(
  '/finance/report',
  permissionGuard(['tp.finance.report.read']),
  scopeGuard(),
  (req, res) => {
    const tenantId = req.body?.tenantId ?? req.query?.tenantId;
    res.json({ ok: true, data: `Tenant ${tenantId} finans raporu` });
  }
);

app.use('/api', authGuard, apiRouter);

const approvalRouter = express.Router();

approvalRouter.get('/list', async (_req, res) => {
  const approvals = await listApprovals();
  res.json({ ok: true, approvals });
});

approvalRouter.post('/start', scopeGuard(), async (req, res) => {
  try {
    const { op, tenantId, targetId, initiatorUserId } = req.body ?? {};
    if (!op || !tenantId || !initiatorUserId) {
      res.status(400).json({ ok: false, error: 'op, tenantId ve initiatorUserId zorunludur.' });
      return;
    }
    const initiator = await mapDbUser(String(initiatorUserId));
    const request = await createApprovalRequest({ op, tenantId, targetId, initiator });
    res.status(201).json({ ok: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onay isteği başarısız.';
    res.status(400).json({ ok: false, error: message });
  }
});

approvalRouter.post('/:id/apply', async (req, res) => {
  try {
    const approverId = req.body?.approverId;
    if (!approverId) {
      res.status(400).json({ ok: false, error: 'approverId zorunludur.' });
      return;
    }
    const approver = await mapDbUser(String(approverId));
    const updated = await applyApproval(req.params.id, approver);
    res.json({ ok: true, request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onay işlemi başarısız.';
    res.status(400).json({ ok: false, error: message });
  }
});

app.use('/approval', authGuard, approvalRouter);

app.get('/', (_req, res) => {
  res.send('<h1>TAXIPartner Identity API</h1><p>/admin üzerinden demo paneline ulaşabilirsiniz.</p>');
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.use('/admin', express.static(path.join(__dirname, '../public')));

app.use(errorMiddleware);

const port = Number(process.env.PORT || 3000);

let server: ReturnType<typeof app.listen> | undefined;

if (process.env.NODE_ENV !== 'test') {
  startTaskScheduler();
  server = app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`TAXIPartner Identity dev sunucusu 0.0.0.0:${port} üzerinde hazır.`);
  });
}

export { app, server };
