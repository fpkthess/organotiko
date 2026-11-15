# PROTOPORIA PORTAL v2.1.5 – Finance UX and no receipts

- **Έσοδα / Έξοδα → Αναμενόμενα → Μεταφορές → Επισκόπηση**.
- Στο πάνω μέρος των Εσόδων/Εξόδων εμφανίζονται συμπαγώς το γενικό διαθέσιμο (Μετρητά+Τράπεζα+Revolut), τα επιμέρους υπόλοιπα και ο καταθετικός χωριστά. Τα ποσά αφορούν το **κλείσιμο του επιλεγμένου μήνα**, όπως στην Επισκόπηση.
- Αφαιρούνται εντελώς upload, παραστατικά, signed URL, queries finance_files και permissions από το frontend.
- Η production migration έχει ήδη εγκατασταθεί στο ORGANOSI και το αρχείο της παρέχεται μόνο για αρχειοθέτηση: **020_remove_finance_receipts.sql**. Αποκλειστικά αφού επιβεβαιωθεί πως finance_files και storage.objects του bucket είναι κενά, αφαιρεί την RPC, τον πίνακα, τις policies και αφήνει τον άδειο Storage bucket κλειδωμένο (η Supabase απαιτεί Storage API ή Dashboard για τη διαγραφή του), και προσαρμόζει την RPC διαγραφής.
- **Η αλλαγή στην παραγωγική Supabase έχει ήδη ολοκληρωθεί. ΜΗΝ ξανατρέξεις την migration 020 ή άλλα scripts βάσης.** Δεν ξανατρέχουμε ιστορική εισαγωγή / migrations 001–019.
- Δεν αλλάζουν finance_transactions, finance_legs, finance_registers, auth, SMS, Worker ή άλλοι πίνακες.
- Για εγκατάσταση: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\RUN-02-DEPLOY-CLOUDFLARE.ps1"`. Το script απορρίπτει αποτυχημένο build ή tests.

**Σημαντικό**: Αφού το Supabase Storage προστατεύει τους πίνακες από απευθείας SQL διαγραφή, ο κενός bucket `finance-receipts` μπορεί να διαγραφεί από Dashboard → Storage → Buckets → finance-receipts → Delete bucket. Όλοι οι πίνακες, RPC και δικαιώματα αποδείξεων έχουν ήδη αφαιρεθεί από την SQL migration.
