-- v2.1.5 Remove unused receipt subsystem entirely (not any financial ledger data).
-- Safe only while both finance_files and the dedicated Storage bucket are empty.
BEGIN;

-- Serialize any concurrent receipt writes during the preflight + removal.
LOCK TABLE public.finance_files IN ACCESS EXCLUSIVE MODE;
LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_files) THEN
    RAISE EXCEPTION 'Cannot remove receipt subsystem: finance_files contains rows.';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='finance-receipts') THEN
    RAISE EXCEPTION 'Cannot remove receipt subsystem: finance-receipts bucket has stored files.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='finance-receipts') THEN
    RAISE EXCEPTION 'Receipt bucket missing; inspect production before running this migration.';
  END IF;
END;
$preflight$;

-- finance_delete_register previously read finance_files: replace before dropping it.
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

REVOKE ALL ON FUNCTION public.finance_delete_register(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_delete_register(uuid,text,text) TO authenticated;

-- Remove the upload endpoint and its database table; access now impossible even for old clients.
DROP FUNCTION public.finance_attach(uuid,text,text);
DROP TABLE public.finance_files;

-- Supabase protects Storage bucket deletion via SQL. Revoke access; delete the empty bucket separately via Storage API or Dashboard.
DROP POLICY IF EXISTS finance_storage_upload ON storage.objects;
DROP POLICY IF EXISTS finance_storage_read ON storage.objects;

DO $verify$
BEGIN
  IF to_regclass('public.finance_files') IS NOT NULL OR
     to_regprocedure('public.finance_attach(uuid,text,text)') IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
             AND policyname IN ('finance_storage_upload','finance_storage_read')) THEN
    RAISE EXCEPTION 'Receipt removal incomplete. Rolling back entire transaction.';
  END IF;
END;
$verify$;
COMMIT;
