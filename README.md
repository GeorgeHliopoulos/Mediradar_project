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
4. If you introduce new utility classes, regenerate the bundled stylesheet by running `python build_css.py` (the script derives utilitarian rules from the HTML/JS class usage and writes to `styles/tailwind-lite.css`).
5. Ensure the Netlify functions directory is available to your local serverless runner if you need backend endpoints.

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
- For local development keep your `env.js` (and any `.env` files) out of version control—the `.gitignore` already covers them.
- Netlify Functions continue to access their secrets strictly through `process.env` (see files under [`netlify/functions/`](./netlify/functions)).

## Styling

- Tailwind's CDN build has been replaced with a local `styles/tailwind-lite.css` bundle that contains only the utility classes referenced in `index.html` and `pharmacy.html`.
- If you add or rename classes in the markup or client-side scripts, re-run `python build_css.py` to regenerate the CSS utilities before committing. The helper scans the HTML/JS sources and updates the stylesheet accordingly.

### Deploy Previews environment

1. In Netlify open **Site configuration → Build & deploy → Environment** and expand the **Deploy previews** context.
2. Add the public keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `VAPID_PUBLIC_KEY`) so the build script can emit `/env.js` during preview builds.
3. After each preview finishes, open the preview URL and run `window.ENV` in the browser console to confirm the Supabase keys are present. You can also manually test the RPC endpoint from the console:
   ```js
   fetch(`${window.ENV.SUPABASE_URL}/rest/v1/rpc/get_request_status`, {
     method: 'POST',
     headers: {
       apikey: window.ENV.SUPABASE_ANON_KEY,
       Authorization: `Bearer ${window.ENV.SUPABASE_ANON_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ p_token: 'VALID_STATUS_TOKEN' })
   }).then(r => r.json()).then(console.log)
   ```
   A `200` response with at least one row confirms the anon key is accepted by the RPC endpoint.

## Security notes

- Never commit real Supabase credentials or VAPID keys to version control.
- Rotate keys immediately if they have already been exposed.
- Consider enabling secret scanning on the repository to prevent regressions.
