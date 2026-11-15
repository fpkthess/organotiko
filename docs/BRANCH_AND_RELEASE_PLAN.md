# Στρατηγική ανάπτυξης — συμφωνημένη 15/11/2026

### Τώρα
- Ένα **Supabase project `organotiko` ως development**. Μόνο synthetic data.
- Ένας κοινός οργανωμένος κώδικας για `apps/organotiko`, `apps/portal` και `packages/domain`.
- Κρατάμε τοπική branch `development` ως αρχικό σημείο, χωρίς να ονομάζουμε τη σημερινή έκδοση production-ready.
- Το παραγωγικό Portal συνεχίζει ανεπηρέαστο με τη δική του βάση.

### Όταν ολοκληρωθεί και δοκιμαστεί η πρώτη κανονική έκδοση
- Ορίζουμε προστατευμένο `main` (releasable code, review approvals, CI).
- Ορίζουμε ξεχωριστό `develop`/testing και `feature/<θέμα>` branches για νέες λειτουργίες.
- Δημιουργούμε **ξεχωριστό περιβάλλον βάσης** για development/staging προτού εισαχθούν πραγματικά προσωπικά δεδομένα στο κύριο Supabase.
- Έχουμε e2e tests, migrations, backup/restore drill και ελεγχόμενο cutover.
- Οι αλλαγές ακολουθούν `feature → develop/tests → QA → main → production`.

**Σημείωση:** Git branch != Supabase database branch. Το GitHub repository/Netlify deployment ΔΕΝ δημιουργήθηκε ακόμη και δεν υπάρχει αυτόματο deploy.
