# Πραγματική κατάσταση βάσης — 15/11/2026

**Ενεργό development Supabase**: `organotiko`, ref `ikoqtvcobkmwshowgetc`, URL `https://ikoqtvcobkmwshowgetc.supabase.co`.
Το παλαιό παραγωγικό `ORGANOSI` (Portal) **δεν τροποποιήθηκε**.

## Επαληθευμένα αποτελέσματα στον server

- 21 πίνακες με Row Level Security (RLS).
- 2 protected SQL views: `organotiko_efekth_daily_summary`, `organotiko_efekth_year_summary`, με `security_invoker=true`.
- 260 `organotiko_people`, 260 `organotiko_students` — και οι 260 `data_origin='synthetic'`. Το default + η RPC δημιουργίας νέων φοιτητών ορίζουν επίσης `synthetic` κατά την ανάπτυξη.
- 260 εγγραφές σε `organotiko_yearly_records`, 28 εικονικά `organotiko_registration_events`.
- 28 `ef_registered=true`, 0 γεγονότα με κενή/μη αποδεκτή πηγή ή ημερομηνία.
- Σύνολα των δύο views = 28 = πλήθος πραγματικών γεγονότων στη δοκιμαστική βάση.
- 1 ενεργό ακαδημαϊκό έτος `2026-27`.
- Δοκιμή RLS χωρίς MFA/ACL ως `authenticated`: 0 ορατές εγγραφές.
- Ο χρήστης `authenticated` δεν έχει δικαίωμα άμεσου UPDATE στα `ef_registered` ή `data_origin`.
- Remote migrations: `20261104000100` read foundation, `20261115214934` development core, `20261115215258` analytics read models, και `organotiko_development_synthetic_guard` (επιπλέον προστασία νέων εγγραφών).

## Τι δεν είναι έτοιμο

- **Δεν έχει ανέβει GitHub/Netlify**, δεν έχουν δημιουργηθεί χρήστες με ελεγμένα δικαιώματα.
- Το νέο React project **δεν έχει κατασκευαστεί και δοκιμαστεί end-to-end**: το npm registry δεν ήταν διαθέσιμο (`EAI_AGAIN`).
- Μόνο ο αρχικός πίνακας έχει real Supabase adapter. Τα υπόλοιπα δεν έχουν ολοκληρωμένα API/UI.
- Δεν έχει υλοποιηθεί τελικός μηχανισμός εκκαθάρισης συνθετικών δεδομένων και import από Access.
- Η ακριβής λογική «ΝΟΥΜΕΡΑ.xlsx» είναι ΕΚΚΡΕΜΗΣ, δεν έχει εξισωθεί με τις δύο συνοπτικές views.

## Ζητήματα ασφάλειας πριν από πραγματικά δεδομένα

Ο Supabase Security Advisor αναφέρει: `authenticated_security_definer_function_executable` για τέσσερις functions. Τα νέα write RPCs έχουν explicit checks για ACL+MFA, αλλά απαιτείται ανεξάρτητος έλεγχος privilege escalation, RLS, input validation, error handling. Αναφέρει επίσης `auth_leaked_password_protection` (απενεργοποιημένο), που πρέπει να ενεργοποιηθεί. Τα private access tables έχουν RLS χωρίς client policies **σκόπιμα**: διαχειρίζονται μόνο μέσω εξουσιοδοτημένου server/admin.

Refs: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable και https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Καθαρισμός κατά το cutover

ΜΟΝΟ με ρητή επιβεβαίωση, ελεγμένο backup / restore drill, ακριβή καταμέτρηση `data_origin='synthetic'`, έλεγχο όλων των FK/ιστορικών και σχέδιο διαγραφής που διατηρεί το schema. Να μη γίνει ποτέ γενικό `TRUNCATE` χωρίς επιβεβαιωμένο review. Τα πραγματικά δεδομένα εισάγονται μόνο μετά τον έλεγχο της πηγής και των διπλοεγγραφών.
