-- v2.1.2: safely edit income/expense registers and individual posted movements.
-- Existing money movements are NEVER updated or deleted: an edited movement is
-- reversed and reposted in one PostgreSQL transaction, with a full audit trail.
-- Deployment prerequisites: finance migrations 012-015 installed.
BEGIN;

CREATE OR REPLACE FUNCTION public.finance_edit_entry(
  p_register uuid,
  p_direction text,
  p_title text,
  p_category uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_transaction uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_account uuid DEFAULT NULL,
  p_note text DEFAULT '',
  p_allocations jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_reg public.finance_registers%ROWTYPE;
  v_tx public.finance_transactions%ROWTYPE;
  v_old_account uuid;
  v_old_allocations jsonb;
  v_new_allocations jsonb;
  v_active integer;
  v_meta_changed boolean;
  v_payment_changed boolean := false;
  v_replacement uuid;
BEGIN
  PERFORM public.finance_check();
  SELECT * INTO v_reg FROM public.finance_registers WHERE id = p_register FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Η εγγραφή δεν βρέθηκε.'; END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('income', 'expense') OR
     char_length(btrim(coalesce(p_title, ''))) NOT BETWEEN 2 AND 200 OR
     char_length(coalesce(p_description, '')) > 3000 OR
     char_length(coalesce(p_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Μη έγκυρα στοιχεία εγγραφής.';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.finance_categories c
    WHERE c.id = p_category AND c.direction = p_direction
      AND (c.active OR c.id = v_reg.category_id)
  ) THEN RAISE EXCEPTION 'Επίλεξε συμβατή κατηγορία.'; END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) > 30 THEN
    RAISE EXCEPTION 'Μη έγκυρος επιμερισμός.';
  END IF;
  IF p_amount IS NOT NULL AND
    (p_amount <= 0 OR p_amount > 999999999.99 OR round(p_amount,2) <> p_amount OR p_date IS NULL OR p_account IS NULL)
  THEN RAISE EXCEPTION 'Για την πληρωμή απαιτούνται θετικό ποσό, ημερομηνία και λογαριασμός.'; END IF;

  -- Count *all* non-reversed payments, not just the month selected in the UI.
  SELECT count(*) INTO v_active FROM public.finance_transactions t
   WHERE t.register_id = p_register AND t.kind IN ('income','expense')
     AND NOT EXISTS (SELECT 1 FROM public.finance_transactions z WHERE z.reversed_transaction_id=t.id);

  v_meta_changed := v_reg.direction IS DISTINCT FROM p_direction OR
                    v_reg.title IS DISTINCT FROM btrim(p_title) OR
                    v_reg.category_id IS DISTINCT FROM p_category OR
                    v_reg.description IS DISTINCT FROM btrim(coalesce(p_description,''));

  IF v_reg.direction IS DISTINCT FROM p_direction THEN
    IF (p_transaction IS NULL AND v_active > 0) OR (p_transaction IS NOT NULL AND v_active <> 1) THEN
      RAISE EXCEPTION 'Για αλλαγή είδους πρέπει πρώτα να διορθωθούν οι υπόλοιπες κινήσεις.';
    END IF;
    IF EXISTS(SELECT 1 FROM public.finance_expected e WHERE e.register_id=p_register) THEN
      RAISE EXCEPTION 'Υπάρχει συνδεδεμένη πρόβλεψη. Δεν μπορεί να αλλάξει ο τύπος.';
    END IF;
  END IF;

  -- A locked accounting period must be respected even for its register metadata.
  IF v_meta_changed AND EXISTS (
    SELECT 1 FROM public.finance_transactions t
    JOIN public.finance_month_closes c ON c.month_start >= date_trunc('month',t.happened_on)::date
    WHERE t.register_id=p_register AND t.kind IN ('income','expense')
      AND NOT EXISTS(SELECT 1 FROM public.finance_transactions z WHERE z.reversed_transaction_id=t.id)
  ) THEN RAISE EXCEPTION 'Η εγγραφή περιέχει κλειδωμένο μήνα. Άνοιξέ τον πριν την αλλαγή.'; END IF;

  IF p_transaction IS NOT NULL THEN
    SELECT * INTO v_tx FROM public.finance_transactions t
       WHERE t.id=p_transaction AND t.register_id=p_register AND t.kind IN ('income','expense')
       FOR UPDATE;
    IF NOT FOUND OR EXISTS(
      SELECT 1 FROM public.finance_transactions z WHERE z.reversed_transaction_id=p_transaction
    ) THEN RAISE EXCEPTION 'Η πληρωμή δεν βρέθηκε ή έχει ήδη αντιλογιστεί.'; END IF;
    IF EXISTS(SELECT 1 FROM public.finance_expected e WHERE e.settled_transaction_id=p_transaction) THEN
      RAISE EXCEPTION 'Η κίνηση προέρχεται από πρόβλεψη. Χρειάζεται ειδική διόρθωση της πρόβλεψης.';
    END IF;
    SELECT l.account_id INTO v_old_account FROM public.finance_legs l WHERE l.transaction_id=p_transaction;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id',a.event_id,'amount',a.amount) ORDER BY a.event_id),'[]'::jsonb)
      INTO v_old_allocations FROM public.finance_allocations a WHERE a.transaction_id=p_transaction;
    SELECT COALESCE(jsonb_agg(e.value ORDER BY e.value->>'event_id'),'[]'::jsonb)
      INTO v_new_allocations FROM jsonb_array_elements(p_allocations) e;
    v_payment_changed := p_amount IS DISTINCT FROM v_tx.amount OR
      (p_amount IS NOT NULL AND (p_date IS DISTINCT FROM v_tx.happened_on OR
      p_account IS DISTINCT FROM v_old_account OR
      btrim(coalesce(p_note,'')) IS DISTINCT FROM v_tx.note OR
      v_new_allocations IS DISTINCT FROM v_old_allocations OR
      p_direction IS DISTINCT FROM v_tx.kind));
    IF v_payment_changed THEN
      PERFORM public.finance_check(v_tx.happened_on);
      IF p_amount IS NOT NULL THEN PERFORM public.finance_check(p_date); END IF;
    END IF;
  ELSIF p_amount IS NOT NULL THEN
    IF v_active <> 0 THEN RAISE EXCEPTION 'Η εγγραφή έχει ήδη πληρωμές. Επεξεργάσου τη συγκεκριμένη κίνηση.'; END IF;
    v_payment_changed := true;
  ELSIF jsonb_array_length(p_allocations) <> 0 THEN
    RAISE EXCEPTION 'Ο επιμερισμός απαιτεί πραγματική πληρωμή.';
  END IF;

  IF v_meta_changed THEN
    UPDATE public.finance_registers
     SET direction=p_direction, title=btrim(p_title), category_id=p_category,
         description=btrim(coalesce(p_description,''))
     WHERE id=p_register;
    PERFORM public.finance_record('edit_register','register',p_register,
      jsonb_build_object('before',to_jsonb(v_reg),'after',jsonb_build_object(
        'direction',p_direction,'title',btrim(p_title),'category_id',p_category,
        'description',btrim(coalesce(p_description,'')))));
  END IF;

  IF v_payment_changed THEN
    IF p_transaction IS NOT NULL THEN
      PERFORM public.finance_reverse(p_transaction,'Διόρθωση οικονομικής εγγραφής από τη φόρμα επεξεργασίας');
    END IF;
    IF p_amount IS NOT NULL THEN
      v_replacement := public.finance_post(p_direction,p_date,p_amount,p_account,NULL,p_register,p_note,p_allocations);
    END IF;
    PERFORM public.finance_record('edit_payment','register',p_register,
      jsonb_build_object('original_transaction',p_transaction,'replacement_transaction',v_replacement,
                         'new_amount',p_amount,'new_date',p_date,'new_account',p_account));
  END IF;
  RETURN p_register;
END;
$fn$;

REVOKE ALL ON FUNCTION public.finance_edit_entry(uuid,text,text,uuid,text,uuid,numeric,date,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_edit_entry(uuid,text,text,uuid,text,uuid,numeric,date,uuid,text,jsonb) TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon','public.finance_edit_entry(uuid,text,text,uuid,text,uuid,numeric,date,uuid,text,jsonb)','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.finance_edit_entry(uuid,text,text,uuid,text,uuid,numeric,date,uuid,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Incorrect finance edit RPC execution rights'; END IF;
END $verify$;
COMMIT;
