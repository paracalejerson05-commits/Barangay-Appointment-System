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

Set `GEMINI_API_KEY` in Vercel's server environment variables to enable Gemini. Keep it server-only: never prefix it with `VITE_` or commit its value. Without the key or when Gemini is unavailable, the authenticated chatbot uses its limited verified-information fallback. `SMTP_EMAIL` and `SMTP_PASSWORD` are optional email integration variables.

See `.env.example` for variable names and placeholder formats. The local `.env` file must remain untracked.

In Supabase Authentication URL Configuration, allow the deployed app origin as a redirect URL (and the local development origin when testing). Password recovery redirects to `/?auth_mode=recovery` on the current origin; Supabase must permit that origin for the recovery email link to return to the app.

## Database setup

Run the applicable SQL migrations in the Supabase SQL Editor before using registration, resident document review, or the related approval workflow. In particular, apply `database_resident_registration.sql`.

`database_security_phase2.sql` is a review-only proposal for order, request-state, announcement, profile, and view access controls. It has not been applied. Review and test it in a staging environment after `database_security_hardening.sql`, `database_security_fix.sql`, and `database_resident_registration.sql` are in place; verify actual policies and grants before production rollout.

## Local checks

- `npm run lint` checks TypeScript.
- `npm run build:web` builds only the Vercel frontend.
- `npm run build` builds the frontend and Express server bundle.
- `node --import tsx --test src/lib/chatReliability.test.ts` runs the chatbot reliability tests.
