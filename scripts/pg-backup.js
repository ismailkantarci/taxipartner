import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve("backups");
mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const file = resolve(outDir, `taxipartner-${ts}.sql`);

execSync(`pg_dump "postgresql://tpuser:tppass@localhost:5432/taxipartner" -F p -f "${file}"`, { stdio: "inherit" });
console.log("Backup created:", file);
