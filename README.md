# RamaVerse — Next-Generation Clean-Room Website

This branch is the isolated foundation for the new RamaVerse website.

- Website only; Mobile/VC14 untouched.
- Zero-base working tree: no legacy website files copied into this branch.
- 22-route contract, including `/knowledge`.
- Canonical RC baseline gate fixed at 550.
- Verified RC source remains pending controlled import.
- Production deployment prohibited until validation and explicit owner authorization.

## Local validation

```bash
npm install
npm run test:routes
npm run typecheck
npm run build
```

See `docs/CLEANROOM_RELEASE_CONTRACT.md` for release gates.
