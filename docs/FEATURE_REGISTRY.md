# ΜΗΤΡΩΟ ΟΛΩΝ ΤΩΝ ΣΥΜΦΩΝΗΜΕΝΩΝ ΛΕΙΤΟΥΡΓΙΩΝ

Έκδοση ελέγχου: 2026-11-15 · Αφετηρία: αρχικές συζητήσεις, PROJECT_SPEC, demo v0.1–v0.3, αρχείο Access, ΝΟΥΜΕΡΑ.xlsx, και κώδικας Portal v2.1.11.

**Κανόνας κατάστασης:** `DOMAIN TESTED` = ελέγχθηκαν οι κανόνες κοινής λογικής, όχι η πλήρης λειτουργία UI/DB. `UI FIRST PASS` = υπάρχει μόνο αρχική λειτουργία στην πρώτη React εφαρμογή. `DB SCHEMA LIVE` = πίνακες/RLS εφαρμόστηκαν στο `organotiko`, **όχι πλήρες feature/UI**. `TO BUILD` = δεσμευτικό feature που δεν έχει κατασκευαστεί. `SOURCE PENDING` = χρειάζεται υλικό που δεν έχει δοθεί. `DEFERRED AGREED` = συνειδητά μεταγενέστερο. **Δεν χρησιμοποιείται «Ολοκληρωμένο» χωρίς end-to-end verification.**

## A — Κύρια εμπειρία

- [UI FIRST PASS] Αρχική μόνο **Πίνακας / Αναζήτηση / Analytics**, χωρίς υποτίτλους-οδηγίες, χωρίς ενοχλητικά στατιστικά ή «όλη η διαχείριση».
- [UI FIRST PASS] Ήσυχη, μινιμαλιστική εμφάνιση και συμπτυσσόμενο αριστερό sidebar, mobile panel.
- [TO BUILD] Πλήρως παραμετροποιήσιμο dashboard, reorder/hide αγαπημένα, reset ανά χρήστη, light/dark mode, πλήρης mobile UX/PWA χωρίς offline αποθήκευση προσωπικών δεδομένων.
- [UI FIRST PASS] Fullscreen πίνακας, count εγγραφών, inline edit, checkbox, διάταξη/αλλαγή πλάτους στηλών, αλφαβητικά dropdowns, φίλτρα κεφαλίδας, multi-filter, απλή ταξινόμηση, Ctrl-style keyboard navigation προς 4 κατευθύνσεις.
- [TO BUILD] Πλήρης virtualization/pagination για μεγάλα σύνολα με σωστή επιλογή/κύλιση, ανεξάρτητη οριζόντια μετακίνηση κελιών χωρίς αστοχίες.
- [TO BUILD] Περισσότερα είδη φίλτρων, AND/OR/groups, custom conditions, ορθά sorting null/typed values, πολλαπλά φίλτρα + προεπισκόπηση.
- [TO BUILD] Find & Replace, Preview/confirmation, bulk edit, bulk delete guarded, πολλαπλά-cell paste/copy, undo ασφαλών τοπικών edits.
- [TO BUILD] Προσωπικές/κοινές αποθηκευμένες προβολές, προσωπικό default, sort/filters/visible columns/width/order, από τρέχον φίλτρο δημιουργία προσχεδίου Συνεδρίασης.
- [UI FIRST PASS] Γρήγορη αναζήτηση χωρίς ελεύθερες ΠΛΗΡΟΦΟΡΙΕΣ, αναγνωρίσιμα αποτελέσματα.
- [TO BUILD] Πλήρης καρτέλα φοιτητή, ιστορικό εκδόσεων μόνο ΠΛΗΡΟΦΟΡΙΩΝ, χωρίς attachments, οργανωμένη mobile αναζήτηση/καρτέλα.
- [UI FIRST PASS] Εισαγωγή κάτω από πίνακα και βασική φόρμα νέου φοιτητή.
- [TO BUILD] Παραμετροποιήσιμη *πλήρης* φόρμα από Ρυθμίσεις, typed validations, dropdowns ανά τμήμα/πανεπιστήμιο, προκαταρκτικός έλεγχος πιθανών διπλοεγγραφών, fuzzy matching/επιβεβαιωμένο merge.
- [UI FIRST PASS] CSV τρέχουσας προβολής στο demo.
- [TO BUILD] Δύο τρόποι export (ορατές/όλες επιτρεπόμενες στήλες) XLSX/CSV/PDF με ενεργά φίλτρα/sort, print preview.
- [TO BUILD] Άμεση αποθήκευση Enter/Tab/blur με status, error retry, network loss states, field-specific concurrency + visible conflict resolution. Τωρινή πρόταση DB version είναι row-level stopgap, όχι τελικό field-level conflict.
- [TO BUILD] Realtime collaborative UI με ταυτόχρονη εργασία διαφορετικών πεδίων.

