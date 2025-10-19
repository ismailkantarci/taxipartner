import express from "express";
import { importOfficialRegisters } from "./fnGisaImporter.js";
export const importRouter = express.Router();
importRouter.post("/imports/registers", async (req, res) => {
    try {
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles.map((role) => role.toLowerCase()) : [];
        const isSuperAdmin = userRoles.includes("superadmin");
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Import failed";
        res.status(500).json({ ok: false, error: message });
    }
});
export default importRouter;
