# Acceptance test scenarios

## Geolocation handling
1. **Permission granted**: Approve the location request when the results drawer opens. Distances appear beside each pharmacy badge with one decimal place and the header notice confirms that distances use the current location.
2. **Permission denied**: Deny the location prompt. The drawer shows the fallback message “Δεν δόθηκε άδεια—εμφάνιση χωρίς απόσταση” (or the English equivalent) and every pharmacy card displays the "Χωρίς τοποθεσία" badge with the 🚫 icon.

## Pharmacy result compositions
1. **No results**: Mock an empty response. The drawer surfaces the empty state message and the main results panel switches to the "Δεν βρέθηκαν φαρμακεία" card.
2. **Only generics**: Provide replies marked as `is_generic=true`. Each card shows the amber “Γενόσημο διαθέσιμο” badge and the list is sorted by distance.
3. **Only exact matches**: Provide replies with `is_generic=false`. Cards show the green “Ακριβώς το ζητούμενο” badge and distance ordering is ascending.
4. **Mixed exact + generic**: Return a blend of both. Exact matches appear first regardless of distance, followed by generics sorted by distance.

## Auth verification flows
### SMS OTP
1. **Happy path**: Enter a valid phone number, request the SMS code (observe the demo code surfaced in the status message), enter it, and verify. The auth modal closes, the hold modal becomes actionable, and the global success banner is visible when reopening the gate.
2. **Wrong code**: Enter a different code. The error message "Ο κωδικός δεν είναι σωστός" appears and the gate stays open.
3. **Expired code**: Wait >2 minutes and retry with the original code. The status flips to the expiry message and the user must resend.

### Magic link (Email)
1. **Sign-in link**: Provide an email, press **Σύνδεση**, then **Έκανα κλικ στο link**. Success status appears and the reservation button activates.
2. **Register link**: Same flow using **Εγγραφή**, verifying that the confirmation succeeds.
3. **Confirm without sending**: Click **Έκανα κλικ στο link** before requesting a link. The error message "Πρώτα επέλεξε σύνδεση ή εγγραφή." appears.
4. **Expired link**: Wait >10 minutes after requesting, then confirm to surface the expiry warning.

### SSO shortcuts
1. Click each provider button (Google, Apple, Microsoft). A success toast appears and the modal closes, unlocking reservation.

## Reservation gate enforcement
1. **Attempt without auth**: From the pharmacy modal press **Επιβεβαίωση & Έναρξη 60’** without verifying. The auth modal opens and no reservation starts.
2. **Post-auth countdown**: Complete any verification path, confirm the pharmacy, and ensure the 60-minute countdown begins with the selected pharmacy persisted in the status view.
