# ORGANOTIKO UPDATE v0.5 — οδηγίες εφαρμογής σε GitHub main

**Patch αρχείων, όχι νέο repository**. Δεν περιέχει `package-lock.json`, `.git`, `.env` ή πραγματικές εγγραφές.

1. Βεβαιώσου ότι οι τωρινές αλλαγές στο GitHub Desktop είναι αποθηκευμένες με Commit και Push.
2. Κατέβασε το `ORGANOTIKO_UPDATE_v0.5.zip` στον φάκελο Downloads του Mac.
3. Στο **GitHub Desktop → organotiko → Repository → Open in Terminal** βρίσκεσαι στη ρίζα του repository.
4. Εκτέλεσε:

   ```sh
   ditto -x -k ~/Downloads/ORGANOTIKO_UPDATE_v0.5.zip .
   npm install
   npm test
   node --test tests/fullscreen-ui.test.mjs
   npm run build
   ```

5. Αν ΟΛΕΣ οι εντολές περάσουν, επέστρεψε στο GitHub Desktop, έλεγξε τις αλλαγές, Commit στο `main` και Push origin. Το Netlify θα χτίσει αυτόματα.
6. Στο Netlify επιβεβαίωσε χειροκίνητα: Πίνακας → Πλήρης οθόνη → tick ΕΦΕΚΘ → εμφανίζεται η φόρμα, μπορείς να την ακυρώσεις, και το κουμπί εξόδου από πλήρη οθόνη λειτουργεί. Δοκίμασε και την καρτέλα φοιτητή σε fullscreen.

**Μην εφαρμόσεις νέες SQL migrations**: η v0.5 δεν περιλαμβάνει αλλαγές στη βάση. Δεν αλλάζουμε Cloudflare/domain ή το παραγωγικό Portal.

Η σωστή ένταξη του υπάρχοντος συστήματος Μελών/Bluepass έχει μείνει σε εκκρεμότητα μέχρι να επιθεωρηθεί το αρχικό ZIP/DB/schema.

Αναλυτική περιγραφή: `docs/RELEASE_v0.5.md`.
