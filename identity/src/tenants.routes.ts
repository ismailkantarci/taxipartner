import express from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";

export const tenantsRouter = express.Router();

tenantsRouter.get(
  "/",
  permissionGuard(["tp.tenant.read"]),
  async (req, res) => {
    const q = String(req.query.q || "");
    const rows = await prisma.tenant.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: { createdAt: "desc" }
    });
    res.json({ ok: true, items: rows });
  }
);

tenantsRouter.post(
  "/",
  permissionGuard(["tp.tenant.create"]),
  async (req, res) => {
    const { code, name, locale, timeZone } = req.body || {};
    if (!code || !name) {
      res.status(400).json({ ok: false, error: "code ve name zorunlu" });
      return;
    }
    const tenant = await prisma.tenant.create({
      data: { code, name, locale, timeZone }
    });
    res.status(201).json({ ok: true, tenant });
  }
);

tenantsRouter.post(
  "/:id/users",
  permissionGuard(["tp.tenant.user.assign"]),
  async (req, res) => {
    const { userId, role } = req.body || {};
    if (!userId) {
      res.status(400).json({ ok: false, error: "userId zorunlu" });
      return;
    }
    const entry = await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: req.params.id, userId } },
      update: { role },
      create: { tenantId: req.params.id, userId, role }
    });
    res.json({ ok: true, item: entry });
  }
);
