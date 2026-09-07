# RamaVerse Next-Generation Website — Clean-Room Release Contract

## Scope
This branch is website-only. It must not modify Mobile/VC14 and must not import visual shells, source trees, generated output, caches or dependencies from unrelated projects.

## Source isolation
- Working tree is intentionally rebuilt from a zero-base tree.
- Existing `main` remains historical production/rollback evidence only.
- PR #6 remains reconstruction evidence only; its old website files are not copied here.
- The verified `RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip` is the only approved native RC source for controlled import when supplied.

## Canonical gate
- Expected authoritative RC baseline: 550.
- No canonical content may be silently rewritten, deduplicated, translated, summarized or replaced during import.
- `public/data/canonical-manifest.json` may be added only after record-level reconciliation and explicit approval state is recorded.
- The runtime treats any baseline other than 550, or `approved !== true`, as blocked.

## Route contract
The clean-room shell registers exactly 22 website routes and includes `/knowledge`.

## Promotion gates
1. Exact verified RC archive is available and hash-matched.
2. Native source/canonical reconciliation completed.
3. No forbidden project files or donor UI are present.
4. TypeScript, route contract and production build pass in GitHub Actions.
5. All controls/routes receive functional validation.
6. Desktop/tablet/mobile visual QA passes.
7. Keyboard/focus/reduced-motion/accessibility checks pass.
8. Asset rights/provenance are explicit.
9. Performance and layout-stability budgets pass.
10. Owner explicitly authorizes production deployment.

## Production boundary
Do not merge or deploy this clean-room branch until all promotion gates pass. Do not delete the current repository or production branch as part of this stage.
