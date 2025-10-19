import process from "node:process";
import "../env.js";
import { importOfficialRegisters } from "./fnGisaImporter.js";

async function main() {
  const [, , ...args] = process.argv;
  let source: string | undefined;
  const rest: string[] = [];
  for (const arg of args) {
    if (!source && !arg.startsWith("-")) {
      source = arg;
    } else {
      rest.push(arg);
    }
  }
  const dryRun = rest.includes("--dryRun") || rest.includes("--dry-run");

  const report = await importOfficialRegisters({ source: source ?? "data/registers", dryRun });

  console.log("=== Import Report ===");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("Import failed", error);
  process.exitCode = 1;
});
