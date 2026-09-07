import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { payloadSha256, sha256, validateStagingBundle } from "./lib/canonical-ingestion.mjs";

const contract = JSON.parse(await readFile("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));
const gate = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const authorizedGate = { ...gate, integrationAuthorized: true };
const root = await mkdtemp(join(tmpdir(), "ramaverse-canonical-ingestion-"));

async function writeBundle({ duplicateSecondRecord = false } = {}) {
  await rm(root, { recursive: true, force: true });
  await mkdir(join(root, "collections"), { recursive: true });

  const records = [];
  for (let index = 0; index < contract.expectedCanonicalBaseline; index += 1) {
    const payload = { syntheticFixture: true, ordinal: index };
    records.push({
      recordId: duplicateSecondRecord && index === 1 ? "synthetic-0" : `synthetic-${index}`,
      collection: "synthetic-fixture",
      sourcePath: `fixture/source-${index}.json`,
      payloadSha256: payloadSha256(payload),
      payload,
    });
  }

  const collectionText = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const collectionFile = "collections/synthetic-fixture.jsonl";
  await writeFile(join(root, collectionFile), collectionText);

  const manifest = {
    schemaVersion: contract.schemaVersion,
    project: contract.project,
    sourceArchive: { ...contract.expectedSourceArchive },
    canonicalBaseline: contract.expectedCanonicalBaseline,
    recordCount: contract.expectedCanonicalBaseline,
    integrationAuthorized: true,
    publicationState: contract.publicationStateRequired,
    reconciliation: { ...contract.reconciliationMustEqual },
    collections: [
      {
        id: "synthetic-fixture",
        file: collectionFile,
        recordCount: records.length,
        sha256: sha256(Buffer.from(collectionText)),
      },
    ],
  };
  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

try {
  await writeBundle();
  const valid = await validateStagingBundle({ stagingRoot: root, contract, gate: authorizedGate });
  if (valid.totalRecords !== 550 || valid.uniqueRecordIds !== 550) {
    throw new Error("synthetic positive fixture did not validate exactly 550 unique records");
  }

  await writeBundle({ duplicateSecondRecord: true });
  let duplicateRejected = false;
  try {
    await validateStagingBundle({ stagingRoot: root, contract, gate: authorizedGate });
  } catch (error) {
    duplicateRejected = String(error).includes("duplicate global recordId");
  }
  if (!duplicateRejected) throw new Error("duplicate global recordId fixture was not rejected");

  console.log("CANONICAL_INGESTION_SELFTEST_PASS");
  console.log("SYNTHETIC_VALID_RECORDS=550");
  console.log("DUPLICATE_ID_REJECTION=PASS");
} finally {
  await rm(root, { recursive: true, force: true });
}
