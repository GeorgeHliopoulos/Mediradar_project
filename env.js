(function initializeEnv(){
  const fallbackEnv = {
    SUPABASE_URL: 'https://qzerrisyowkfkmcyxmav.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZXJyaXN5b3drZmttY3l4bWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTcxODQsImV4cCI6MjA3NTU5MzE4NH0.alkvHkOQPBTwY3daUcKAEsf4nt0kizuU3rYI2c2InPk',
    SUPABASE_SITE_URL: 'https://mediradar.gr',
    SUPABASE_REDIRECT_URL: 'https://mediradar.gr/auth/v1/callback',
    SUPABASE_EMAIL_REDIRECT_URL: 'https://mediradar.gr/',
    SUPABASE_APP_NAME: 'MediRadar',
    SUPABASE_APP_DESCRIPTION: 'Σύνδεση μέσω Google για την πλατφόρμα MediRadar',
    SUPABASE_APP_LOGO: 'https://mediradar.gr/icons/icon-512.png',
    FIREBASE_API_KEY: 'demo-api-key',
    FIREBASE_AUTH_DOMAIN: 'mediradar-demo.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'mediradar-demo',
    FIREBASE_STORAGE_BUCKET: 'mediradar-demo.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    FIREBASE_APP_ID: '1:000000000000:web:demoappid1234567',
    FIREBASE_MEASUREMENT_ID: 'G-DEMO12345',
    VAPID_PUBLIC_KEY: 'BGS8pCF76A6Es7XAu3hcTAEE8vcRDl1JlWQ7Hym7m5WK63gIHqbuuSJl_xfC4l7729H5ClVqysTjnShnJwviHgo'
  };

  const envFromProcess = typeof process !== 'undefined' && process.env ? {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SITE_URL: process.env.SUPABASE_SITE_URL,
    SUPABASE_REDIRECT_URL: process.env.SUPABASE_REDIRECT_URL,
    SUPABASE_EMAIL_REDIRECT_URL: process.env.SUPABASE_EMAIL_REDIRECT_URL,
    SUPABASE_APP_NAME: process.env.SUPABASE_APP_NAME,
    SUPABASE_APP_DESCRIPTION: process.env.SUPABASE_APP_DESCRIPTION,
    SUPABASE_APP_LOGO: process.env.SUPABASE_APP_LOGO,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY
  } : {};

  const filteredProcessEnv = Object.fromEntries(
    Object.entries(envFromProcess).filter(([, value]) => typeof value === 'string' && value.length > 0)
  );

  window.ENV = Object.freeze({
    ...(window.ENV || {}),
    ...fallbackEnv,
    ...filteredProcessEnv
  });
})();
