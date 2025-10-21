# MediRadar

Single-page PWA that connects users with nearby pharmacies via Supabase-backed workflows.

## Local development

1. Install dependencies (optional for serverless functions):
   ```bash
   npm install
   ```
2. Copy the example environment file and fill in your project specific values:
   ```bash
   cp env.example.js env.js
   ```
3. Serve the site with any static HTTP server (for example `npx serve .`).
4. Ensure the Netlify functions directory is available to your local serverless runner if you need backend endpoints.

## Environment configuration

The frontend expects a script named `env.js` at the project root that defines `window.ENV`. The file is ignored by git to prevent accidental commits of secrets. Use [`env.example.js`](./env.example.js) as a template and provide:

- `SUPABASE_URL` – the Supabase project URL.
- `SUPABASE_ANON_KEY` – the anonymous public key for client-side access.
- `VAPID_PUBLIC_KEY` (optional) – the Web Push key used when enabling push notifications.

For Netlify deployments define the same keys as site environment variables so that the serverless functions can access `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE`.

## Security notes

- Never commit real Supabase credentials or VAPID keys to version control.
- Rotate keys immediately if they have already been exposed.
- Consider enabling secret scanning on the repository to prevent regressions.
