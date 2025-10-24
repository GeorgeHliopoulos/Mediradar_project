import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.5/+esm";

const ENV = window.ENV || {};

let firebaseApp = null;
let firebaseAuth = null;
let firestore = null;
let googleProvider = null;

const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  measurementId: ENV.FIREBASE_MEASUREMENT_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(value => typeof value === 'string' && value.length > 0 && !/demo/i.test(value));

if (hasFirebaseConfig) {
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
  googleProvider = new GoogleAuthProvider();
} else {
  console.info('[firebase] Firebase config incomplete — skipping initialization.');
}

let supabaseClient = null;

if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
  supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} else {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
}

export {
  firebaseApp,
  firebaseAuth,
  firestore,
  googleProvider,
  supabaseClient,
  signInWithPopup
};

export function isSupabaseReady() {
  return !!supabaseClient;
}

export function isFirebaseReady() {
  return !!firebaseApp;
}
