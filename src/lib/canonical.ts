export type CanonicalStatus = {
  state: "ready" | "pending" | "blocked";
  baseline: number | null;
  message: string;
};

type CanonicalManifest = {
  schemaVersion?: number;
  project?: string;
  sourceArchive?: {
    name?: string;
    sha256?: string;
    bytes?: number;
  };
  canonicalBaseline?: number;
  recordCount?: number;
  integrationAuthorized?: boolean;
  publicationState?: string;
  reconciliation?: {
    missingRecords?: number;
    duplicateRecordIds?: number;
    malformedRecords?: number;
    hashMismatches?: number;
  };
  collections?: Array<{
    id?: string;
    file?: string;
    recordCount?: number;
    sha256?: string;
  }>;
};

const EXPECTED_BASELINE = 550;
const EXPECTED_ARCHIVE = "RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip";
const EXPECTED_ARCHIVE_SHA256 = "fccb48547e795c1927453fe838e5ec745c71bfe80702bb246a40cd0c66b94983";
const EXPECTED_ARCHIVE_BYTES = 5_311_980;
const SHA256_RE = /^[a-f0-9]{64}$/;

function manifestPassesControlledPublication(manifest: CanonicalManifest): boolean {
  if (manifest.schemaVersion !== 1 || manifest.project !== "RamaVerse") return false;
  if (manifest.sourceArchive?.name !== EXPECTED_ARCHIVE) return false;
  if (manifest.sourceArchive?.sha256 !== EXPECTED_ARCHIVE_SHA256) return false;
  if (manifest.sourceArchive?.bytes !== EXPECTED_ARCHIVE_BYTES) return false;
  if (manifest.canonicalBaseline !== EXPECTED_BASELINE || manifest.recordCount !== EXPECTED_BASELINE) return false;
  if (manifest.integrationAuthorized !== true || manifest.publicationState !== "validated") return false;

  const reconciliation = manifest.reconciliation;
  if (
    reconciliation?.missingRecords !== 0 ||
    reconciliation?.duplicateRecordIds !== 0 ||
    reconciliation?.malformedRecords !== 0 ||
    reconciliation?.hashMismatches !== 0
  ) {
    return false;
  }

  if (!Array.isArray(manifest.collections) || manifest.collections.length === 0) return false;
  const ids = new Set<string>();
  let total = 0;
  for (const collection of manifest.collections) {
    if (!collection.id || ids.has(collection.id)) return false;
    ids.add(collection.id);
    if (!collection.file?.startsWith("collections/") || !collection.file.endsWith(".jsonl") || collection.file.includes("..")) return false;
    if (!Number.isInteger(collection.recordCount) || (collection.recordCount ?? -1) < 0) return false;
    if (!SHA256_RE.test(collection.sha256 ?? "")) return false;
    total += collection.recordCount ?? 0;
  }

  return total === EXPECTED_BASELINE;
}

export async function readCanonicalStatus(): Promise<CanonicalStatus> {
  try {
    const response = await fetch("/data/canonical-manifest.json", { cache: "no-store" });
    if (!response.ok) {
      return {
        state: "pending",
        baseline: null,
        message: "Canonical 550 pack has not been imported into this clean-room branch.",
      };
    }

    const manifest = (await response.json()) as CanonicalManifest;
    if (!manifestPassesControlledPublication(manifest)) {
      return {
        state: "blocked",
        baseline: manifest.canonicalBaseline ?? null,
        message: "Canonical manifest failed the provenance, authorization, reconciliation, or integrity contract.",
      };
    }

    return {
      state: "ready",
      baseline: EXPECTED_BASELINE,
      message: "Canonical 550 manifest passed the controlled publication contract.",
    };
  } catch {
    return {
      state: "pending",
      baseline: null,
      message: "Canonical data remains isolated until the verified RC source is imported and reconciled.",
    };
  }
}
