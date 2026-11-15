-- PROTOPORIA PORTAL v2.1.0 RC3 — STAGING DATABASE UPDATE
-- Safe additive migration on existing 012 Finance RC2 staging schema.
-- Expected items are ongoing obligations, without mandatory month, date or estimated amount.
BEGIN;
DO $check$
BEGIN
 IF to_regclass('public.finance_expected') IS NULL OR to_regclass('public.event_kinds') IS NULL
   THEN RAISE EXCEPTION 'Apply 012 Finance RC2 before this update'; END IF;
END $check$;

ALTER TABLE public.finance_expected ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE public.finance_expected ALTER COLUMN expected_on DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.finance_expected_write(
 p_id uuid,p_direction text,p_title text,p_amount numeric,p_date date,p_account uuid DEFAULT NULL,
 p_register uuid DEFAULT NULL,p_event uuid DEFAULT NULL,p_note text DEFAULT '',p_status text DEFAULT 'pending',p_beneficiary text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_old jsonb:=NULL;
BEGIN
 PERFORM public.finance_check();
 IF p_direction NOT IN ('income','expense') OR p_status NOT IN ('pending','cancelled') OR
  (p_amount IS NOT NULL AND (p_amount<=0 OR p_amount>999999999.99 OR round(p_amount,2)<>p_amount)) OR char_length(btrim(p_title))<2 THEN RAISE EXCEPTION 'Μη έγκυρη αναμενόμενη συναλλαγή.'; END IF;
 IF p_register IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.finance_registers WHERE id=p_register AND direction=p_direction) THEN
  RAISE EXCEPTION 'Ασυμβατό έσοδο/έξοδο.'; END IF;
 IF p_event IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event) THEN RAISE EXCEPTION 'Άγνωστη εκδήλωση.'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.finance_expected(direction,title,amount,expected_on,account_id,register_id,event_id,note,status,beneficiary,created_by)
  VALUES(p_direction,btrim(p_title),p_amount,p_date,p_account,p_register,p_event,coalesce(p_note,''),p_status,coalesce(p_beneficiary,''),auth.uid()) RETURNING id INTO v_id;
  PERFORM public.finance_record('create','expected',v_id,jsonb_build_object('amount',p_amount));
 ELSE
  SELECT to_jsonb(e) INTO v_old FROM public.finance_expected e WHERE id=p_id FOR UPDATE;
  UPDATE public.finance_expected SET direction=p_direction,title=btrim(p_title),amount=p_amount,expected_on=p_date,
   account_id=p_account,register_id=p_register,event_id=p_event,note=coalesce(p_note,''),status=p_status,beneficiary=coalesce(p_beneficiary,'')
  WHERE id=p_id AND status IN ('pending','cancelled') RETURNING id INTO v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Δεν βρέθηκε η αναμενόμενη εγγραφή.'; END IF;
  PERFORM public.finance_record('update','expected',v_id,jsonb_build_object('before',v_old,'after',jsonb_build_object('direction',p_direction,'title',p_title,'amount',p_amount,'expected_on',p_date,'account_id',p_account,'register_id',p_register,'event_id',p_event,'status',p_status,'beneficiary',p_beneficiary,'note',p_note)));
 END IF;
 RETURN v_id;
END $$;


-- An unknown or approximate estimate becomes a confirmed amount at settlement.
-- Existing settlement RPC is retained for backwards compatibility, while the
-- new frontend always requires an actual positive amount when settling.
CREATE OR REPLACE FUNCTION public.finance_settle_expected_amount(
 p_id uuid,p_date date,p_account uuid,p_amount numeric,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_plan public.finance_expected%ROWTYPE; v_register uuid; v_tx uuid; v_alloc jsonb:='[]'::jsonb;
BEGIN
 PERFORM public.finance_check(p_date);
 IF p_date IS NULL THEN RAISE EXCEPTION 'Η πραγματική συναλλαγή χρειάζεται ημερομηνία.'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>999999999.99 OR round(p_amount,2)<>p_amount
 THEN RAISE EXCEPTION 'Συμπλήρωσε σωστό πραγματικό ποσό.'; END IF;
 SELECT * INTO v_plan FROM public.finance_expected WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_plan.status<>'pending' THEN
  RAISE EXCEPTION 'Η αναμενόμενη εγγραφή δεν είναι εκκρεμής.';
 END IF;
 v_register:=v_plan.register_id;
 IF v_register IS NULL THEN
  v_register:=public.finance_new_register(v_plan.direction,v_plan.title,NULL,v_plan.note);
 END IF;
 IF v_plan.event_id IS NOT NULL THEN
  v_alloc:=jsonb_build_array(jsonb_build_object('event_id',v_plan.event_id,'amount',p_amount));
 END IF;
 v_tx:=public.finance_post(v_plan.direction,p_date,p_amount,p_account,NULL,v_register,
     coalesce(nullif(btrim(p_note),''),v_plan.note),v_alloc);
 UPDATE public.finance_expected SET status='settled',settled_transaction_id=v_tx WHERE id=p_id;
 PERFORM public.finance_record('settle','expected',p_id,
   jsonb_build_object('transaction_id',v_tx,'estimated_amount',v_plan.amount,'actual_amount',p_amount));
 RETURN v_tx;
END $$;
REVOKE ALL ON FUNCTION public.finance_settle_expected_amount(uuid,date,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_settle_expected_amount(uuid,date,uuid,numeric,text) TO authenticated;

-- Reorder using arrows, without manually entering 10/20/30 sequence numbers.
-- All keys must be supplied exactly once, to prevent unintended omissions.
CREATE OR REPLACE FUNCTION public.event_kinds_reorder(p_keys text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Μόνο ο Admin αλλάζει τη σειρά.'; END IF;
 IF p_keys IS NULL OR cardinality(p_keys)<>(SELECT count(*) FROM public.event_kinds)
 OR EXISTS (SELECT 1 FROM public.event_kinds WHERE NOT (key=ANY(p_keys)))
 OR EXISTS (SELECT 1 FROM unnest(p_keys) AS vals(k) GROUP BY k HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM unnest(p_keys) AS vals(k) WHERE k IS NULL)
 THEN RAISE EXCEPTION 'Η λίστα τύπων άλλαξε. Ανανέωσε τη σελίδα.'; END IF;
 UPDATE public.event_kinds k SET sort_order=(u.ord::integer*10)
 FROM unnest(p_keys) WITH ORDINALITY AS u(key,ord) WHERE k.key=u.key;
END $$;
REVOKE ALL ON FUNCTION public.event_kinds_reorder(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_kinds_reorder(text[]) TO authenticated;

DO $verify$
BEGIN
 IF (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_expected' AND column_name='amount')<>'YES'
 OR (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_expected' AND column_name='expected_on')<>'YES'
 THEN RAISE EXCEPTION 'Expected amount/date still NOT NULL'; END IF;
END $verify$;
COMMIT;
