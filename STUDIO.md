# JGEstate

Builder showcase: a builder uploads a brochure PDF; AI reads details, floors and every floor plan; the site builds a 3D tower and furnished, walkable homes; the builder shares one link; enquiries land in the builder dashboard tagged "via JGEstate".

## Stack
React + Vite + Tailwind v4, three.js, Firebase Auth + Firestore (no Storage needed), Vercel serverless `api/parse-brochure.ts` (Claude vision).

## One setup step
Vercel → Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`, then redeploy. Without it everything works except AI reading of brochures.

## Routes
`/` home · `/tour/:id` tower → home 3D tour (`/tour/demo` sample) · `/builders/:id` builder page · `/studio` builder dashboard.

## Notes
3D models are approximate drafts from the brochure; furniture is illustrative; builders review before publishing. Firestore rules: `studioProjects`, `studioLeads`, `builderProfiles`.