## B — Δεδομένα / μόνιμοι κανόνες

- [VERIFIED SOURCE] Καταγράφηκαν **52 πραγματικά πεδία** Access / 2057 εγγραφές. Λεπτομέρειες στο `ACCESS_FIELDS_52.md`. **Κανένα πραγματικό πρόσωπο στο staging demo.**
- [DB SCHEMA LIVE] Εσωτερικό αμετάβλητο person_id / student_id, ανεξάρτητο από «ΜΟΝΑΔΙΚΟΣ»· διάκριση «ΜΕΛΟΣ Πρωτοπορίας» vs «ΕΦΕΚΘ» vs Bluepass vs Στέλεχος.
- [TO BUILD] Όλα τα legacy πεδία και ιστορικά event snapshots — όχι απλή μεταφορά των 52 ως στατικών στηλών.
- [TO BUILD] Δυναμικές στήλες text/number/date/boolean/dropdown, διαχείριση validation, καθολική συμμετοχή σε table/search/reports/analytics.
- [TO BUILD] Κεντρικές λίστες τμημάτων, πανεπιστημίων, N διάρκειας, απενεργοποίηση/μετονομασία δίχως αλλοίωση ιστορικών σχέσεων.
- [TO BUILD] Αυτόματα κεφαλαία ελληνικών/λατινικών για συνήθη πεδία, εξαίρεση case-sensitive πεδίων, accent-insensitive search.
- [TO BUILD] Κατάσταση αποφοίτου (έτος `0`) / αρχειοθέτηση, τιμητικό `Π` διατηρείται, αποφυγή καταστροφής ιστορικών aggregates.
- [TO BUILD] Όλα τα custom fields της αρχικής λίστας ΑΔΤ, 2 τηλέφωνα, πόλη/χωριό, ΕΙΣΔΟΧΗ, παλαιά ειδικά πεδία με δικαιώματα.

## C — Πυρήνες

- [DB SCHEMA LIVE] Ξεχωριστός πίνακας Πυρήνων/Κατηγοριών/Ιστορικών αναθέσεων, ΠΥΡΗΝΑΣ2 ελεύθερο text.
- [UI FIRST PASS] Aggregate πλήθη ανά πυρήνα.
- [TO BUILD] Διαχείριση πυρήνων/κατηγοριών/χρωμάτων ή labels με κανόνες, rename, deactivate, αναθέσεις/ιστορικά.
- [TO BUILD] Πυρήνας1 ως στέλεχος/μέλος/εξωτερικός/κατηγορία/ΑΠΥΡΗΝΩΤΟΙ, όχι υποχρεωτικά student. Ετήσιες ονομασίες ΑΠ23/ΑΠ24 → ίδια category.
- [TO BUILD] Διαχείριση πολλών πυρήνων από χρήστη Portal, owner ID & δικαιώματα ανά πυρήνα, σύνδεση με account χωρίς αναγκαστική φοιτητική καρτέλα.
- [TO BUILD] Χρεωστικά ανά 1+ πυρήνες, σύνθετα φίλτρα/στήλες, ενιαίο PDF με νέα σελίδα ή ZIP PDFs, δικαιώματα και preview.

