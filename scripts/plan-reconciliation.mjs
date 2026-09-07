import { readFile } from "node:fs/promises";
import { buildReconciliationPlan } from "./lib/reconciliation-plan.mjs";

const inventoryPath = process.argv[2];
if (!inventoryPath) {
  console.error("Usage: node scripts/plan-reconciliation.mjs <rc-inventory.json>");
  process.exit(2);
}

try {
  const contract = JSON.parse(await readFile("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const plan = buildReconciliationPlan(inventory, contract);
  console.log(JSON.stringify(plan, null, 2));
  console.error(`RECONCILIATION_PREP_PASS: ${plan.inventoryEntryCount} inventory entries classified; extraction/integration remain unauthorized; blockers=${plan.summary.blockers}; planSha256=${plan.planSha256}`);
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
