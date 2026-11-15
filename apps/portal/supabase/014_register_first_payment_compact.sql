-- RC4: atomic register creation with optional first transaction.
-- Apply once, only after 012 and 013. Runs with existing finance access checks.
BEGIN;
DO $require_finance$ BEGIN
 IF to_regprocedure('public.finance_new_register(text,text,uuid,text)') IS NULL
    OR to_regprocedure('public.finance_post(text,date,numeric,uuid,uuid,uuid,text,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Finance migrations 012/013 must be installed first'; END IF;
END $require_finance$;
CREATE OR REPLACE FUNCTION public.finance_create_register_with_first_payment(
 p_direction text,p_title text,p_category uuid DEFAULT NULL,p_description text DEFAULT '',
 p_first_amount numeric DEFAULT NULL,p_date date DEFAULT NULL,p_account uuid DEFAULT NULL,p_event uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_register uuid; v_alloc jsonb:='[]'::jsonb;
BEGIN
 PERFORM public.finance_check();
 IF p_first_amount IS NULL THEN
  IF p_event IS NOT NULL THEN RAISE EXCEPTION 'Η σύνδεση εκδήλωσης απαιτεί πρώτη κίνηση.'; END IF;
 ELSE
  IF p_date IS NULL OR p_account IS NULL THEN
   RAISE EXCEPTION 'Απαιτούνται ημερομηνία και λογαριασμός για το πρώτο ποσό.';
  END IF;
  IF p_first_amount<=0 OR p_first_amount>999999999.99 OR round(p_first_amount,2)<>p_first_amount THEN
   RAISE EXCEPTION 'Το πρώτο ποσό δεν είναι έγκυρο.';
  END IF;
  IF p_event IS NOT NULL THEN
   v_alloc:=jsonb_build_array(jsonb_build_object('event_id',p_event,'amount',p_first_amount));
  END IF;
 END IF;
 v_register:=public.finance_new_register(p_direction,p_title,p_category,p_description);
 IF p_first_amount IS NOT NULL THEN
  PERFORM public.finance_post(p_direction,p_date,p_first_amount,p_account,NULL,v_register,'',v_alloc);
 END IF;
 RETURN v_register;
END $$;
REVOKE ALL ON FUNCTION public.finance_create_register_with_first_payment(text,text,uuid,text,numeric,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_create_register_with_first_payment(text,text,uuid,text,numeric,date,uuid,uuid) TO authenticated;
COMMIT;
