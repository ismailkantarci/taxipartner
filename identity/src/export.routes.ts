import express from "express";
import archiver from "archiver";
import { prisma } from "./db.js";
import { stableJson, sha256, hmac256 } from "./export.utils.js";

const EXPORT_SIGN_SECRET = process.env.EXPORT_SIGN_SECRET || "dev-sign";
export const exportRouter = express.Router();

async function ensureWirtschaftspruefer(req: any) {
  const userId = req.user?.id;
  if (!userId) throw new Error("Yetkisiz");
  const roles = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
  const names = roles.map(r => r.role.name);
  if (!(names.includes("Wirtschaftsprüfer") || names.includes("Superadmin"))) {
    throw new Error("Bu işlem için denetçi yetkisi gerekli");
  }
}

exportRouter.get("/audit-package", async (req: any, res: any) => {
  try {
    await ensureWirtschaftspruefer(req);
    const tenantId = String(req.query.tenantId || "");
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!tenantId || !from || !to) return res.status(400).json({ ok: false, error: "tenantId, from, to zorunludur" });

    // TODO: Replace with real audit log query filtered by tenant + period
    const audits: any[] = [];
    const files: Record<string, string> = {};

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="audit-${tenantId}-${from}-${to}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    const auditJson = stableJson({ tenantId, from, to, audits });
    files["audit.json"] = sha256(auditJson);
    archive.append(auditJson, { name: "audit.json" });

    const manifestObj = { tenantId, period: { from, to }, createdAt: new Date().toISOString(), files };
    const manifestStr = stableJson(manifestObj);
    archive.append(manifestStr, { name: "manifest.json" });

    const sign = hmac256(EXPORT_SIGN_SECRET, manifestStr);
    archive.append(sign, { name: "SIGN.txt" });

    await archive.finalize();
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || "Export hatası" });
  }
});