## D — ΕΦΕΚΘ / χρονικότητα

- [DOMAIN TESTED] Πρόθεση εγγραφής **`1 / 2 / 3 / κενό`** χωρίς πραγματική εγγραφή.
- [DOMAIN TESTED] Πραγματική νέα εγγραφή **μόνο `+ / ψ2 / ψ3 / ψ4 / ψ5 / Μ` και υποχρεωτική ημερομηνία**. **Νέα εγγραφή με κενό ΑΠΑΓΟΡΕΥΕΤΑΙ**. Πηγή επιλέγεται μαζί με το tick.
- [DOMAIN TESTED] ΕΦΕΚΘ=TRUE παραμένει TRUE στις επόμενες χρονιές, με **κενή** τιμή τρέχοντος ΕΓΓΡΑΦΕΣ εφόσον δεν υπάρχει νέα εγγραφή.
- [DB SCHEMA LIVE] Registration event source/date/student year-at-event, normalized yearly record, academic years, registration periods/day arrays.
- [UI FIRST PASS] Modal υποχρεωτικής πηγής + ημερομηνίας, και στον synthetic πίνακα κωδικοί πρόθεσης.
- [TO BUILD] Πραγματική επιβεβαιωμένη διαγραφή ΕΦΕΚΘ/ΜΟΝΑΔΙΚΟΣ με λόγο, ανάκληση, audit, χωρίς cron ή αυτόματη μεταβολή.
- [TO BUILD] Πολλές πραγματικές μέρες σε τέσσερις περιόδους (συν ΑΓΣ/ΒΓΣ και ειδικές), όχι μόνο contiguous date range.
- [TO BUILD] Ιστορικά γεγονότα με μοναδική ημερομηνία, κώδικα πηγής, περίοδο, έτος σπουδών τότε, επανεγγραφές, δικαιολογημένη διόρθωση.
- [DOMAIN TESTED] +1 ακαδημαϊκό έτος: 1→2, ολοκλήρωση διάρκειας N→Ν1, Ν1→Ν2, 91→92, 0 και Π διατήρηση· περιπτώσεις αβεβαιότητας απαιτούν ανθρώπινο έλεγχο.
- [UI FIRST PASS] Προεπισκόπηση χειροκίνητης δοκιμαστικής αναβάθμισης.
- [TO BUILD] Production annual upgrade: νέο έτος ΑΓΣ/ΒΓΣ/ΕΚΛ προθέσεων και πραγματικών αποτελεσμάτων, νέα ΕΓΓΡΑΦΕΣ, snapshots αμετάβλητα, archive/graduate rules, pre-backup, preview, operator consent, idempotency, rollback.
- [TO BUILD] Δυναμική/χειροκίνητη ημερήσια συγκεντρωτική διακύμανση κατά ενεργή περίοδο με timestamps και snapshots.

## E — Analytics / ΝΟΥΜΕΡΑ / αναφορές

