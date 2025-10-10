import express from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";

export const ousRouter = express.Router();

ousRouter.get(
  "/",
  permissionGuard(["tp.ou.read"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId =
      (req.headers["x-tenant-id"] as string | undefined) ||
      (req.query.tenantId as string | undefined) ||
      "";
    const rows = await prisma.oU.findMany({
      where: { tenantId },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, items: rows });
  }
);

ousRouter.post(
  "/",
  permissionGuard(["tp.ou.create"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId =
      (req.headers["x-tenant-id"] as string | undefined) ||
      req.body?.tenantId;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const { name, parentId } = req.body || {};
    if (!name) {
      res.status(400).json({ ok: false, error: "name zorunlu" });
      return;
    }
    const ou = await prisma.oU.create({
      data: { tenantId, name, parentId: parentId || null }
    });
    res.status(201).json({ ok: true, ou });
  }
);

// MP-18 Fix Pack: enforce tenant scoping on OU mutations
ousRouter.put(
  "/:id",
  permissionGuard(["tp.ou.create"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId =
      (req.headers["x-tenant-id"] as string | undefined) ||
      req.body?.tenantId ||
      (req.query.tenantId as string | undefined);
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunludur" });
      return;
    }
    const { name, parentId } = req.body || {};
    if (typeof name === "undefined" && typeof parentId === "undefined") {
      res
        .status(400)
        .json({ ok: false, error: "Güncellenecek alan bulunamadı (name/parentId)" });
      return;
    }
    if (parentId && parentId === req.params.id) {
      res.status(400).json({ ok: false, error: "parentId kendi id olamaz" });
      return;
    }
    try {
      const updated = await prisma.oU.update({
        where: { id: req.params.id },
        data: {
          ...(typeof name !== "undefined" ? { name } : {}),
          ...(typeof parentId !== "undefined" ? { parentId: parentId || null } : {})
        }
      });
      res.json({ ok: true, ou: updated });
    } catch (error) {
      res
        .status(400)
        .json({ ok: false, error: (error as Error).message || "OU güncelleme hatası" });
    }
  }
);

ousRouter.delete(
  "/:id",
  permissionGuard(["tp.ou.create"]),
  scopeGuard(),
  async (req, res) => {
    try {
      const children = await prisma.oU.count({ where: { parentId: req.params.id } });
      if (children > 0) {
        res.status(400).json({ ok: false, error: "Alt birimler varken silinemez" });
        return;
      }
      await prisma.oU.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      res
        .status(400)
        .json({ ok: false, error: (error as Error).message || "OU silme hatası" });
    }
  }
);
