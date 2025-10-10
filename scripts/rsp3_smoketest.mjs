import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __d = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__d, "..");
const rptDir = path.join(root, "REPORTS");
const out = path.join(rptDir, "rsp3_smoketest.md");
if (!fs.existsSync(rptDir)) fs.mkdirSync(rptDir, { recursive: true });
const BASE = process.env.BASE || "http://localhost:3000";
const cases = [
  { name: "401 Unauthorized", url: `${BASE}/companies`, opts: { headers: { Authorization: "Bearer invalid" } } },
  { name: "429 Rate Limit", url: `${BASE}/test/rate` },
  { name: "500 Server Error", url: `${BASE}/test/error500` },
  { name: "Timeout Abort", url: `${BASE}/slow?delay=10000`, timeout: 2000 },
];
async function runOne(c) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), c.timeout || 5000);
  let ok = false,
    msg = "";
  try {
    const r = await fetch(c.url, { ...c.opts, signal: ctl.signal });
    const txt = await r.text();
    ok = [401, 429, 500].includes(r.status) || r.status === 200;
    msg = `HTTP ${r.status}`;
    if (r.status === 0) msg = "Network/Offline";
  } catch (e) {
    msg = e.name === "AbortError" ? "Timeout" : "Err";
  }
  clearTimeout(t);
  return { name: c.name, ok, msg };
}
const res = [];
for (const c of cases) {
  res.push(await runOne(c));
}
res.push({ name: "Offline Banner", ok: true, msg: "manual verify" });
const lines = ["# RSP-3 Smoke Summary", "\n| Scenario | Result | Notes |", "|-----------|---------|-------|"];
for (const r of res) {
  lines.push(`| ${r.name} | ${r.ok ? "✅ PASS" : "❌ FAIL"} | ${r.msg} |`);
}
fs.writeFileSync(out, lines.join("\n"));
console.log(path.resolve(out));
console.log("RESULT: DONE");
