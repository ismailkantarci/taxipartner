import { execSync } from "node:child_process";
const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run db:restore -- <backup.sql>");
  process.exit(1);
}
execSync(`psql "postgresql://tpuser:tppass@localhost:5432/taxipartner" -f "${file}"`, { stdio: "inherit" });
console.log("Restore done.");
