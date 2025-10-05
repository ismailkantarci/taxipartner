import express from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";

export const companiesRouter = express.Router();

function tenantFrom(req: express.Request): string | undefined {
  return (
    (req.headers["x-tenant-id"] as string | undefined) ||
    (req.query.tenantId as string | undefined) ||
    req.body?.tenantId
  );
}

async function ensureCompany(id: string, tenantId: string) {
  return prisma.company.findFirst({ where: { id, tenantId } });
}

companiesRouter.get(
  "/",
  permissionGuard(["tp.company.read"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const q = String(req.query.q || "");
    const rows = await prisma.company.findMany({
      where: {
        tenantId,
        OR: q
          ? [
              { legalName: { contains: q, mode: "insensitive" } },
              { uid: { contains: q, mode: "insensitive" } },
              { regNo: { contains: q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ ok: true, items: rows });
  }
);

companiesRouter.post(
  "/",
  permissionGuard(["tp.company.create"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req);
    const { legalName, legalForm, uid, regNo, status } = req.body || {};
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    if (!legalName || !legalForm) {
      res
        .status(400)
        .json({ ok: false, error: "legalName ve legalForm zorunlu" });
      return;
    }
    const company = await prisma.company.create({
      data: {
        tenantId,
        legalName,
        legalForm,
        uid,
        regNo,
        status: status || "Active"
      }
    });
    res.status(201).json({ ok: true, company });
  }
);

companiesRouter.get(
  "/:id",
  permissionGuard(["tp.company.read"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, tenantId },
      include: { officers: true, shareholders: true, documents: true }
    });
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    res.json({ ok: true, company });
  }
);

companiesRouter.put(
  "/:id",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const exists = await ensureCompany(req.params.id, tenantId);
    if (!exists) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { legalName, legalForm, uid, regNo, status } = req.body || {};
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { legalName, legalForm, uid, regNo, status }
    });
    res.json({ ok: true, company });
  }
);

companiesRouter.delete(
  "/:id",
  permissionGuard(["tp.company.delete"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const exists = await ensureCompany(req.params.id, tenantId);
    if (!exists) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }
);

companiesRouter.post(
  "/:id/officers",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { type, userId, validFrom, validTo } = req.body || {};
    if (!type) {
      res.status(400).json({ ok: false, error: "type zorunlu" });
      return;
    }
    const officer = await prisma.companyOfficer.create({
      data: {
        companyId: company.id,
        type,
        userId: userId || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null
      }
    });
    res.status(201).json({ ok: true, officer });
  }
);

companiesRouter.delete(
  "/:id/officers/:officerId",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.companyOfficer.deleteMany({
      where: { id: req.params.officerId, companyId: company.id }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);

companiesRouter.post(
  "/:id/shareholders",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { personName, roleType, percent } = req.body || {};
    if (!personName || !roleType) {
      res.status(400).json({ ok: false, error: "personName ve roleType zorunlu" });
      return;
    }
    const shareholder = await prisma.shareholder.create({
      data: {
        companyId: company.id,
        personName,
        roleType,
        percent: percent === undefined ? null : Number(percent)
      }
    });
    res.status(201).json({ ok: true, shareholder });
  }
);

companiesRouter.delete(
  "/:id/shareholders/:shareholderId",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.shareholder.deleteMany({
      where: { id: req.params.shareholderId, companyId: company.id }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);

companiesRouter.post(
  "/:id/documents",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { title, docType, url, metaJson } = req.body || {};
    if (!title || !docType) {
      res.status(400).json({ ok: false, error: "title ve docType zorunlu" });
      return;
    }
    const document = await prisma.companyDocument.create({
      data: {
        companyId: company.id,
        title,
        docType,
        url: url || null,
        metaJson: metaJson ? JSON.stringify(metaJson) : null
      }
    });
    res.status(201).json({ ok: true, document });
  }
);

companiesRouter.delete(
  "/:id/documents/:documentId",
  permissionGuard(["tp.company.update"]),
  scopeGuard(),
  async (req, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.companyDocument.deleteMany({
      where: { id: req.params.documentId, companyId: company.id }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);
