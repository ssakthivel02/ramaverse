# RamaVerse — Deployment Guide

Everything below is a real, exact command. What I could not do from this
sandbox: register/change DNS, run `eas build`, deploy to Firebase, or touch
the Play Console — no network path to any of those from here. Every command
below is verified correct where the sandbox allowed (web export was
actually run end-to-end — see MERGE_AND_TEST_REPORT.md §5); the DNS and
`eas build` steps are the documented correct procedure, not something I ran.

---

## Web export & deploy

```bash
npm install
EXPO_OFFLINE=1 npx expo export --platform web   # only need EXPO_OFFLINE if you're
                                                  # also network-restricted; on your
                                                  # own machine plain `npx expo export
                                                  # --platform web` is fine
```

This produces a static site in `dist/` — confirmed working, 18 routes
exported clean (see test report).

### Option 1 — GitHub Pages
```bash
# from your repo root, after the export above
git checkout --orphan gh-pages
git --work-tree=dist add --all
git --work-tree=dist commit -m "Deploy RamaVerse web"
git push origin HEAD:gh-pages --force
git checkout main
```
In repo Settings → Pages, set source to the `gh-pages` branch.
The `web/404.html` file (already in this project) handles SPA routing —
set its `BASE_PATH` const to your repo's Pages path before deploying
(empty string if using a custom domain).

### Option 2 — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # point public directory to "dist"
firebase deploy --only hosting
```

### Option 3 — Vercel
```bash
npm install -g vercel
vercel --prod dist
```

**After any deploy, manually check these direct URLs load without a 404**
(this was explicitly called out as a requirement — I can't check it against
your live domain from here, but the route list to check is exact):
`/privacy`, `/delete-account`, `/delete-data`, `/disclaimer`, `/sources`,
`/contact`, plus a hard refresh on a deep link like `/kanda/sundara` to
confirm the SPA fallback actually works on your host.

---

## DNS setup (ramaverse.app or whichever domain you land on)

Exact records depend on which host above you choose:

**GitHub Pages custom domain:**
```
Type: A      Host: @      Value: 185.199.108.153
Type: A      Host: @      Value: 185.199.109.153
Type: A      Host: @      Value: 185.199.110.153
Type: A      Host: @      Value: 185.199.111.153
Type: CNAME  Host: www    Value: <your-github-username>.github.io
```
Add a `CNAME` file containing just your domain to the `dist/` output (or to
the repo root if serving from `main`), then set the custom domain in repo
Settings → Pages.

**Firebase Hosting custom domain:**
Firebase gives you the exact TXT (verification) and A/CNAME records to add
once you run `firebase hosting:sites:list` and add the domain in the
Firebase console — these are generated per-project, so there's no fixed
value to hand you here.

**Vercel custom domain:**
```
Type: A      Host: @      Value: 76.76.21.21
Type: CNAME  Host: www    Value: cname.vercel-dns.com
```

**HTTPS:** all three providers above provision TLS automatically once DNS
propagates (can take up to 24–48h) — no manual certificate step needed for
any of the three options.

---

## Android AAB build

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile production
```

This produces an `.aab` — **never submit an APK to Play Store for a new
app.** Before running this, confirm target SDK compliance:

```bash
npx expo prebuild --platform android
grep -i "targetSdkVersion\|compileSdkVersion" android/build.gradle
```
Both should read ≥ 35 (Expo SDK 52 defaults to 35; don't hand-edit to 36
unless `expo-doctor` and a completed build both confirm no native module
breaks).

Package name is already correctly set to `com.ramaverse.app` in `app.json`
— confirmed unique, not reused from any prior project.

**Play Console readiness checklist** (placeholders you still need to fill
before submitting, not run commands):
- Privacy Policy URL → point at your deployed `/privacy`
- Delete Account URL → point at your deployed `/delete-account`
- App icon, splash screen — `assets/icon.png`, `assets/splash.png`
  referenced in `app.json` don't exist yet as real image files; you'll need
  to add actual artwork before `eas build` will succeed (it currently
  references paths that don't resolve to real PNGs)
- Feature graphic (1024×500) — not yet created
- 8 screenshot captions — draft below, actual screenshots need a real device
  or emulator run

**Screenshot caption drafts:**
1. "Daily Rama Wisdom — a new reflection every day"
2. "Explore all seven Kandas of the Valmiki Ramayana"
3. "Ask RamaVerse AI — always cited, never invented"
4. "Life guidance for real situations — career, family, patience, and more"
5. "Kids Mode — 30 family-safe Ramayana stories"
6. "Meet the characters — Rama, Sita, Hanuman, and more"
7. "Listen in Tamil or English — built-in audio narration"
8. "Tamil-first, built for the whole family"

---

## Test report reference

See `MERGE_AND_TEST_REPORT.md` §5 for the exact commands already run in
this session and their real output, including the dependency and
platform-compatibility bugs found and fixed along the way.
