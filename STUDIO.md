# Builder Studio (3D tours) — setup

Routes: `/studio` (builder dashboard, sign-in required) and `/tour/:id` (public share page).

## One-time setup
1. **Vercel env var**: add `ANTHROPIC_API_KEY` (enables "Read brochure with AI" / "AI draft"). Without it everything still works with manual tracing.
2. **Firestore rules**: deploy `firestore.rules` (adds `studioProjects`, `studioLeads`): `firebase deploy --only firestore:rules`.
3. **Firebase Storage**: enable it in the console, then rules like:
   `match /studio/{uid}/{allPaths=**} { allow read; allow write: if request.auth.uid == uid; }`
   (Tracing images are best-effort; if Storage is off, plans still save but the tracing image isn't kept.)
4. `npm install` (new deps: three, pdfjs-dist, qrcode).

## Flow
Upload brochure PDF/images → pick floor-plan pages → (optional) AI draft → trace/fix walls, doors, windows, rooms → confirm scale → live 3D preview → add location → Publish → share link / WhatsApp / QR / embed.

## Honesty rules built in
AI output is a draft; scale must be confirmed; 3D is labelled approximate; nearby distances are straight-line from OpenStreetMap; RERA shown as "given by builder".

## Limits
AI: 30 requests/hour/user, max 8 images. Geocoding/nearby use free OSM services (Nominatim, Overpass) — fine for low volume.

## Builder showcase model (current)
- `/` is the public directory; `/builders/:id` is a builder's public page; `/tour/:id` is a project tour; `/studio` is the builder dashboard (profile, projects, enquiries).
- Builders accept referral terms at signup (text lives in `TERMS` in `src/studio/StudioApp.tsx` — have a lawyer finalise it and sign a written agreement per builder).
- Every enquiry is stored with `source: 'jgestate'` and a `refCode` for commission tracking.
- The old buy/sell/rent marketplace is hidden, not deleted: set `LEGACY_MARKETPLACE = true` in `src/App.tsx` to bring it back.
- **Redeploy `firestore.rules`** — it now includes `builderProfiles` and public listing of published projects.
