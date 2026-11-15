-- PROTOPORIA PORTAL v2.1.10: Admin-only permanent internal-transfer deletion.
-- No existing transfer is removed by this migration. Every deletion must be
-- explicitly requested by an authenticated admin through the application.
CREATE OR REPLACE FUNCTION public.finance_delete_transfer(
  p_transaction uuid,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_transfer public.finance_transactions%ROWTYPE;
  v_reverse_ids uuid[] := ARRAY[]::uuid[];
  v_related_ids uuid[] := ARRAY[]::uuid[];
  v_leg_count integer;
  v_negative_count integer;
  v_positive_count integer;
  v_leg_sum numeric;
  v_invalid_amount_count integer;
  v_snapshot jsonb;
  v_deleted integer;
  v_reverse_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Μόνο ο Admin μπορεί να διαγράψει οριστικά εσωτερική μεταφορά.';
  END IF;
  PERFORM public.finance_check();
  IF p_confirmation IS DISTINCT FROM 'ΔΙΑΓΡΑΦΗ' THEN
    RAISE EXCEPTION 'Απαιτείται επιβεβαίωση διαγραφής.';
  END IF;
  SELECT * INTO v_transfer
  FROM public.finance_transactions
  WHERE id=p_transaction AND kind='transfer'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Η μεταφορά δεν υπάρχει ή έχει ήδη διαγραφεί.';
  END IF;
  IF v_transfer.register_id IS NOT NULL OR v_transfer.reversed_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Η επιλεγμένη εγγραφή δεν είναι ανεξάρτητη εσωτερική μεταφορά.';
  END IF;
  PERFORM public.finance_check(v_transfer.happened_on);

  SELECT count(*),
         count(*) FILTER (WHERE l.delta < 0),
         count(*) FILTER (WHERE l.delta > 0),
         coalesce(sum(l.delta),0),
         count(*) FILTER (WHERE abs(l.delta) <> v_transfer.amount)
    INTO v_leg_count,v_negative_count,v_positive_count,v_leg_sum,v_invalid_amount_count
  FROM public.finance_legs l
  WHERE l.transaction_id=p_transaction;
  IF v_leg_count<>2 OR v_negative_count<>1 OR v_positive_count<>1
     OR v_leg_sum<>0 OR v_invalid_amount_count<>0 THEN
    RAISE EXCEPTION 'Οι λογιστικές κινήσεις της μεταφοράς είναι ασύμβατες· δεν έγινε διαγραφή.';
  END IF;

  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_reverse_ids
  FROM public.finance_transactions
  WHERE reversed_transaction_id=p_transaction;
  IF cardinality(v_reverse_ids)>1 OR EXISTS (
     SELECT 1 FROM public.finance_transactions
     WHERE reversed_transaction_id=ANY(v_reverse_ids)
  ) THEN
    RAISE EXCEPTION 'Μη αναμενόμενη αλυσίδα αντιλογισμών· η διαγραφή σταμάτησε.';
  END IF;
  v_related_ids := ARRAY[p_transaction] || v_reverse_ids;
  FOR v_reverse_date IN
    SELECT DISTINCT happened_on FROM public.finance_transactions WHERE id=ANY(v_reverse_ids)
  LOOP
    PERFORM public.finance_check(v_reverse_date);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.finance_allocations WHERE transaction_id=ANY(v_related_ids))
    OR EXISTS (SELECT 1 FROM public.finance_expected WHERE settled_transaction_id=ANY(v_related_ids))
  THEN
    RAISE EXCEPTION 'Η μεταφορά έχει άλλες συνδεδεμένες εγγραφές· δεν μπορεί να διαγραφεί.';
  END IF;

  SELECT jsonb_build_object(
    'reason','Οριστική διαγραφή μεταφοράς από Admin',
    'transfer',to_jsonb(v_transfer),
    'transactions',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
         FROM public.finance_transactions t WHERE t.id=ANY(v_related_ids)),'[]'::jsonb),
    'legs',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.transaction_id,l.account_id)
         FROM public.finance_legs l WHERE l.transaction_id=ANY(v_related_ids)),'[]'::jsonb),
    'historical_sources',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.source_id)
         FROM public.finance_historical_sources h WHERE h.transaction_id=ANY(v_related_ids)),'[]'::jsonb)
  ) INTO v_snapshot;
  PERFORM public.finance_record('permanent_delete_transfer','transaction',p_transaction,v_snapshot);

  DELETE FROM public.finance_historical_sources WHERE transaction_id=ANY(v_related_ids);
  DELETE FROM public.finance_legs WHERE transaction_id=ANY(v_related_ids);
  DELETE FROM public.finance_transactions WHERE id=ANY(v_reverse_ids);
  DELETE FROM public.finance_transactions WHERE id=p_transaction AND kind='transfer';
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  IF v_deleted<>1 THEN
    RAISE EXCEPTION 'Η διαγραφή δεν ολοκληρώθηκε. Δεν έγιναν αλλαγές.';
  END IF;
  RETURN jsonb_build_object('deleted_transfer',p_transaction,'deleted_transactions',cardinality(v_related_ids));
END;
$function$;
REVOKE ALL ON FUNCTION public.finance_delete_transfer(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_delete_transfer(uuid,text) TO authenticated;
