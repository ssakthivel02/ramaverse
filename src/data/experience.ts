export type ExperienceModule = {
  title: string;
  description: string;
  status: "shell-ready" | "canonical-required";
};

export type ExperienceDefinition = {
  headline: string;
  promise: string;
  modules: ExperienceModule[];
};

const module = (title: string, description: string, status: ExperienceModule["status"] = "canonical-required"): ExperienceModule => ({
  title,
  description,
  status,
});

export const experiences: Record<string, ExperienceDefinition> = {
  "/knowledge": {
    headline: "A governed gateway into the RamaVerse knowledge universe.",
    promise: "Browse by narrative, person, place, learning pathway or source status without collapsing editorial context into generated interpretation.",
    modules: [
      module("Seven-Kanda navigator", "Structured entry across the seven Kandas.", "shell-ready"),
      module("Source status", "Keep provenance and review state visible beside knowledge surfaces.", "shell-ready"),
      module("Canonical discovery", "Populate verified records only after the 550-record import gate passes."),
      module("Cross-links", "Connect characters, places, events and learning surfaces after governed data import."),
    ],
  },
  "/kandas": {
    headline: "Seven narrative worlds, one governed reading path.",
    promise: "A dedicated Kanda experience with space for summaries, source-aware Sarga navigation and connected entities once the authoritative corpus is restored.",
    modules: [
      module("Kanda constellation", "Seven-Kanda navigation is available in the clean-room shell.", "shell-ready"),
      module("Sarga pathways", "Source-linked Sarga reading remains gated until canonical import."),
      module("Character context", "Relationship context will resolve from approved canonical records."),
      module("Journey context", "Geographic links will resolve only from governed source data."),
    ],
  },
  "/wisdom": {
    headline: "Teachings with source, context and reflection kept distinct.",
    promise: "The interface is designed so a user can tell what comes from a source, what is editorial context and what is reflective guidance.",
    modules: [
      module("Source text lane", "Reserved for approved canonical material."),
      module("Context lane", "Editorial context remains visibly separate from source material.", "shell-ready"),
      module("Reflection lane", "Generated or interpretive reflection is explicitly labelled.", "shell-ready"),
      module("Save & revisit", "Collection hooks are prepared for a later persistence layer.", "shell-ready"),
    ],
  },
  "/characters": {
    headline: "A constellation of people, relationships and narrative roles.",
    promise: "Profiles are structured for relationships, appearances, places, events and source references without inventing missing canonical details.",
    modules: [
      module("Character index", "Profile shell and discovery structure are ready.", "shell-ready"),
      module("Relationship graph", "Edges require verified canonical entity IDs."),
      module("Narrative appearances", "Kanda/Sarga links require restored source records."),
      module("Source provenance", "Every canonical profile should expose evidence and review state."),
    ],
  },
  "/places": {
    headline: "Sacred geography connected to narrative context.",
    promise: "The place model separates textual provenance, traditional identification and modern geographic interpretation where certainty differs.",
    modules: [
      module("Place explorer", "Responsive discovery shell is ready.", "shell-ready"),
      module("Journey links", "Connections require approved place/event records."),
      module("Evidence status", "The design supports explicit confidence and provenance.", "shell-ready"),
      module("Map layer", "Map coordinates remain gated until verified location data is imported."),
    ],
  },
  "/guidance": {
    headline: "Practical reflection without presenting interpretation as scripture.",
    promise: "Guidance is bounded by source status and should never hide the distinction between textual evidence, editorial synthesis and generated reflection.",
    modules: [
      module("Life themes", "Theme navigation shell is ready.", "shell-ready"),
      module("Source anchors", "Guidance-to-source links require approved records."),
      module("Reflection prompts", "Non-canonical prompts can remain visibly labelled.", "shell-ready"),
      module("Safety boundary", "No guaranteed outcomes or fabricated source claims.", "shell-ready"),
    ],
  },
  "/stories": {
    headline: "Family-friendly pathways through governed RamaVerse material.",
    promise: "Story experiences are designed for accessibility and learning while retaining provenance and avoiding silent rewriting of canonical source material.",
    modules: [
      module("Story library", "Card and reading shell is ready.", "shell-ready"),
      module("Age-aware presentation", "Presentation controls can be layered without altering source records.", "shell-ready"),
      module("Source references", "Canonical story provenance requires restored records."),
      module("Learning follow-up", "Quiz and discussion links can attach to approved story IDs."),
    ],
  },
  "/quizzes": {
    headline: "Learning checks tied back to governed knowledge.",
    promise: "Assessment UX is separated from canonical content so question banks can be reconciled before becoming authoritative.",
    modules: [
      module("Quiz engine shell", "Scoring and interaction surface is reserved.", "shell-ready"),
      module("Canonical question bank", "Questions remain blocked until the authoritative 550 pack is imported."),
      module("Explanations", "Answer explanations must cite governed source context."),
      module("Progress model", "Local progress can be introduced independently of canonical mutation.", "shell-ready"),
    ],
  },
  "/audio": {
    headline: "Listen, learn and follow along with provenance intact.",
    promise: "Audio experiences will bind licensed/approved media to source-aware reading surfaces rather than embedding unknown third-party assets.",
    modules: [
      module("Audio player shell", "Media UX can be integrated without canonical mutation.", "shell-ready"),
      module("Track provenance", "Every audio asset needs source/rights metadata."),
      module("Text sync", "Source-linked synchronization requires approved text records."),
      module("Offline policy", "Only explicitly permitted media should enter offline packs.", "shell-ready"),
    ],
  },
  "/search": {
    headline: "Search the interface now; search the canon only after verification.",
    promise: "The clean-room build already supports route discovery. Canonical full-text/entity search remains deliberately closed until the verified corpus is present.",
    modules: [
      module("Experience search", "Route and capability discovery is live in this build.", "shell-ready"),
      module("Canonical search", "Record search activates only after controlled corpus import."),
      module("Entity filters", "Character/place/Kanda filters require approved entity metadata."),
      module("Source filters", "Review and provenance filters are part of the target contract.", "shell-ready"),
    ],
  },
  "/ask": {
    headline: "An answer interface that refuses to hallucinate a missing canon.",
    promise: "Users may compose a question, but RamaVerse will not synthesize a canonical answer until the trusted corpus passes the import gate.",
    modules: [
      module("Question composer", "Bounded input UX is available.", "shell-ready"),
      module("Source-backed answer", "Answer generation remains disabled without approved canonical context."),
      module("Confidence boundary", "The answer contract reserves explicit confidence/source visibility.", "shell-ready"),
      module("No-source refusal", "The system should refuse rather than fabricate unavailable source evidence.", "shell-ready"),
    ],
  },
  "/intelligence": {
    headline: "Discovery built on governed evidence, not opaque synthesis.",
    promise: "Intelligence surfaces are reserved for relationships, themes and retrieval over approved RamaVerse data.",
    modules: [
      module("Theme explorer", "Interaction shell is ready.", "shell-ready"),
      module("Relationship reasoning", "Requires approved entities and edges."),
      module("Source trace", "Every derived connection should remain traceable.", "shell-ready"),
      module("Generated insight", "Any synthesis must be labelled as generated rather than canonical.", "shell-ready"),
    ],
  },
  "/library": {
    headline: "A personal reading layer without mutating the canon.",
    promise: "Bookmarks, collections and reading history can remain user-owned overlays on top of immutable approved records.",
    modules: [
      module("Collections", "Collection UX is prepared.", "shell-ready"),
      module("Bookmarks", "Bookmark state can remain separate from canonical records.", "shell-ready"),
      module("Reading history", "Persistence can be layered later with privacy controls.", "shell-ready"),
      module("Canonical references", "Saved items require stable IDs from the restored corpus."),
    ],
  },
  "/journey": {
    headline: "Traverse RamaVerse as narrative and geography.",
    promise: "The journey experience is designed to combine narrative stages with governed location and event evidence.",
    modules: [
      module("Journey rail", "Responsive journey presentation is prepared.", "shell-ready"),
      module("Event stops", "Stops require approved canonical event IDs."),
      module("Place evidence", "Locations require governed provenance."),
      module("Connected reading", "Kanda/Sarga transitions depend on restored source links."),
    ],
  },
  "/timeline": {
    headline: "Sequence events without pretending interpretive chronology is certain.",
    promise: "The timeline contract can distinguish source ordering from later chronology models and uncertainty.",
    modules: [
      module("Narrative order", "Timeline UI foundation is ready.", "shell-ready"),
      module("Event records", "Canonical event sequence requires authoritative IDs."),
      module("Chronology confidence", "Interpretive dating can carry explicit confidence.", "shell-ready"),
      module("Source links", "Every canonical event should resolve to governed evidence."),
    ],
  },
  "/knowledge-graph": {
    headline: "Relationships become navigable only when their evidence is known.",
    promise: "The graph contract supports entities and typed relationships while keeping unverified edges out of the canonical layer.",
    modules: [
      module("Graph canvas", "Graph experience shell is prepared.", "shell-ready"),
      module("Entity nodes", "Canonical nodes require restored stable IDs."),
      module("Typed edges", "Relationships require approved provenance."),
      module("Evidence inspector", "The target interaction exposes source status for graph claims.", "shell-ready"),
    ],
  },
  "/rama-life": {
    headline: "Reflect on themes without collapsing devotion, ethics and source text.",
    promise: "Practical learning pathways remain clearly separated from canonical source records.",
    modules: [
      module("Theme pathways", "Experience shell is ready.", "shell-ready"),
      module("Source anchors", "Canonical anchors await verified import."),
      module("Reflection notes", "User reflection can remain private and non-canonical.", "shell-ready"),
      module("Guidance boundaries", "Interpretation is never presented as guaranteed outcome or source text.", "shell-ready"),
    ],
  },
  "/walk-with-rama": {
    headline: "A guided narrative experience designed for deliberate pacing.",
    promise: "The walkthrough shell can sequence approved narrative steps after the canonical event model is restored.",
    modules: [
      module("Step navigator", "Interaction pattern is prepared.", "shell-ready"),
      module("Narrative steps", "Canonical step content awaits approved records."),
      module("Context cards", "Editorial context remains visually distinct.", "shell-ready"),
      module("Resume state", "Progress can be user-owned rather than canonical.", "shell-ready"),
    ],
  },
  "/experience": {
    headline: "A home for premium interactive RamaVerse experiences.",
    promise: "Immersive features can be built independently while canonical material remains behind the controlled import boundary.",
    modules: [
      module("Immersive journeys", "Experience framework is ready.", "shell-ready"),
      module("Character constellations", "Canonical entity content awaits verified import."),
      module("Sacred geography", "Map evidence remains governed."),
      module("Learning labs", "Interactive learning modules can attach to approved content IDs."),
    ],
  },
  "/sargas": {
    headline: "A reading workspace built for source fidelity.",
    promise: "Sarga reading will activate only from the authoritative source package; this branch will not regenerate missing text.",
    modules: [
      module("Reader shell", "Reading layout is prepared.", "shell-ready"),
      module("Sarga index", "Canonical Sarga inventory requires authoritative source data."),
      module("Source metadata", "Edition/provenance metadata is part of the reading contract.", "shell-ready"),
      module("Cross-reference", "Characters, places and themes attach only through approved IDs."),
    ],
  },
  "/sources": {
    headline: "The trust layer behind every canonical claim.",
    promise: "RamaVerse treats provenance, review status, rights and corpus integrity as product features rather than hidden administration.",
    modules: [
      module("Canonical baseline", "Expected governed baseline is fixed at 550 until reconciled.", "shell-ready"),
      module("Import evidence", "Archive integrity and manifest evidence are required before activation.", "shell-ready"),
      module("Rights status", "Media/source rights must be explicit before publication.", "shell-ready"),
      module("Change control", "Canonical changes require deliberate reconciliation, never silent replacement.", "shell-ready"),
    ],
  },
};

export const kandaNames = [
  "Bala Kanda",
  "Ayodhya Kanda",
  "Aranya Kanda",
  "Kishkindha Kanda",
  "Sundara Kanda",
  "Yuddha Kanda",
  "Uttara Kanda",
] as const;
