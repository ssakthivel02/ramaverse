# SitaRama Legacy Migration Contract

Target legacy site: `sitarama.omsaravanabhava.org`
Source product: RamaVerse

## Non-negotiable rules
- Preserve Ramayana content, citations/source labels, life-guidance disclaimers and AI confidence/grounding guardrails.
- Keep RamaVerse package identity (`com.ramaverse.app`) unchanged; this is a website legacy-brand migration, not a mobile package migration.
- Keep Firebase/Expo architecture separate from DivyaNexus, SaravanaBhava and KirthiVerse.
- Do not commit AI keys, Firebase secrets, signing material, private user data or credentials.
- Preserve legal pages, offline behaviour and direct-route handling.
- Maintain Git history; use this migration branch and PR workflow.
- DNS/Cloudflare cutover happens separately after validation.

## Migration phases
1. Legacy domain and public SitaRama branding.
2. SEO/legal/web surface brand sweep without changing app package identity.
3. Build/direct-route/source/disclaimer validation.
4. DNS cutover and live smoke test.
5. Keep the future RamaVerse hi-tech flagship separate.
