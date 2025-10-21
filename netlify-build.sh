#!/usr/bin/env bash
set -euo pipefail

# Δημιουργεί PUBLIC env για τον browser
cat > env.js <<'JS'
window.ENV = {
  SUPABASE_URL: "%SUPABASE_URL%",
  SUPABASE_ANON_KEY: "%SUPABASE_ANON_KEY%",
  VAPID_PUBLIC_KEY: "%VAPID_PUBLIC_KEY%"
};
JS

# Αντικατάσταση placeholders με Netlify envs
sed -i "s|%SUPABASE_URL%|${SUPABASE_URL:-}|g" env.js
sed -i "s|%SUPABASE_ANON_KEY%|${SUPABASE_ANON_KEY:-}|g" env.js
sed -i "s|%VAPID_PUBLIC_KEY%|${VAPID_PUBLIC_KEY:-}|g" env.js

# Γρήγορος έλεγχος (προαιρετικός): αποτυγχάνει build αν λείπουν βασικά
[ -z "${SUPABASE_URL:-}" ] && { echo "Missing SUPABASE_URL"; exit 1; }
[ -z "${SUPABASE_ANON_KEY:-}" ] && { echo "Missing SUPABASE_ANON_KEY"; exit 1; }

echo "Generated env.js"