- [VERIFIED SOURCE] `ΝΟΥΜΕΡΑ.xlsx`: 4 φύλλα **Π1, Π1-ΕΤΗ, ΟΛΙΚΑ, ΟΛΙΚΑ-ΕΤΗ**. Άξονες μέρα, πηγή/κατηγορία, έτος φοίτησης, περίοδος, ολικά, ποσοστά. Πίνακες «1 Χ, 2 Χ, Α ΓΣ, 1 Ε, 2 Ε, Β ΓΣ». **Η αντιστοίχιση κωδικών +/ψ2… σε στήλες του φύλλου ΔΕΝ έχει ακόμη τεκμηριωθεί· δεν την εφευρίσκουμε.**
- [UI FIRST PASS] Ενιαία κατηγορίες Analytics Οργανωτικό, ΕΦΕΚΘ, Μέλη, Bluepass· βασικά ομαδοποιημένα σύνολα με 1–2 διαστάσεις και προσθαφαίρεση widget στην τρέχουσα επίδειξη.
- [TO BUILD] Μόνιμες/προσωπικές/κοινές analytics widgets και σταθερές αναλύσεις ανά ενότητα, με permissions.
- [TO BUILD] ΕΦΕΚΘ ακριβή ημερήσια/περιοδικά/ανά έτος φοιτητή/πηγή στατιστικά 4×7 και παραλλαγές, σωστό zero denominator / σύγκριση έναντι προηγούμενου έτους δίπλα-δίπλα, πολλαπλά έτη, διακύμανση.
- [TO BUILD] Member & Bluepass Analytics από την πραγματική **άλλη** βάση, όχι από συνθετικά tick.
- [UI FIRST PASS] Δοκιμαστική λίστα προεπιλεγμένων αναφορών με δυνατότητα προσθήκης/αφαίρεσης.
- [TO BUILD] Πλήρης report designer templates/filters/group by/print/page size/orientation/headers, εξαγωγή XLSX/CSV/PDF, personal/shared/default, preview, ιστορικές συγκρίσεις και στατιστικά συνεδριάσεων.

## F — Συνεδριάσεις «ΟΡΓΑΝΩΤΙΚΟ» — όχι απλή καρτέλα

- [DOMAIN TESTED] Freeze IDs όταν **ξεκινά**, όχι όταν φτιάχνεται draft· αναγνωρίζει μοναδικούς εξετασμένους.
- [DB SCHEMA LIVE] Sessions/statuses, immutable initial list/snapshots, μοναδικό active ή paused βάσει DB unique partial index.
- [UI FIRST PASS] Προσωρινή οθόνη ανασκόπησης χωρίς τελικό editing-table workflow.
- [TO BUILD] 1–Ν nested AND/OR φίλτρα, ονομασμένα drafts/templates, κοινή χρήση, πολλαπλά προγραμματισμένα, αξιολόγηση φιλτραρισμένων αποτελεσμάτων **κατά την εκκίνηση**.
- [TO BUILD] Μόνο μία ACTIVE/PAUSED συνεδρίαση σε όλο το σύστημα, μόνο **ένας χειριστής** τη φορά, pause/handoff/resume από άλλο ORGANOTIKOS.
- [TO BUILD] Πίνακας συνεδρίασης, όχι cards/wizard. Enter/↓ commits + **mark προηγούμενος ως εξετάστηκε**, ↑ στην προηγούμενη γραμμή, Tab/Shift+Tab μεταξύ κελιών, no skip state, επάνοδος σε ήδη εξετασμένο.
- [TO BUILD] Frozen membership ακόμη κι αν αλλάξει ΠΥΡΗΝΑΣ1/φίλτρο. Temporary view filtering μόνο UI. ΟΧΙ νέα εγγραφή, ΟΧΙ extra quick search, ΟΧΙ live stat panels, μόνο **X/Y**.
- [TO BUILD] Κύκλος draft/active/paused/completed/cancelled, προειδοποίηση early finish/cancel, edits persist, completed immutable.
- [TO BUILD] Reports before/after, examined vs all original scope, changed people/fields, final diff vs edit count, external changes separated, custom indicators, full audit versioned immutable.

## G — Portal / Members / Bluepass / δημόσια ιστοσελίδα

