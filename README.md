# Mediradar Project

## Supabase Environment Configuration

Για να ολοκληρώσεις το βήμα 2 της διασύνδεσης με το Supabase, έχεις δύο επιλογές:

1. **Χρήση μεταβλητών περιβάλλοντος (προτείνεται για παραγωγή)**
   - Στο περιβάλλον build/deploy δήλωσε τις παρακάτω μεταβλητές:
     - `SUPABASE_URL=https://qzerrisyowkfkmcyxmav.supabase.co`
     - `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZXJyaXN5b3drZmttY3l4bWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTcxODQsImV4cCI6MjA3NTU5MzE4NH0.alkvHkOQPBTwY3daUcKAEsf4nt0kizuU3rYI2c2InPk
   - Το script `env.js` θα τις αντιγράψει αυτόματα στο `window.ENV` κατά το build ή το runtime.

2. **Άμεση ενημέρωση του `env.js` (για τοπική δοκιμή ή στατικό hosting χωρίς build step)**
   - Άνοιξε το αρχείο [`env.js`](./env.js).
   - Βεβαιώσου ότι το αντικείμενο `fallbackEnv` περιέχει:
     ```js
     SUPABASE_URL: 'https://qzerrisyowkfkmcyxmav.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZXJyaXN5b3drZmttY3l4bWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTcxODQsImV4cCI6MjA3NTU5MzE4NH0.alkvHkOQPBTwY3daUcKAEsf4nt0kizuU3rYI2c2InPk'
     ```
   - Αποθήκευσε το αρχείο και φόρτωσε ξανά την εφαρμογή.

> 💡 Η εφαρμογή ελέγχει πρώτα για μεταβλητές περιβάλλοντος και στη συνέχεια χρησιμοποιεί τα fallback του `env.js`. Εφόσον συμπληρώσεις τις παραπάνω τιμές, ο Supabase client θα αρχικοποιείται σωστά και τα sign-in/sign-up flows θα λειτουργούν χωρίς προειδοποιήσεις.
