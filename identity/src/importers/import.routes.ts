import express from "express";
import type { Request, Response } from "express";
import { importOfficialRegisters } from "./fnGisaImporter.js";

export const importRouter = express.Router();

importRouter.post("/imports/registers", async (req: Request, res: Response) => {
  try {
    const userRoles = Array.isArray((req as any).user?.roles)
      ? ((req as any).user.roles as string[]).map((role) => role.toLowerCase())
      : [];
    const isSuperAdmin = userRoles.includes("superadmin".toLowerCase());
    if (!isSuperAdmin) {
      res.status(403).json({ ok: false, error: "Import işlemi için Superadmin yetkisi gerekli" });
      return;
    }

    const { source, dryRun } = req.body ?? {};
    const report = await importOfficialRegisters({
      source: typeof source === "string" && source.trim().length ? source.trim() : undefined,
      dryRun: Boolean(dryRun)
    });
    res.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    res.status(500).json({ ok: false, error: message });
  }
});

export default importRouter;
