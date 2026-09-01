# RamaVerse — Merge & Verification Report

Everything in this document was actually run, not inspected-and-assumed.
Commands and their real output are in the "Test Report" section — copy them
yourself to reproduce.

---

## 1. Content Merge Report

| Collection | Kimi source | Pre-existing Claude data | Merged result | Notes |
|---|---|---|---|---|
| Kandas | 7 (rich: sarga_count, core_theme, values, key_characters) | 7 (thin) | **7** | Kimi version adopted as base; `isTraditionallyDebated` flag on Uttara Kanda preserved from the original app |
| Sargas | 12 | 0 | **12** | New collection. Starter sample only — a full Ramayana has ~650+ sargas across all Kandas; this is not that |
| Verses | 8 | 0 | **8** | New collection, rich schema (Sanskrit, transliteration, poetic/simple Tamil, deep/kids explanations). Starter sample only — full Ramayana is ~24,000 verses |
| Characters | 50 | 20 (subset, same names) | **50** | Kimi's 50 fully supersede the earlier 20 — same characters, richer fields (traits, family relations, kids description, search tags) |
| Places | 25 | 15 (subset) | **25** | Same pattern as characters |
| Daily quotes | 30 (verse-sourced) | 28 (hand-written, day-theme cycling) | **108** | See note below — this number needs a caveat |
| Life guidance | 23 | 27 (full 27-category coverage from the brief) | **27** | Kept full category coverage; merged in Kimi's richer per-topic fields (search keywords, difficulty, related verses) |
| Kids stories | 30 | 0 (stub only) | **30** | New collection — this is what made a real Kids Mode buildable this pass |
| Audio scripts | 10 | 0 | **10** | New collection. Not yet wired into the app — see Known Issues |

**Caveat on the "108 daily quotes" number:** the brief's MVP target was 108
quotes and the merged file has exactly 108 records — but **78 of those 108
have an empty `reflection` field**, tagged `needsReflectionAuthoring: true`.
Counting them as "done" would be the "just say done" failure mode this
project explicitly warned against. They exist, are structurally valid, and
have real Tamil+English quote text — they're missing the reflection prompt
that pairs with each quote. Treat this as 30 complete + 78 partially
authored, not 108 complete.

---

## 2. Duplicate Removal Report

- **Characters/Places:** name-matched (case-insensitive English name) between
  Kimi's set and the pre-existing 20/15. Zero non-overlapping names found —
  every character and place in the old set already existed in Kimi's set
  under the same identity, just with thinner data. Result: old records
  dropped entirely in favor of Kimi's richer versions, zero duplicate IDs
  in the merged files.
