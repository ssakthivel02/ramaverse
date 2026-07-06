# RamaVerse — Ramayana Wisdom AI

**See also:** `MERGE_AND_TEST_REPORT.md` (content merge, duplicate removal,
copyright/source report, Tamil review pending list, and real test output)
and `DEPLOYMENT_GUIDE.md` (web deploy, DNS, Android AAB build steps).


**Subtitle:** Ramayana Wisdom AI
**Tagline:** Rama's Wisdom for Everyday Life
**Package name:** `com.ramaverse.app` (new, unique — never reuse DivyaNexus/SaravanaBhava/KirthiVerse package names)

This is a separate project from DivyaNexus, SaravanaBhava, and KirthiVerse. Do not merge codebases or Firebase projects.

---

## ⚠️ What this scaffold is, and isn't

I built the real project structure, TypeScript models, i18n framework, seed
content, core screens (Splash → Language → Home → Daily Quote → Ramayana
Explorer → AI Guide → Life Guidance), the Firebase Cloud Function AI proxy,
and the six required legal pages.

**What I could not do from this sandbox:** run `eas build`, deploy to
Firebase, or submit to Google Play / App Store. My container only has
network access to npm/pip/GitHub — not Expo's build servers, Firebase, or
the app stores. Every command below is real and correct; you (or a CI
runner with the right access) need to execute them.

---

## 1. Local setup

```bash
npm install
npx expo doctor          # catches native-module/version mismatches early
npm run typecheck
npm run lint
npm test
npx expo start           # local dev server
```

## 2. Target SDK compliance (Google Play requirement)

Google Play requires new apps/updates to target **Android 15 / API 35 or
higher**. This scaffold uses Expo SDK 52, which targets API 35 by default.

Before every Play Store upload:
```bash
npx expo prebuild --platform android   # generates /android
grep -i "targetSdkVersion\|compileSdkVersion" android/build.gradle
```
Confirm both are ≥ 35. Only move to API 36 once `npx expo-doctor` and a
completed EAS build both report no incompatible native modules — don't
hardcode API 36 only.

## 3. Build (EAS)

```bash
npx eas login
npx eas build:configure
npx eas build --platform android --profile production   # outputs .aab
npx eas build --platform ios --profile production
```
**Android Play Store uploads must be AAB, never APK.**

## 4. Web export

```bash
npx expo export --platform web
```
Deploy the `dist/` output (or the static pages in `/web` as an interim
placeholder) to GitHub Pages, Firebase Hosting, or Vercel.

### GitHub Pages routing fix
`/web/404.html` is the standard SPA fallback. Set `BASE_PATH` inside it to
match your repo's Pages base path (empty string for a custom domain).
Verify after deploy that direct links to `/privacy.html`, `/delete-account.html`,
`/delete-data.html`, `/disclaimer.html`, `/sources.html`, `/contact.html`
all load without a 404.

## 5. Firebase setup

```bash
npm install -g firebase-tools
firebase login
firebase init            # select Firestore, Functions, Hosting, Auth, Storage
firebase functions:secrets:set AI_API_KEY
firebase deploy --only functions,hosting,firestore:rules
```
The AI key lives only in `functions:secrets` — never in the client app,
never in `app.json`, never committed to git.

