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

If you also use Supabase's recovery email link, allow the deployed app origin (and local development origin when testing) in Supabase Authentication URL Configuration. The new OTP flow stays on the page where the reset was requested.

### Password reset OTP setup

Password reset uses the existing Supabase Auth user store and recovery OTP (no separate password or OTP database). Before enabling it in production:

1. In Supabase **Authentication > Sign In / Providers > Email**, set **Email OTP expiry** to `300` seconds and the OTP length to `6`. Supabase uses this expiration for other email authentication links too.
2. In **Authentication > Email Templates > Reset Password**, use `{{ .Token }}` in the email body so users receive the six-digit code. Example:

   ```html
   <h2>Barangay Pupua Portal password reset</h2>
   <p>Use this one-time code to reset your password:</p>
   <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px;">{{ .Token }}</p>
   <p>This code expires in 5 minutes and can only be used once. If you did not request a reset, ignore this email.</p>
   ```

3. Configure a trusted SMTP provider under **Project Settings > Authentication > SMTP Settings**. Supabase's built-in email service has a low sending quota and is not intended for production delivery.
4. Keep Supabase Auth's server-side email and verification rate limits enabled. The app allows one resend per 60 seconds and locks the current form after five failed code entries; Supabase also rate-limits recovery and verification requests on its servers.

The app's five-minute display matches the configured Supabase expiry; the server-side expiry is authoritative. Supabase validates and consumes the OTP, issues a recovery session using the project's configured token lifetime, and stores the updated password using its built-in secure password handling.

## Database setup

Run the applicable SQL migrations in the Supabase SQL Editor before using registration, resident document review, or the related approval workflow. In particular, apply `database_resident_registration.sql`.

`database_security_phase2.sql` is a review-only proposal for order, request-state, announcement, profile, and view access controls. It has not been applied. Review and test it in a staging environment after `database_security_hardening.sql`, `database_security_fix.sql`, and `database_resident_registration.sql` are in place; verify actual policies and grants before production rollout.

## Local checks

- `npm run lint` checks TypeScript.
- `npm run build:web` builds only the Vercel frontend.
- `npm run build` builds the frontend and Express server bundle.
- `node --import tsx --test src/lib/passwordRecovery.test.ts src/lib/chatReliability.test.ts` runs the password recovery and chatbot reliability tests.