- **Life guidance:** matched by category concept (e.g. Kimi's "Job
  Interview" vs. the old "Job and career"). Where both existed, Kimi's
  richer version won; the old set's full 27-category coverage was kept
  where Kimi didn't have an equivalent, so no category from the original
  brief list was dropped.
- **Quotes:** not de-duplicated against each other by content-similarity —
  the old 28 hand-written quotes and Kimi's 30 verse-sourced quotes don't
  overlap in phrasing (different provenance), so both sets were kept as
  complementary rather than run through fuzzy text-matching, which risks
  false positives/negatives more than it's worth here.
- **Verified:** no duplicate `id` values within any single collection
  (checked programmatically, not by eye).

---

## 3. Copyright / Source Report

Sourced directly from `RamaVerse_Ramayana_Source_Document.docx`
("Source and Copyright Report" section) — this is Kimi's own documentation,
not something I'm asserting independently:

| Content type | Source | Copyright |
|---|---|---|
| Sanskrit verses | Valmiki Ramayana | Public domain (ancient text) |
| English translation | Griffith translation (1870–1874), modified | Public domain |
| Tamil meanings/summaries | RamaVerse original | Original — RamaVerse IP, pending human review |
| Children's stories | RamaVerse original | Original — RamaVerse IP |
| Life guidance, character/place profiles, audio scripts | RamaVerse original | Original — RamaVerse IP |

**Explicitly stated in the source doc as NOT used:** no Goldman or Pattanaik
translations, no Kamban excerpts, no modern Tamil commentaries, no scraped
website content, no reproduced PDF/book content. I did not independently
verify this against the original Griffith text or cross-check every English
translation line-by-line — I'm reporting what the source document asserts,
not something I fact-checked myself. If this compliance posture needs to
hold up to outside scrutiny, that line-by-line check is real work someone
should still do.

**Every record in every merged file now carries** `source_reference`,
`copyright_status`, and `review_status` fields — this was a gap in the raw
Kimi export (some collections had it per-record, e.g. `verses.json`; others
didn't, e.g. `characters.json`, `places.json`) and is now consistent across
all nine collections.

---

## 4. Tamil Review Pending List

Per the source doc's own "Items Requiring Human Tamil Review" section, plus
what I found while merging:

**Priority 1 — before any release:**
- All Tamil verse translations and "poetic"/"simple" meaning fields (8 verses)
- All character/place/kanda Tamil descriptions (82 records — see the
  correction below)
- Kids story Tamil translations (30 stories)
- Audio script Tamil phonetics (10 scripts)

**Priority 2 — content gaps found during this merge, not in the original
Kimi documentation:**
- **78 of 108 daily quotes have no reflection text at all** (English or
  Tamil) — `needsReflectionAuthoring: true` on each. This is the single
  biggest content gap right now.
- **Life guidance category names, event descriptions, and reflections have
  no Tamil version** — only the `explanation_ta`/`explanation_en` pair is
  bilingual; `category_name`, `event_description`, and `reflection` are
  English-only across all 27 records. I added Tamil category labels myself
  (27 short phrases) as a stopgap since that's low-risk; I did **not**
  write Tamil event descriptions or reflections — that's exactly the kind
  of prose that needs a real Tamil speaker, not a quick fill-in.

**Compliance correction I made:** `characters.json` (50 records),
`kandas.json` (7 records), and `places.json` (25 records) were marked
`review_status: "reviewed"` in the merged data. No human Tamil reviewer has
actually reviewed this content — the source doc itself says this review
hasn't happened yet. I corrected all 82 records back to
`needs_human_tamil_review`. Shipping with a false "reviewed" flag risks the
real review step getting skipped.

---

## 5. Test Report — commands actually run, actual output

```
$ npm install
added 1395 packages in 2m                                    -> PASSED

$ npx tsc --noEmit
(clean, exit 0)                                               -> PASSED
  (found 1 real error first: HomeScreen accessed .characterId on
   a JSON-inferred union type where not every quote has that field --
   fixed by casting the import to the DailyQuote type)

$ npx eslint . --ext .ts,.tsx
(clean, exit 0)                                               -> PASSED
  (initially failed -- no .eslintrc existed despite eslint-config-expo
   being listed as a dependency; added .eslintrc.js)

$ npx expo-doctor
13/18 passed. 5 failed:
  - 3 failures are network calls to Expo's own API servers, which this
    sandbox can't reach (confirmed: same "Host not in allowlist" pattern
    as every other blocked domain) -- NOT verified either way
  - 2 failures were real: expo-router was missing its required peer deps
    expo-constants and expo-linking. Fixed -- see below.

$ npx expo export --platform web  (with EXPO_OFFLINE=1 to route around
                                    the network-blocked dependency check)
Attempt 1: CommandError -- react-native-web missing entirely  -> FIXED (installed)
Attempt 2: Error -- expo-asset cannot be found                -> FIXED (installed)
Attempt 3: Error -- expo-font/build/server not resolvable      -> FIXED (installed expo-font)
Attempt 4: Metro error -- Cannot read properties of undefined
           ('replace') in expo-sqlite pathUtils.js, called from
           offlineCache.ts at module load                     -> FIXED (see below)
Attempt 5: SUCCESS -- 18/18 routes exported cleanly to dist/    -> PASSED
```

**The Attempt 4 fix is the important one.** `expo-sqlite` has no web
implementation. `offlineCache.ts` called `SQLite.openDatabaseSync()`
unconditionally at module load, and `_layout.tsx` imports that module — so
expo-router's static web rendering crashed immediately, every time, for
every route. This would have silently blocked Web/PWA — one of the three
platforms explicitly required — the moment anyone actually tried to export
for web. Fixed with a platform-aware backend: native builds keep SQLite,
web uses `localStorage` (with an in-memory fallback for the server-side
static-render pass, which runs in a non-browser context where
`localStorage` doesn't exist yet). Same public API, nothing else in the
app had to change.

**Dependency corrections made along the way** (all confirmed against
Expo SDK 52's actual bundled versions, not just "latest" — `npm install`
alone grabbed `expo-constants@^57` / `expo-linking@^57`, which are for a
much newer SDK generation and would have broken the real native build even
though they resolved fine for typechecking):

| Package | Wrong version npm grabbed | Correct version installed |
|---|---|---|
| expo-constants | ^57.0.3 | ~17.0.3 |
| expo-linking | ^57.0.1 | ~7.0.3 |
| expo-asset | (missing entirely) | ~11.0.1 |
| expo-font | (missing entirely) | ~13.0.1 |
| react-native-web | (missing entirely) | ~0.19.13 |
| react-dom | (missing entirely) | ^18.3.1 |

**Not verified — genuinely can't be, from this sandbox:**
- `eas build` (Android AAB) — needs Expo's build servers
- Actual device/emulator launch, app store submission, DNS/domain changes
- Firebase deploy
- `npm test` — no test files exist yet, so there's nothing to run

---

## 6. Known Issues (updated)

**Content:**
- 78/108 daily quotes need reflection text authored (English + Tamil)
- Life-guidance event descriptions and reflections are English-only (27 records)
- Sargas (12) and verses (8) are starter samples, not the full Ramayana structure
- Audio scripts (10) exist as data but aren't wired into any screen yet —
  `AudioButton` still does live TTS via `expo-speech` rather than using
  these authored scripts
- 82 records had a false "reviewed" compliance flag, now corrected (see
  Tamil Review Pending List)

**Engineering:**
- Fixed this pass: the daily-quote/kids-story/place "of the day" picker used
  `Date.getDay() % array.length` — since `getDay()` only returns 0–6, this
  never reached index 7+ no matter how large the arrays grew. Now uses
  day-of-year cycling (`src/utils/dailyCycle.ts`).
- Fixed this pass: Home was fetching `kidsStory` data but never rendering
  it — the required "Kids Story of the Day" section didn't exist on screen
  despite the brief listing it.
- Fixed this pass: `offlineCache.ts` broke the entire web build (see Test
  Report §5).
- Fixed this pass: missing peer/required dependencies (expo-constants,
  expo-linking, expo-asset, expo-font, react-native-web, react-dom).
- **Not done this pass:** the premium interactive website (hover-reveal
  cards, animated hero, AI search chips, Framer Motion/Reanimated
  micro-interactions, the Ayodhya→Lanka journey map). This is a genuinely
  separate, large front-end effort from the content-layer merge and bug
  fixes done here — see roadmap.
- DNS registration, actual `eas build`, Firebase deploy, and Play Store
  submission cannot be executed from this sandbox (no network path to
  Expo's build servers, Firebase, your DNS provider, or the Play Console).

---

## 7. Next Roadmap

1. Author the 78 missing quote reflections (content, not code)
2. Author Tamil event descriptions/reflections for the 27 life-guidance topics
3. Build the premium interactive website pass (hero, hover-reveal cards,
   AI search chip UI, journey map) — separate scope from this session
4. Wire audio_scripts.json into AudioButton/DailyQuoteScreen as the
   preferred narration source over live TTS where a script exists
5. Human Tamil review pass across all 89 flagged records (verses excluded,
   already tracked separately)
6. Real device testing once you run `eas build` yourself
7. Firestore sync, quiz scoring, DNS + deploy (see Deployment Guide)
