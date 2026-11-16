# ORGANOTIKO v0.4 — Κεντρικό περιβάλλον / Πίνακας / Ιστορικό

Ημερομηνία: 16/11/2026. Κώδικας για **development**, όχι τελική παραγωγή.

## Αλλαγές που έγιναν στον πηγαίο κώδικα

- Νέα responsive αρχική με χρηστικές επιλογές, μετρητές πραγματικού loaded dataset, συντομεύσεις και εργαλεία Portal.
- Sidebar: Βασικά / Διαχείριση / Portal / Ρυθμίσεις. Ομάδες, Εκδηλώσεις, Οικονομικά, SMS, Προσφορές, Newsletter εμφανίζονται ως ενότητες υπό ενοποίηση, όχι ως λειτουργικές.
- Κεντρικός πίνακας: 52 συμβατές **ονομασίες/προβολές** πεδίων από το Access inventory, παλαιές ΑΓΣ/ΒΓΣ/ΕΚΛ προθέσεις/αποτελέσματα ως ξεχωριστές στήλες, ιστορικές ετήσιες εγγραφές, resize/reorder, αλφαβητικές επιλογές, τιμές φίλτρου με αναζήτηση, contains/begins/ends/equals/not contains/is empty/is not empty, πολλαπλά φίλτρα AND, αποθηκευμένες προσωπικές προβολές στον browser, όλα τα εργαλεία μέσα στο fullscreen, σαφής έξοδος fullscreen, χωρίς # αύξοντα αριθμό, footer με σύνολα, προσθήκη γραμμής, Typeahead τμήματος/πανεπιστημίου/πυρήνα, Arrow↑↓←→/Enter, Space σε checkbox.
- ΕΦΕΚΘ: υποχρεωτική πηγή +,ψ2,ψ3,ψ4,ψ5,Μ και ημερομηνία στο FALSE→TRUE, αυτόματη διαγραφή ενεργής πρόθεσης, εμποδίζεται νέα πρόθεση 1/2/3 σε ήδη TRUE. Ιστορική πρόθεση παλαιού έτους δεν απορρίπτεται αυτομάτως.
- Αναζήτηση: χωρίς αποτελέσματα αρχικά, real-time και πολλαπλά κριτήρια, καρτέλα φοιτητή (drawer) με ετήσιο ιστορικό/γεγονότα.
- Analytics: ενιαίο UI με χωριστή ενότητα «Εγγραφές ΕΦΕΚΘ», αναλύσεις ανά ημέρα/πηγή, πρώτες συγκρίσεις ετών. Η αναλυτική διάσταση «έτος φοίτησης κατά την εγγραφή» διαβάζεται πλέον από το ιστορικό γεγονός `year_code_at_event` της Supabase, όχι από το τωρινό έτος. Δικά μου widgets 1–2 διαστάσεων μόνο σε browser. Οι 4 τελικές αναφορές ΝΟΥΜΕΡΑ είναι ακόμη υπό ανάπτυξη.
- Αναφορές: πρακτικά πρότυπα, επιλογή στηλών, φίλτρα, ομαδοποιήσεις, προεπισκόπηση και ασφαλές CSV (quoted values και προστασία από formula injection). Browser-only templates, όχι shared/DB/PDF ακόμα.
- Πυρήνες: συγκεντρωτικά/προσωρινές κατηγορίες και CSV χρεωστικών. Οι κατηγορίες UI είναι τοπικές, όχι η τελική multiuser υλοποίηση.
- Ρυθμίσεις: ξεχωριστές οθόνες και χειροκίνητες *συγκεκριμένες ημέρες* ανά περίοδο 1Χ,2Χ,ΑΓΣ,1Ε,2Ε,ΒΓΣ, και πρόσθετα γεγονότα. Προεπισκόπηση ετήσιας αναβάθμισης, διαμόρφωση φόρμας. Οι ημερομηνίες δεν είναι ακόμη κοινές στην DB.

## Πραγματική Supabase `organotiko`

Εφαρμόστηκαν δύο migrations στις 16/11/2026:
- `20261116135406_organotiko_v04_history_intent_and_registration.sql` — προδιαγραφές ιστορικών γεγονότων και write RPC με `aal2`/entitlement, βελτιωμένη EF registration που μηδενίζει την ενεργή πρόθεση.
- `20261116135426_organotiko_v04_nucleus_assignments_rpc.sql` — βασικές κατηγορίες/πυρήνες και εγκεκριμένη χρέωση ιστορικών αναθέσεων.

Στον server υπάρχουν 260 συνθετικοί φοιτητές. Αποτελέσματα ελέγχου: 260 φοιτητές, 5 ακαδημαϊκά έτη, 10 ιστορικά event definitions, 3 nuclei, 0 εγγεγραμμένοι με τρέχουσα πρόθεση 1/2/3. Χρήστης χωρίς εξουσιοδότηση δεν βλέπει event catalog.

**ΣΗΜΑΝΤΙΚΟ:** Η προσωρινή αντιστοίχιση τίτλων `ΑΓΣ25`, `ΕΚΛ26` κ.λπ. σε academic years είναι μόνο δοκιμαστική. Απαιτεί επιβεβαίωση ημερομηνιών πριν από μεταφορά πραγματικών δεδομένων. Η αντιστοίχιση του ΝΟΥΜΕΡΑ.xlsx `ΦΠΚ, ΚΦ, ΑΓ, ΜΠΕ, ΑΝΑΓ, Μ` με `+,ψ2,...` δεν έχει καθοριστεί, άρα δεν παράγονται παραπλανητικά τελικά στατιστικά.

## Δοκιμές

- 9 domain tests + 7 table-rules tests + 2 CSV safety tests = **18/18 passed**.
- TypeScript/TSX syntax: 12 files parsed without error; CSS syntax parsed with PostCSS.
- Basic semantic typecheck με προσωρινά ambient stubs: no non-contextual type errors. **Δεν αντικαθιστά πραγματικό `npm run build`**.
- Full `npm install` δεν ολοκληρώθηκε στο sandbox (npm registry DNS/network blocked), συνεπώς **δεν έχει επιβεβαιωθεί production Vite/tsc build ή browser E2E**.
- Security Advisor εξακολουθεί να προειδοποιεί για externally callable `SECURITY DEFINER` functions (καθεμία διαθέτει explicit `organotiko_can_write` authorization gate), καθώς και leaked-password protection disabled. Απαιτείται περαιτέρω security review πριν real data.

## Παραμένουν για τα επόμενα στάδια

- Όλες οι 52 στήλες να έχουν πραγματικό προσεκτικά αντιστοιχισμένο historical data schema, protected fields, validation, edit permissions.
- Full live multiuser saved views/reports/periods/widgets/nuclei, fine-grained concurrency, full batch editing, XLSX/PDF exports.
- Full Οργανωτικό sessions: ένα active/paused lock, one operator, immutable frozen IDs, editing table, X/Y, reports and history.
- Πλήρης υλοποίηση Portal μέσα στο Organotiko από κοινά modules χωρίς redirect, μεταφορά κοινής authentication/data, website ΜΕΛΗ/BLUEPASS sources, ΠΡΟΣΦΟΡΕΣ/NEWSLETTER.
- GDPR, roles and TOTP complete, backup, migration, performance/real-browser tests.

Δεν τροποποιήθηκε το Portal project `ORGANOSI` ούτε το Cloudflare.