- [VERIFIED SOURCE] Υπάρχει πηγαίος κώδικας Portal **v2.1.11** για σύγκριση και προσεκτική ενσωμάτωση. Δεν είναι βεβαιωμένο ότι είναι η τελευταία παραγωγική έκδοση.
- [TO BUILD] **100% ισοδύναμη λειτουργία Portal εσωτερικά στο Οργανωτικό**, **χωρίς redirect**. Τα δύο UI μοιράζονται packages/services/database.
- [TO BUILD] Ομάδες, εργασίες, assignments, checklists, comments, notifications, related events, role permissions, dashboard, filters.
- [TO BUILD] Εκδηλώσεις (είδη, χρονοδιάγραμμα, ακυρώσεις, templates, δεσμεύσεις εργασιών).
- [TO BUILD] Οικονομικά: λογαριασμοί, κατηγορίες, entries, μεταφορές, 2 legs, allocations, αναμενόμενα, φίλτρα, historical sources, monthly closures/reconciliations, audit, deletes όπως επιτρέπει ο κώδικας.
- [TO BUILD] SMS: sender IDs, contacts, lists, εξαιρέσεις, καμπάνιες, import templates, logs, κοινό module στο Portal και Οργανωτικό· όχι τρίτο app. Εξουσιοδοτημένη λίστα ΣΤΕΛΕΧΩΝ από τον Πίνακα.
- [SOURCE PENDING] Πηγαίος κώδικας και schema **ξεχωριστού Netlify dashboard** (Μέλη/Bluepass/Προσφορές/Newsletter/website settings) δεν έχει δοθεί.
- [TO BUILD] Μέλη και Bluepass → κύρια πλήρης διαχείριση Οργανωτικού, Προσφορές/Newsletter → κύρια Portal αλλά πλήρης πρόσβαση και μέσα στο Οργανωτικό.
- [TO BUILD] Επιβεβαιωμένο manual matching φοιτητή ↔ Member ↔ Bluepass με preview, χωρίς αυτόματη ταυτοποίηση/δημιουργία φοιτητή, χωρίς silent overwrite.
- [TO BUILD] Analytics Members/Bluepass στο κεντρικό Analytics του Οργανωτικού, όχι διάσπαρτα.
- [AGREED EXCLUSION] **Δεν υπάρχει «Ιστοσελίδα» sidebar**, website-only settings μένουν στο website dashboard. Άλλες ρυθμίσεις που μας αφορούν μεταφέρονται στις γενικές Ρυθμίσεις Οργανωτικού — όχι στο Portal.

## H — Authentication / δικαιώματα / καταγραφή

- [DB SCHEMA LIVE] Υφιστάμενη read foundation Supabase `organotiko` χρησιμοποιεί TOTP `aal2` + ξεχωριστό entitlement. Η νέο staged SQL συνεχίζει default deny.
- [UI FIRST PASS] Staging email/password + TOTP enrollment/challenge. **Username login ΔΕΝ έχει ακόμη υλοποιηθεί.**
- [TO BUILD] **Ένα Supabase Auth** κοινό Portal/Organotiko, users μόνο από Οργανωτικό, first-login mandatory password change, bulk account creation, 10 hashed single-use recovery codes, controlled reset/recovery, session revocation, permanent delete.
- [TO BUILD] Ρόλοι: ίσοι ORGANOTIKOS με πλήρη Organotiko + Portal ADMIN· MASTER Portal ADMIN ή ΗΓΕΣΙΑ και Organotiko rights υπό μεταγενέστερη απόφαση· μόνο Portal ADMIN/ΗΓΕΣΙΑ/ΣΥΝΤΟΝΙΣΤΗΣ/ΜΕΛΟΣ.
- [TO BUILD] Granular module permissions, nucleus permissions, Portal ADMIN **όχι** πρόσβαση Organotiko χωρίς οργανωτικό entitlement, MFA only mandatory Organotiko.
- [TO BUILD] RLS enforced server-side σε όλες τις exposed entities, principle of least privilege, secure audits; confidentiality and GDPR review for IDs/political data.
- [TO BUILD] Πλήρες immutable audit, ιστορικό αλλαγών, retention, backup of auth and storage.

## I — Υποδομή / ποιότητα / μεταφορά

