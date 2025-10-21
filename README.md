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
- Use the in-app **Diagnostics** button (top-right of each page) to inspect `window.ENV` and run a Supabase RPC probe (`POST /rest/v1/rpc/get_request_status`) with a known status token. A `200` response accompanied by a non-empty payload confirms that the anon key is accepted by the RPC endpoint.
- For local development keep your `env.js` (and any `.env` files) out of version control—the `.gitignore` already covers them.
- Netlify Functions continue to access their secrets strictly through `process.env` (see files under [`netlify/functions/`](./netlify/functions)).

### Deploy Previews environment

1. In Netlify open **Site configuration → Build & deploy → Environment** and expand the **Deploy previews** context.
2. Add the public keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `VAPID_PUBLIC_KEY`) so the build script can emit `/env.js` during preview builds.
3. After each preview finishes, open the preview URL and either run `window.ENV` in the browser console or click the in-app **Diagnostics** button to confirm:
   - the `/env.js` request responds with `200` and loads before other scripts;
   - the RPC probe to `/rest/v1/rpc/get_request_status` (with a valid `p_token`) returns `200` with at least one row instead of `401`/`403`.

## Security notes

- Never commit real Supabase credentials or VAPID keys to version control.
- Rotate keys immediately if they have already been exposed.
- Consider enabling secret scanning on the repository to prevent regressions.
