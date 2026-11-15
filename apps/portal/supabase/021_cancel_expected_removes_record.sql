-- v2.1.6: cancellation deletes an outstanding expectation (not a posted payment).
-- One production migration, transactionally safe and auditable.
BEGIN;
LOCK TABLE public.finance_expected IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$ BEGIN
 IF EXISTS(SELECT 1 FROM public.finance_expected WHERE status='cancelled' AND settled_transaction_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Cancelled expectations have posted payments; manual review required';
 END IF;
END $preflight$;
INSERT INTO public.finance_audit(actor_id,action,entity_kind,entity_id,details)
SELECT NULL,'cancel_delete_migration','expected',id,
 jsonb_build_object('before',to_jsonb(e),'reason','Εκκαθάριση ήδη ακυρωμένων προβλέψεων στη v2.1.6')
FROM public.finance_expected e WHERE status='cancelled';
DELETE FROM public.finance_expected WHERE status='cancelled' AND settled_transaction_id IS NULL;

CREATE OR REPLACE FUNCTION public.finance_expected_cancel_delete(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_old jsonb; v_deleted uuid;
BEGIN
 PERFORM public.finance_check();
 IF p_id IS NULL THEN RAISE EXCEPTION 'Δεν έχει επιλεγεί αναμενόμενη εγγραφή.'; END IF;
 SELECT to_jsonb(e) INTO v_old FROM public.finance_expected e WHERE id=p_id FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'Η πρόβλεψη δεν βρέθηκε ή έχει ήδη διαγραφεί.'; END IF;
 IF v_old->>'status'<>'pending' OR v_old->>'settled_transaction_id' IS NOT NULL THEN
  RAISE EXCEPTION 'Μόνο εκκρεμείς προβλέψεις χωρίς πραγματική συναλλαγή ακυρώνονται.';
 END IF;
 DELETE FROM public.finance_expected WHERE id=p_id AND status='pending' AND settled_transaction_id IS NULL RETURNING id INTO v_deleted;
 IF v_deleted IS NULL THEN RAISE EXCEPTION 'Η πρόβλεψη δεν διαγράφηκε.'; END IF;
 PERFORM public.finance_record('cancel_delete','expected',p_id,jsonb_build_object('before',v_old,'reason','Ακύρωση χρήστη'));
 RETURN v_deleted;
END $fn$;
REVOKE ALL ON FUNCTION public.finance_expected_cancel_delete(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_expected_cancel_delete(uuid) TO authenticated;
DO $verify$ BEGIN
 IF EXISTS(SELECT 1 FROM public.finance_expected WHERE status='cancelled') THEN RAISE EXCEPTION 'Legacy cancelled records remained'; END IF;
 IF has_function_privilege('anon','public.finance_expected_cancel_delete(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Function available to anonymous clients'; END IF;
END $verify$;
COMMIT;
