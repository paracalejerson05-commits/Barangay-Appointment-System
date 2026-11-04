# Barangay Pupua Smart Public Service Portal

## Deployment layout

- The Vite frontend is deployed on Vercel.
- The Express API runs as a Vercel serverless function in `api/[...path].ts`.
- `vercel.json` routes `/api/*` to that function before applying the SPA fallback, so API methods and request bodies are handled by Express.
- Connect the GitHub repository to Vercel to deploy the frontend and API together.

## Required environment variables

Set these in the hosting provider dashboards; never commit real values:

### Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SECRET_KEY`

Optional API integrations use `GEMINI_API_KEY`, `SMTP_EMAIL`, and `SMTP_PASSWORD`.

See `.env.example` for variable names and placeholder formats. The local `.env` file must remain untracked.

## Database setup

Run the applicable SQL migrations in the Supabase SQL Editor before using registration, resident document review, or the related approval workflow. In particular, apply `database_resident_registration.sql`.

`database_security_phase2.sql` is a review-only proposal for order, request-state, announcement, profile, and view access controls. It has not been applied. Review and test it in a staging environment after `database_security_hardening.sql`, `database_security_fix.sql`, and `database_resident_registration.sql` are in place; verify actual policies and grants before production rollout.

## Local checks

- `npm run lint` checks TypeScript.
- `npm run build:web` builds only the Vercel frontend.
- `npm run build` builds the frontend and Express server bundle.
