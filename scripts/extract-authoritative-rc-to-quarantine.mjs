import { readFile } from "node:fs/promises";
import { requireRcIdentity } from "./lib/rc-identity.mjs";
import { extractVerifiedArchiveToQuarantine, loadJson } from "./lib/quarantine-extraction.mjs";

const [archivePath, inventoryPath, planPath, destination] = process.argv.slice(2);
if (!archivePath || !inventoryPath || !planPath || !destination) {
  console.error("Usage: node scripts/extract-authoritative-rc-to-quarantine.mjs <RC.zip> <rc-inventory.json> <rc-reconciliation-plan.json> <quarantine-destination>");
  process.exit(2);
}

try {
  const contract = await loadJson("docs/QUARANTINE_EXTRACTION_CONTRACT.json");
  if (contract.extractionAuthorized !== true) {
    throw new Error("QUARANTINE_EXTRACTION_FAIL: real authoritative RC extraction is not authorized by the checked-in contract");
  }
  const rcGate = await loadJson("docs/AUTHORITATIVE_RC_GATE.json");
  const intake = await loadJson("docs/RC_INTAKE_SAFETY_CONTRACT.json");
  const identity = await requireRcIdentity(archivePath, rcGate);
  if (!identity.pass) throw new Error("QUARANTINE_EXTRACTION_FAIL: authoritative RC identity failed");
  const [archiveBuffer, inventoryReport, reconciliationPlan] = await Promise.all([
    readFile(archivePath),
    loadJson(inventoryPath),
    loadJson(planPath)
  ]);
  const manifest = await extractVerifiedArchiveToQuarantine({
    archiveBuffer,
    inventoryReport,
    reconciliationPlan,
    intakePolicy: intake.zip,
    contract,
    destination
  });
  console.log(JSON.stringify(manifest, null, 2));
  console.error(`QUARANTINE_EXTRACTION_PASS: ${manifest.extractedFileCount} files / ${manifest.extractedBytes} bytes extracted to disposable quarantine; integration and production remain unauthorized.`);
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