- [VERIFIED SOURCE] Supabase project `organotiko` (separate from legacy `ORGANOSI`) έχει ήδη 6 προστατευμένους, άδειους πίνακες και read entitlement function. Η υπάρχουσα παραγωγή Portal έχει δική της βάση με περιεχόμενο· **δεν αγγίχτηκε**.
- [UI FIRST PASS] Νέα πραγματική οργανωμένη εφαρμογή React/Vite + shared domain package· πηγαίο Portal source διατηρημένο στο ίδιο repo προς μελλοντική κοινή σύνδεση.
- [DB SCHEMA LIVE] New staging migration με ετήσια records, registration event, event catalog, session lock, notes history, custom fields, views, analytics templates, audit, safe registration RPC.
- [TO BUILD] GitHub repo πραγματικό, CI/tests/PR, Netlify δύο deployments και env separation; Cloudflare αποκλειστικά DNS, ΚΑΝΕΝΑΣ Cloudflare Worker στο νέο production.
- [TO BUILD] Ubuntu 24/7 backup/jobs, κρυπτογραφημένη αποθήκευση, independent offsite backup, retention/rotation, alerts, περιοδικά restoration drills.
- [TO BUILD] Ελεγχόμενη εισαγωγή Access και Portal/website databases, mapping/dedup/validation, staging-first, backups, reconciliation, rollback/cutover χωρίς βλάβη παραγωγής.
- [TO BUILD] Ελεγχόμενο Access ODBC linked-table interface μέσω περιορισμένων ασφαλών views/RPC — όχι master DB credentials στο desktop.
- [TO BUILD] E2E tests πραγματικού browser + multiuser, backend RLS tests, performance/accessibility/security audit, durable centralized changelog.
- [DEFERRED AGREED] Ξεχωριστό εκλογικό σύστημα βάσει Google Sheets/Forms, μετά από επιθεώρηση πηγών· καμία αυτόματη εξατομικευμένη πολιτική πρόβλεψη/στόχευση.

## Όρια / μη διαπραγματεύσιμοι αρνητικοί κανόνες

Δεν υλοποιούμε: ανεξάρτητο SMS app, μεταφορά website-only ρυθμίσεων στο Portal, πλαστή live βάση για demo, silent production writes, αυτόματη ετήσια αναβάθμιση μέσω cron, αυτόματο ΕΦΕΚΘ FALSE, search μέσα σε ΠΛΗΡΟΦΟΡΙΕΣ, συνημμένα καρτέλας, wizard/cards αντί πίνακα συνεδρίασης, skip state, πρόσθετη γρήγορη αναζήτηση σε συνεδρίαση, αθόρυβη ταυτοποίηση Members/Bluepass, αυτόματο campaign targeting με πολιτικά χαρακτηριστικά.

## Ακριβής σειρά εργασιών (η υπόθεση δεν ισούται με υλοποίηση)

1. **M0 — Επαλήθευση και αρχικό repo**: αυτό το inventory, απομονωμένη εφαρμογή/monorepo, pure business rules, πρώτα tests, SQL plan. [ΣΗΜΕΡΑ]
2. **M1 — Staging ενεργό**: δημιουργία ξεχωριστού staging ή τοπικού Supabase, schema migrations, QA fake accounts/MFA/authorization, 260 synthetic records, stable Netlify preview, CI.
3. **M2 — Πίνακας**: All legacy fields, views, record editing/concurrency, multi-cell operations, searchable card, custom fields, managers.
4. **M3 — ΕΦΕΚΘ/έτος/ΝΟΥΜΕΡΑ**: normalized events, per-day/per-year reports, precise source matching, re-registration/withdrawal, annual conversion, snapshots, audit, restoration.
5. **M4 — Πυρήνες/συνεδριάσεις/αναφορές**: full workflows, many operators/permissions, immutable audit/report builder.
6. **M5 — Full Portal / website integration**: exact current Portal comparison, shared modules no redirects, website source inventory, Members/Bluepass matching, SMS, finance, tasks, offers, Newsletter.
7. **M6 — Production security + data migration**: all gates passing, backup & restore tests, final Access freeze/import, Portal cutover, monitored launch.

**Αλλαγές που θα στείλεις αργότερα μπαίνουν ως νέο item με απόφαση/δοκιμές, χωρίς να διαγράφουμε τα παλαιά.**
