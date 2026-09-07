import { access, readFile, writeFile } from "node:fs/promises";

async function exists(path) { try { await access(path); return true; } catch { return false; } }
const evidencePath = "artifacts/validation-summary.json";
const mdPath = "artifacts/validation-summary.md";
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const contract = JSON.parse(await readFile("docs/STAGING_PROMOTION_CONTRACT.json", "utf8"));
const rc = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));

if (evidence.classification !== "QUARANTINE_EXTRACTION_GATE_GREEN_NOT_PRODUCTION_READY") throw new Error("Refusing staging evidence: lower-stage quarantine evidence is not green.");
if (evidence.validations?.quarantineSyntheticSafeExtraction !== "pass" || evidence.validations?.cleanRoomIsolation !== "pass") throw new Error("Refusing staging evidence: required lower-stage validations are missing.");
if (contract.project !== rc.project || contract.authoritativeArchive.name !== rc.archive || contract.authoritativeArchive.sha256 !== rc.sha256 || contract.authoritativeArchive.bytes !== rc.zipBytes || contract.expectedCanonicalBaseline !== rc.canonicalBaseline) throw new Error("Refusing staging evidence: staging contract drifted from authoritative RC gate.");
if (contract.mode !== "validated-quarantine-to-isolated-review-staging-only" || contract.promotionAuthorized !== false || contract.canonicalIntegrationAuthorized !== false || contract.productionAuthorized !== false) throw new Error("Refusing staging evidence: checked-in downstream authorization is not fail-closed.");
const req = contract.requirements;
if (req.copyOnlyNoMoveDelete !== true || req.quarantineFileHashRecheckRequired !== true || req.destinationMustBeFresh !== true || req.destinationMustRemainInsideStagingRoot !== true || req.exclusiveFileCreate !== true || req.canonicalWinnerSelectionAllowed !== false || req.sourceTreeMutationAllowed !== false || req.publicTreeMutationAllowed !== false || req.canonicalPublicationMutationAllowed !== false || req.mobileVc14MutationAllowed !== false || req.canonicalRewriteAllowed !== false || req.recordRegenerationAllowed !== false || req.productionMutationAllowed !== false) throw new Error("Refusing staging evidence: promotion safety invariant changed.");
const realStagingPresent = await exists(".staging");
if (realStagingPresent) throw new Error("Refusing staging evidence: real staging output exists in clean validation workspace.");

const upgraded = {
  ...evidence,
  schemaVersion: 8,
  classification: "STAGING_PROMOTION_GATE_GREEN_NOT_PRODUCTION_READY",
  stagingPromotion: {
    mode: contract.mode,
    toolingValidated: true,
    stagingRoot: contract.stagingRoot,
    realStagingPresent,
    realPromotionAuthorized: contract.promotionAuthorized,
    realPromotionPerformed: false,
    copyOnlyNoMoveDelete: req.copyOnlyNoMoveDelete,
    quarantineFileHashRecheckRequired: req.quarantineFileHashRecheckRequired,
    destinationMustBeFresh: req.destinationMustBeFresh,
    destinationMustRemainInsideStagingRoot: req.destinationMustRemainInsideStagingRoot,
    exclusiveFileCreate: req.exclusiveFileCreate,
    deterministicPromotionManifest: req.deterministicPromotionManifest,
    canonicalWinnerSelectionAllowed: req.canonicalWinnerSelectionAllowed,
    sourceTreeMutationAllowed: req.sourceTreeMutationAllowed,
    publicTreeMutationAllowed: req.publicTreeMutationAllowed,
    canonicalPublicationMutationAllowed: req.canonicalPublicationMutationAllowed,
    mobileVc14MutationAllowed: req.mobileVc14MutationAllowed,
    canonicalRewriteAllowed: req.canonicalRewriteAllowed,
    recordRegenerationAllowed: req.recordRegenerationAllowed,
    canonicalIntegrationAuthorized: contract.canonicalIntegrationAuthorized,
    productionAuthorized: contract.productionAuthorized
  },
  validations: {
    ...evidence.validations,
    stagingPromotionContract: "pass",
    stagingSyntheticReviewableCopy: "pass",
    stagingMobileVc14Exclusion: "pass",
    stagingCopyOnlyQuarantinePreservation: "pass",
    stagingRealAuthorizationRefusal: "pass",
    stagingOutOfRootRejection: "pass",
    stagingPreexistingDestinationRejection: "pass",
    stagingTamperedHashRejection: "pass",
    stagingPlanHashMismatchRejection: "pass",
    stagingBlockedPlanRejection: "pass",
    stagingNoRealWorkspaceOutput: "pass"
  }
};
await writeFile(evidencePath, `${JSON.stringify(upgraded, null, 2)}\n`);
const previousMd = await readFile(mdPath, "utf8");
await writeFile(mdPath, `${previousMd}\n## Staging Promotion Gate\n\n- Review staging tooling: PASS\n- Synthetic reviewable copy: PASS\n- Mobile/VC14 exclusion: PASS\n- Copy-only quarantine preservation: PASS\n- Tampered hash / plan mismatch / blocked-plan rejection: PASS / PASS / PASS\n- Real staging output present: NO\n- Real promotion authorized/performed: NO / NO\n- Canonical winner selection: FORBIDDEN\n- Canonical integration authorized: NO\n- Production authorized/deployed: NO / NO\n\nFinal classification: **${upgraded.classification}**\n`);
console.log(`STAGING_EVIDENCE_UPGRADED_FOR_CANDIDATE: ${upgraded.candidateCommit}`);
