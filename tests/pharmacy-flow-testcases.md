# Pharmacy Search & Reservation UI – Test Cases

## Geolocation Handling
- **Permission granted**: Stub `navigator.geolocation.getCurrentPosition` to resolve with known coordinates. Submit a search and verify that each result shows a distance badge with a formatted kilometre value (one decimal place) and that the banner message is hidden.
- **Permission denied**: Stub `getCurrentPosition` to reject with `PERMISSION_DENIED`. Submit a search and verify the banner displays “Location permission denied” messaging and that each card shows the “No location” badge.
- **Unsupported API**: Delete `navigator.geolocation` before submission. Ensure the banner reports that location is unavailable and distances are omitted.

## Result Rendering
- **No replies**: Mock polling to return an empty array after timeout and confirm the empty state copy and retry button are visible.
- **Only generic replies**: Return replies flagged as `is_generic=true` and confirm cards display the “Generic” badge and appropriate availability text.
- **Only exact replies**: Return replies with `is_generic=false` and verify the “Exact” badge is rendered.
- **Mixed replies ordering**: Supply both exact and generic replies with varying distances and confirm sorting prioritises exact matches, then nearest distance.

## Authentication Gate
- **SMS success**: Trigger the gate, send an SMS code, enter the generated code before it expires, and ensure the continue button enables and allows reservation.
- **SMS failure**: Enter an incorrect or expired code and confirm the error messaging appears and the continue button remains disabled.
- **Email magic link**: Send a magic link, invoke the confirmation button within the allowed window, and verify reservation is unlocked; repeat after expiry to confirm the warning message.
- **SSO option**: Click each SSO provider button and assert the verification success message is shown and continue is enabled.
- **Guest reminder**: Switch to the guest flow and ensure the hint banner requiring verification is visible until a method succeeds.
- **Prevent reservation without auth**: Attempt to reserve a pharmacy without completing verification; confirm the auth gate blocks completion and the countdown is not started.

