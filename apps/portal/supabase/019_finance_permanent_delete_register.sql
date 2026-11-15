-- v2.1.4: explicit, administrator-only permanent deletion of an income/expense register.
-- All related ledger postings, reversal postings, allocations, and historical import references
-- are removed in one Postgres transaction, with a complete audit snapshot retained.
-- If there are attached receipts or linked expected records, refuse rather than create orphans.
-- Earlier closed accounting periods can never be rewritten through this API.
BEGIN;

CREATE OR REPLACE FUNCTION public.finance_delete_register(
  p_register uuid,
  p_confirmation text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_register public.finance_registers%ROWTYPE;
  v_direct_ids uuid[] := ARRAY[]::uuid[];
  v_reversal_ids uuid[] := ARRAY[]::uuid[];
  v_all_ids uuid[] := ARRAY[]::uuid[];
  v_date date;
  v_tx_count integer;
  v_removed integer;
  v_snapshot jsonb;
BEGIN
  -- Never rely on UI permissions or on the mere existence of an authenticated JWT.
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Μόνο ο Admin μπορεί να διαγράψει οριστικά έσοδο ή έξοδο.';
  END IF;
  PERFORM public.finance_check();
  IF p_confirmation IS DISTINCT FROM 'ΔΙΑΓΡΑΦΗ' THEN
    RAISE EXCEPTION 'Απαιτείται επιβεβαίωση με τη λέξη ΔΙΑΓΡΑΦΗ.';
  END IF;
  IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Συμπλήρωσε αιτιολογία διαγραφής (5 έως 500 χαρακτήρες).';
  END IF;

  SELECT * INTO v_register FROM public.finance_registers WHERE id=p_register FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Η εγγραφή δεν βρέθηκε ή έχει ήδη διαγραφεί.'; END IF;
  IF v_register.direction NOT IN ('income','expense') THEN
    RAISE EXCEPTION 'Επιτρέπεται διαγραφή μόνο για έσοδα και έξοδα.';
  END IF;

  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_direct_ids
  FROM public.finance_transactions WHERE register_id=p_register;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_reversal_ids
  FROM public.finance_transactions WHERE reversed_transaction_id=ANY(v_direct_ids);
  v_all_ids := v_direct_ids || v_reversal_ids;
  v_tx_count := cardinality(v_all_ids);

  -- Never unlink an expected entry or erase a settled expected transaction silently.
  IF EXISTS (SELECT 1 FROM public.finance_expected e
             WHERE e.register_id=p_register OR e.settled_transaction_id=ANY(v_all_ids)) THEN
    RAISE EXCEPTION 'Υπάρχουν συνδεδεμένα Αναμενόμενα. Αποσύνδεσέ τα πριν από την οριστική διαγραφή.';
  END IF;
  -- Storage object deletion cannot be part of a Postgres SQL transaction. Fail safely.
  IF EXISTS (SELECT 1 FROM public.finance_files WHERE transaction_id=ANY(v_all_ids)) THEN
    RAISE EXCEPTION 'Υπάρχουν επισυναπτόμενα παραστατικά. Η οριστική διαγραφή εμποδίζεται για να μη μείνουν αρχεία χωρίς σύνδεση.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.finance_transactions WHERE reversed_transaction_id=ANY(v_reversal_ids)) THEN
    RAISE EXCEPTION 'Υπάρχουν μη αναμενόμενες εξαρτήσεις αντιλογισμού.';
  END IF;
  -- Respect monthly locks for every original and every reversal, not merely the selected UI month.
  FOR v_date IN SELECT DISTINCT happened_on FROM public.finance_transactions WHERE id=ANY(v_all_ids) LOOP
    PERFORM public.finance_check(v_date);
  END LOOP;

  -- Preserve a complete original image of deleted rows, including allocations and Excel provenance.
  SELECT jsonb_build_object(
    'reason',btrim(p_reason),
    'register',to_jsonb(v_register),
    'transactions',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.happened_on,t.id)
         FROM public.finance_transactions t WHERE t.id=ANY(v_all_ids)),'[]'::jsonb),
    'account_legs',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.transaction_id,l.account_id)
         FROM public.finance_legs l WHERE l.transaction_id=ANY(v_all_ids)),'[]'::jsonb),
    'event_allocations',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.transaction_id,a.event_id)
         FROM public.finance_allocations a WHERE a.transaction_id=ANY(v_all_ids)),'[]'::jsonb),
    'historical_sources',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_id)
         FROM public.finance_historical_sources s WHERE s.transaction_id=ANY(v_all_ids)),'[]'::jsonb),
    'deleted_transaction_count',v_tx_count
  ) INTO v_snapshot;
  PERFORM public.finance_record('permanent_delete','register',p_register,v_snapshot);

  DELETE FROM public.finance_historical_sources WHERE transaction_id=ANY(v_all_ids);
  DELETE FROM public.finance_allocations WHERE transaction_id=ANY(v_all_ids);
  DELETE FROM public.finance_legs WHERE transaction_id=ANY(v_all_ids);
  -- Remove reversal first; the self-referencing FK prevents deleting its original first.
  DELETE FROM public.finance_transactions WHERE id=ANY(v_reversal_ids);
  DELETE FROM public.finance_transactions WHERE id=ANY(v_direct_ids);
  DELETE FROM public.finance_registers WHERE id=p_register;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  IF v_removed<>1 THEN RAISE EXCEPTION 'Η διαγραφή δεν ολοκληρώθηκε και ακυρώθηκε.'; END IF;

  RETURN jsonb_build_object('deleted_register',p_register,'deleted_transactions',v_tx_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_delete_register(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_delete_register(uuid,text,text) TO authenticated;
COMMIT;
