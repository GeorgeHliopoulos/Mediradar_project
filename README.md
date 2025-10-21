# MediRadar

Single-page PWA that connects users with nearby pharmacies via Supabase-backed workflows.

## Local development

1. Install dependencies (optional for serverless functions):
   ```bash
   npm install
   ```
2. Provide runtime configuration for the browser either by copying the example file or by running the build helper with your env vars:
   ```bash
   cp env.example.js env.js
   # or
   SUPABASE_URL=... SUPABASE_ANON_KEY=... ./netlify-build.sh
   ```
3. Serve the site with any static HTTP server (for example `npx serve .`).
4. Ensure the Netlify functions directory is available to your local serverless runner if you need backend endpoints.

## Environment & Secrets

- [`netlify-build.sh`](./netlify-build.sh) runs in every Netlify build to generate `env.js` from the **public** site environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY`). The script fails fast if the required public keys are missing.
- The generated `env.js` is git-ignored and loaded before any other scripts; the HTML bootstrap throws a descriptive error if the expected keys are not present.
- Configure your Netlify site/environment settings as follows:
  - **Public (exposed to the browser via `env.js`):**
    - `SUPABASE_URL` – the Supabase project URL.
    - `SUPABASE_ANON_KEY` – the anonymous public key for client-side access.
    - `VAPID_PUBLIC_KEY` (optional) – the Web Push key used when enabling push notifications.
  - **Server-only (available exclusively to Netlify Functions via `process.env`):**
    - `SUPABASE_SERVICE_ROLE` and any other sensitive Supabase credentials. These values never reach the browser.
- To keep Deploy Previews working, open **Site configuration → Build & deploy → Environment** in Netlify and either copy the production variables to the "Deploy previews" context or define the same `SUPABASE_URL`, `SUPABASE_ANON_KEY` (and optional `VAPID_PUBLIC_KEY`) there. After each preview build, visit the preview URL and run `window.ENV` in the browser console to verify the values were injected.
- For local development keep your `env.js` (and any `.env` files) out of version control—the `.gitignore` already covers them.
- Netlify Functions continue to access their secrets strictly through `process.env` (see files under [`netlify/functions/`](./netlify/functions)).

## Security notes

- Never commit real Supabase credentials or VAPID keys to version control.
- Rotate keys immediately if they have already been exposed.
- Consider enabling secret scanning on the repository to prevent regressions.
