export type CanonicalStatus = {
  state: "ready" | "pending" | "blocked";
  baseline: number | null;
  message: string;
};

const EXPECTED_BASELINE = 550;

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

    const manifest = (await response.json()) as { canonicalBaseline?: number; approved?: boolean };
    if (manifest.canonicalBaseline !== EXPECTED_BASELINE || manifest.approved !== true) {
      return {
        state: "blocked",
        baseline: manifest.canonicalBaseline ?? null,
        message: "Canonical manifest failed the controlled-import gate.",
      };
    }

    return {
      state: "ready",
      baseline: EXPECTED_BASELINE,
      message: "Canonical 550 manifest passed the clean-room import gate.",
    };
  } catch {
    return {
      state: "pending",
      baseline: null,
      message: "Canonical data remains isolated until the verified RC source is imported.",
    };
  }
}