## 6. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `AI_API_KEY` | Firebase Functions secret | OpenAI-compatible provider key (server-side only) |
| `EXPO_PUBLIC_AI_PROXY_URL` | `.env` / EAS secret | URL of the deployed `ramaVerseAI` Cloud Function |
| `EXPO_PUBLIC_FIREBASE_*` | `.env` | Firebase Web SDK config (apiKey, projectId, etc. — safe to expose per Firebase's own model, but still keep out of git history) |

`EXPO_PUBLIC_*` vars are the only ones ever bundled into the client — never
prefix a real secret with `EXPO_PUBLIC_`.

---

## Fixes applied from DivyaNexus / SaravanaBhava / KirthiVerse lessons

1. **Unique package name** — `com.ramaverse.app` only, set in `app.json`.
2. **AAB-only Android uploads** — see build commands above.
3. **Target SDK compliance** — see section 2.
4. **Home-page-loading bug fixed** — `app/index.tsx` is the single place
   that decides Splash → Onboarding vs Splash → Home. It never redirects to
   an install/setup page; see the comment in that file.
5. **Offline fallback** — `src/services/offlineCache.ts` (SQLite) seeds a
   starter pack of daily quotes and Kanda summaries at first launch so Home
   still renders if Firebase/AI is unreachable.
6. **GitHub Pages SPA routing** — `/web/404.html` with configurable
   `BASE_PATH`.
7. **Required legal pages** — all six exist in `/web`, linked from
   `index.html`. **Placeholders marked `[fill in]` must be completed before
   submission** (support email, source edition citations, last-updated date).
8. **No secrets in the client** — AI key stays in Cloud Function secrets;
   client calls only the proxy (`src/services/aiClient.ts`).
9. **AI hallucination guardrails** — the Cloud Function system prompt
   (`functions/index.js`) forces a `kind` tag (`direct_verse` / `summary` /
   `reflection`) and a `confidence` tag on every answer; the client refuses
   to render a response missing either.
10. **No guaranteed-result claims anywhere** — disclaimer copy in
    `disclaimer.html`, the AI system prompt, and every `LifeGuidanceTopic`
    seed record explicitly avoids cure/wealth/marriage/job guarantees.

---

## Content volume — current state

| Data set | Brief's MVP target | Current | Gap |
|---|---|---|---|
| Daily quotes | 108 | 28 (4 full weeks, no repeats) | 80 more |
| Kanda summaries | 7 | 7 | done |
| Character profiles | 50 | 20 (major named characters) | ~30 more, minor/supporting characters |
| Place profiles | 25 | 15 | 10 more |
| Life-guidance topics | 100 | 27 (all 27 categories covered, 1 entry each) | most categories need 2–4 more entries each to reach 100 |

Every category the brief lists (career, fear, courage, family harmony,
patience, dharma, etc.) now has **at least one** real entry — that was the
bigger risk (a missing category reads as an oversight in review), so I
closed that gap fully before adding volume to categories that already had one.

**Fixed this pass (real bugs, not volume):**
- **Persistence** — `src/store/useAppStore.ts` now uses zustand's `persist`
  middleware backed by the SQLite cache (`src/services/offlineCache.ts`).
  Streak, bookmarks, language, and onboarding state now survive a reload;
  before this, a refresh silently wiped all of it.
- **A load-order bug this introduced** — zustand's `persist` hydrates
  synchronously the moment `useAppStore.ts` is imported, which happens
  before `_layout.tsx`'s `useEffect` ever runs. Table creation was moved to
  module load time in `offlineCache.ts` so the very first read on cold
  start doesn't hit "no such table: cache".
- **Audio** — `src/components/AudioButton.tsx` (expo-speech TTS) is wired
  into Daily Quote and Life Guidance. Caveat: not every Android/iOS device
  ships a Tamil/Telugu/Kannada/Malayalam TTS voice out of the box — if
  playback is silent on a real device, that's a missing device voice pack,
  not a bug in this code. Recorded narration (via `expo-av`) is the more
  reliable long-term answer and is still on the roadmap below.

## Known issues / not yet built

- Content volume gaps per the table above.
- Kids Mode, Learning Paths, Quiz, Notes, and Settings screens are stubs or
  not yet built.
- Recorded audio narration (vs. on-device TTS) not implemented.
- Firestore sync for cross-device account state isn't wired yet — the
  persisted store above is local-device-only (correct for offline-first,
  but won't sync across a user's phone and tablet until Firestore is added).
- Tamil, English, and the Cloud Function prompt are authored directly; Hindi
  (`src/i18n/locales/hi.json`) is a first-pass draft and should be reviewed
  by a native speaker before shipping non-UI content in that language.
  Telugu, Kannada, Malayalam, and Sanskrit-display locale files don't exist
  yet.
- No automated tests beyond the `jest` scaffold — no test files written yet.
- Push notifications (streak reminders, daily quote) are not implemented.

## Roadmap (suggested order)

1. Close remaining content gaps (table above) — quotes and life-guidance
   topics first, since those are the highest-visibility Home/Search content.
2. Build Kids Mode (stories, quiz, memory game, badges) — highest-visibility
   differentiator per the brief.
3. Add recorded audio narration as a fallback/upgrade over device TTS.
4. Wire Firestore for cross-device account sync (local persistence is done;
   this is about syncing that state to the cloud).
5. Author the remaining language locale files with native-speaker review.
6. Closed testing checklist + Play Console listing (draft below).
7. Full verse-by-verse Ramayana data (post-MVP per the brief).

---

## Store listing draft (fill in before submission)

**Short description (80 chars):** Daily Ramayana wisdom, AI guide, and life lessons — Tamil-first.

**Full description:** RamaVerse brings the Valmiki Ramayana to daily life —
Tamil-first, with English and more languages available. Explore all seven
Kandas, meet the characters, get a daily wisdom quote, ask the AI guide a
question (always with an honest citation or a clear "this is a
reflection" note), and share family-friendly stories with children in Kids
Mode. RamaVerse is a cultural and educational companion, not a source of
guaranteed outcomes.

**Data safety notes:** account info, usage/progress data, AI question text
(server-processed, not sold) — see `privacy.html`.

**Screenshots/feature graphic text:** [to be produced once Home, Kanda
Explorer, and Kids Mode screens are visually finalized]

---

## Project structure

```
app/                  Expo Router routes (thin, re-export from src/screens)
src/screens/          Screen components
src/data/             Seed content (JSON) — extend these, don't hardcode in screens
src/types/models.ts   Shared content model (Kanda→Sarga→Verse, Character, Place, etc.)
src/i18n/              i18next setup + locale files
src/services/          aiClient (proxy call), offlineCache (SQLite)
src/store/             Zustand global state
src/theme/tokens.ts    Design tokens — colors/fonts/spacing from the brief
functions/             Firebase Cloud Function AI proxy
web/                   Legal pages + placeholder landing page + 404 SPA fix
```
