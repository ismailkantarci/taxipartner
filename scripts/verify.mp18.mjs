/**
 * MP-18 Verify Script
 * Runs a light smoke across health, tenants, companies, ous and writes REPORTS/mp18_verify.md
 * Uses prisma for tenant lookup and seed fallback.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../identity/src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, "../REPORTS");
const REPORT = path.join(REPORT_DIR, "mp18_verify.md");

function now() { return new Date().toISOString(); }
async function fetchJSON(url, init) {
  const r = await fetch(url, { ...(init || {}), headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
}

async function main() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
  const TOKEN = process.env.VERIFY_TOKEN || process.env.TOKEN || "";
  const HEADERS = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const H = (extra = {}) => ({ headers: { ...HEADERS, ...extra } });

  const lines = [];
  lines.push(`# MP-18 Verify Report`);
  lines.push(`- time: ${now()}`);
  lines.push(`- base: ${BASE}`);
  lines.push(`- token: ${TOKEN ? "provided" : "none"}`);
  lines.push("");

  // 1) health
  const health = await fetchJSON(`${BASE}/health`, H());
  lines.push(`## Health`);
  lines.push(`- status: ${health.status}`);
  lines.push("```json"); lines.push(JSON.stringify(health.body, null, 2)); lines.push("```");

  // 2) tenant pick (last created or any)
  let tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "desc" } });
  if (!tenant) {
    lines.push(`\n> No tenant in DB — please run: npm run seed:mp18`);
    fs.writeFileSync(REPORT, lines.join("\n")); return;
  }
  lines.push(`\n## Tenant`);
  lines.push(`- tenantId: ${tenant.tenantId}`);
  lines.push(`- legalName: ${tenant.legalName}`);

  // 3) companies list & create→detail
  lines.push(`\n## Companies`);
  const listC = await fetchJSON(`${BASE}/companies`, H({ "x-tenant-id": tenant.tenantId }));
  lines.push(`- list status: ${listC.status} (count=${(listC.body.items || []).length})`);
  if (listC.status !== 200) { lines.push("```json"); lines.push(JSON.stringify(listC.body, null, 2)); lines.push("```"); }

  const cname = `Verify GmbH ${Date.now()}`;
  const gisa = `GISA${Date.now()}`;
  const cCreate = await fetchJSON(`${BASE}/companies`, {
    method: "POST", ...H({ "x-tenant-id": tenant.tenantId, "Content-Type": "application/json" }),
    body: JSON.stringify({ companyId: gisa, legalName: cname, address: "Teststrasse 1, 1010 Wien" })
  });
  lines.push(`- create status: ${cCreate.status}`);
  if (cCreate.status !== 201) { lines.push("```json"); lines.push(JSON.stringify(cCreate.body, null, 2)); lines.push("```"); }
  const newCompanyId = cCreate.body?.company?.companyId;

  if (newCompanyId) {
    const cDetail = await fetchJSON(`${BASE}/companies/${newCompanyId}`, H({ "x-tenant-id": tenant.tenantId }));
    lines.push(`- detail status: ${cDetail.status}, officers=${(cDetail.body.company?.officers || []).length}, shareholders=${(cDetail.body.company?.shareholders || []).length}, docs=${(cDetail.body.company?.documents || []).length}`);
  }

  // 4) OUs: list → create → update → delete (best-effort)
  lines.push(`\n## OUs`);
  const ouList = await fetchJSON(`${BASE}/ous`, H({ "x-tenant-id": tenant.tenantId }));
  lines.push(`- list status: ${ouList.status}, count=${(ouList.body.items || []).length}`);
  const ouName = `OU ${new Date().toLocaleTimeString()}`;
  const ouCreate = await fetchJSON(`${BASE}/ous`, { method: "POST", ...H({ "x-tenant-id": tenant.tenantId, "Content-Type": "application/json" }), body: JSON.stringify({ name: ouName }) });
  lines.push(`- create status: ${ouCreate.status}`);
  const ouId = ouCreate.body?.ou?.id;
  if (ouId) {
    const ouUpdate = await fetchJSON(`${BASE}/ous/${ouId}`, { method: "PUT", ...H({ "x-tenant-id": tenant.tenantId, "Content-Type": "application/json" }), body: JSON.stringify({ name: `${ouName}*` }) });
    lines.push(`- update status: ${ouUpdate.status}`);
    const ouDelete = await fetchJSON(`${BASE}/ous/${ouId}`, { method: "DELETE", ...H({ "x-tenant-id": tenant.tenantId }) });
    lines.push(`- delete status: ${ouDelete.status}`);
  }

  // done
  fs.writeFileSync(REPORT, lines.join("\n"));
  console.log(path.resolve(REPORT));
  const passed = health.status === 200 && (cCreate.status === 201 || newCompanyId) && ouList.status === 200;
  console.log(`RESULT: ${passed ? "PASSED" : "PARTIAL"}`);
}

main().catch(e => {
  try {
    fs.writeFileSync(REPORT, `# MP-18 Verify Report\n- error: ${e?.message || String(e)}`);
  } catch { }
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
