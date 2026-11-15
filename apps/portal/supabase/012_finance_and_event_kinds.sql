-- PROTOPORIA PORTAL 2.1.0 — FINANCE + ADMIN EVENT KINDS
-- Additive migration. No existing balances, historical records, profiles or events are altered.
-- Apply only after reviewing the staging build and taking a database backup.

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS finance_manager boolean NOT NULL DEFAULT false;
GRANT UPDATE (finance_manager) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.can_use_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active IS TRUE
   AND (role IN ('admin','leadership') OR finance_manager IS TRUE));
$$;
REVOKE ALL ON FUNCTION public.can_use_finance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_finance() TO authenticated;

-- ADMIN-MANAGED EVENT TYPES: stable keys, editable names/order/colors, soft disable, protected deletion.
CREATE TABLE IF NOT EXISTS public.event_kinds (
 key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,69}$'),
 label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 80),
 color text NOT NULL DEFAULT '#3766ae' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
 sort_order integer NOT NULL DEFAULT 100,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.event_kinds (key,label,sort_order) VALUES
 ('meeting','Συνεδρία',10),('event','Εκδήλωση',20),('party','Πάρτι',30),
 ('efekth','ΕΦΕΚΘ',40),('mobilization','Κινητοποίηση',50),
 ('conference','Συνέδριο',60),('other','Άλλο',70)
 ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_kind_check;
ALTER TABLE public.event_task_templates DROP CONSTRAINT IF EXISTS event_task_templates_kind_check;
ALTER TABLE public.events ADD CONSTRAINT events_kind_catalog_fk FOREIGN KEY (kind) REFERENCES public.event_kinds(key) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.event_task_templates ADD CONSTRAINT templates_kind_catalog_fk FOREIGN KEY (kind) REFERENCES public.event_kinds(key) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.validate_active_event_kind()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM public.event_kinds WHERE key=NEW.kind AND active) THEN RAISE EXCEPTION 'Ο τύπος εκδήλωσης δεν είναι ενεργός.'; END IF;
 ELSIF NEW.kind IS DISTINCT FROM OLD.kind AND NOT EXISTS
    (SELECT 1 FROM public.event_kinds WHERE key=NEW.kind AND active) THEN
  RAISE EXCEPTION 'Ο τύπος εκδήλωσης δεν είναι ενεργός.';
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS events_check_active_kind ON public.events;
CREATE TRIGGER events_check_active_kind BEFORE INSERT OR UPDATE OF kind ON public.events
 FOR EACH ROW EXECUTE FUNCTION public.validate_active_event_kind();
DROP TRIGGER IF EXISTS templates_check_active_kind ON public.event_task_templates;
CREATE TRIGGER templates_check_active_kind BEFORE INSERT OR UPDATE OF kind ON public.event_task_templates
 FOR EACH ROW EXECUTE FUNCTION public.validate_active_event_kind();
CREATE OR REPLACE FUNCTION public.event_kind_change_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(auth.uid(),'event_kind',coalesce(NEW.key,OLD.key),lower(TG_OP),
        jsonb_build_object('old',CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
                           'new',CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END));
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER event_kind_change_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.event_kinds
 FOR EACH ROW EXECUTE FUNCTION public.event_kind_change_audit();
ALTER TABLE public.event_kinds ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_kinds_read ON public.event_kinds FOR SELECT TO authenticated USING (public.is_active());
CREATE POLICY event_kinds_insert ON public.event_kinds FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY event_kinds_update ON public.event_kinds FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY event_kinds_delete ON public.event_kinds FOR DELETE TO authenticated USING (public.is_admin());
GRANT SELECT,INSERT,DELETE ON public.event_kinds TO authenticated;
GRANT UPDATE (label,color,sort_order,active) ON public.event_kinds TO authenticated;

CREATE POLICY events_read_finance ON public.events FOR SELECT TO authenticated USING (public.can_use_finance());

CREATE TABLE public.finance_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code IN ('cash','bank','revolut','deposit')),
 name text NOT NULL,
 sort_order smallint NOT NULL,
 is_deposit boolean NOT NULL DEFAULT false
);
INSERT INTO public.finance_accounts(code,name,sort_order,is_deposit) VALUES
 ('cash','Μετρητά',1,false),('bank','Τράπεζα',2,false),
 ('revolut','Revolut',3,false),('deposit','Καταθετικός',4,true);

CREATE TABLE public.finance_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 direction text NOT NULL CHECK (direction IN ('income','expense')),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
 active boolean NOT NULL DEFAULT true,
 UNIQUE (direction,name)
);
INSERT INTO public.finance_categories(direction,name) VALUES
 ('income','Συνδρομές / εγγραφές'),('income','Εκδηλώσεις'),('income','Χορηγίες'),('income','Άλλα έσοδα'),
 ('expense','Εγγραφές ΕΦΕΚΘ'),('expense','Εκδηλώσεις'),('expense','Μετακινήσεις'),
 ('expense','Υλικά / εξοπλισμός'),('expense','Λειτουργικά'),('expense','Άλλα έξοδα');

-- A register is a persistent umbrella record (e.g. "Εγγραφές ΕΦΕΚΘ") containing multiple payments.
CREATE TABLE public.finance_registers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 direction text NOT NULL CHECK (direction IN ('income','expense')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 category_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
 description text NOT NULL DEFAULT '' CHECK (char_length(description)<=3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Immutable posted journal. Every transaction has 1 or 2 balanced account legs,
-- except external income/expense/opening, which legitimately has one account leg.
CREATE TABLE public.finance_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('income','expense','transfer','opening','reversal')),
 register_id uuid REFERENCES public.finance_registers(id) ON DELETE RESTRICT,
 amount numeric(14,2) NOT NULL CHECK (amount >= 0 AND amount <= 999999999.99 AND (amount > 0 OR kind='opening')),
 happened_on date NOT NULL,
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=2000),
 reversed_transaction_id uuid UNIQUE REFERENCES public.finance_transactions(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 CHECK ((kind IN ('income','expense')) = (register_id IS NOT NULL)),
 CHECK ((kind='reversal')=(reversed_transaction_id IS NOT NULL))
);
CREATE INDEX finance_transactions_date_idx ON public.finance_transactions(happened_on,id);
CREATE INDEX finance_transactions_reg_idx ON public.finance_transactions(register_id,happened_on);
CREATE TABLE public.finance_legs (
 transaction_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
 delta numeric(14,2) NOT NULL CHECK (delta <> 0),
 PRIMARY KEY (transaction_id,account_id)
);
CREATE INDEX finance_legs_account_idx ON public.finance_legs(account_id);

CREATE TABLE public.finance_allocations (
 transaction_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
 amount numeric(14,2) NOT NULL CHECK (amount <> 0),
 PRIMARY KEY(transaction_id,event_id)
);

CREATE TABLE public.finance_expected (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 direction text NOT NULL CHECK (direction IN ('income','expense')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 amount numeric(14,2) NOT NULL CHECK (amount > 0),
 expected_on date NOT NULL,
 account_id uuid REFERENCES public.finance_accounts(id),
 register_id uuid REFERENCES public.finance_registers(id) ON DELETE SET NULL,
 event_id uuid REFERENCES public.events(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','cancelled')),
 beneficiary text NOT NULL DEFAULT '' CHECK(char_length(beneficiary)<=180),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 settled_transaction_id uuid REFERENCES public.finance_transactions(id) ON DELETE RESTRICT
);
CREATE TABLE public.finance_month_closes (
 month_start date PRIMARY KEY CHECK (EXTRACT(DAY FROM month_start)=1),
 snapshot jsonb NOT NULL,
 closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 closed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.finance_accounts(id),
 happened_on date NOT NULL,
 actual_balance numeric(14,2) NOT NULL,
 note text NOT NULL DEFAULT '',
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE RESTRICT,
 storage_path text NOT NULL UNIQUE CHECK (char_length(storage_path)<=300),
 original_name text NOT NULL CHECK(char_length(original_name) BETWEEN 1 AND 200),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 action text NOT NULL,
 entity_kind text NOT NULL,
 entity_id uuid,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 happened_at timestamptz NOT NULL DEFAULT now()
);

-- Audit delegation without exposing transaction data to ordinary members.
CREATE OR REPLACE FUNCTION public.finance_permission_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.finance_manager IS DISTINCT FROM OLD.finance_manager THEN
  INSERT INTO public.finance_audit(actor_id,action,entity_kind,entity_id,details)
  VALUES(auth.uid(),'finance_access_change','profile',NEW.id,
   jsonb_build_object('old',OLD.finance_manager,'new',NEW.finance_manager));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_permission_audit_trigger AFTER UPDATE OF finance_manager ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.finance_permission_audit();

-- Strict separation: authenticated users may SELECT only with finance permission.
-- NO direct client INSERT/UPDATE/DELETE on financial tables; all writes use guarded RPCs.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance_accounts','finance_categories','finance_registers','finance_transactions','finance_legs','finance_allocations','finance_expected','finance_month_closes','finance_reconciliations','finance_files','finance_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_use_finance())',t||'_read',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.finance_check(p_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_use_finance() THEN RAISE EXCEPTION 'Απαγορεύεται η οικονομική διαχείριση.'; END IF;
 IF p_date IS NOT NULL AND EXISTS(SELECT 1 FROM public.finance_month_closes
   WHERE month_start >= date_trunc('month',p_date)::date) THEN
  RAISE EXCEPTION 'Ο μήνας έχει κλειδώσει. Πρέπει πρώτα να ανοίξει από Admin.';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finance_record(p_action text,p_kind text,p_id uuid,p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.finance_audit(actor_id,action,entity_kind,entity_id,details)
 VALUES(auth.uid(),p_action,p_kind,p_id,COALESCE(p_details,'{}'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.finance_category_admin(p_id uuid,p_direction text,p_name text,p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_old jsonb:=NULL;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Μόνο Admin διαχειρίζεται οικονομικές κατηγορίες.'; END IF;
 IF p_direction NOT IN ('income','expense') OR char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Μη έγκυρη κατηγορία.'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.finance_categories(direction,name,active) VALUES(p_direction,btrim(p_name),coalesce(p_active,true)) RETURNING id INTO v_id;
 ELSE
  SELECT to_jsonb(c) INTO v_old FROM public.finance_categories c WHERE id=p_id FOR UPDATE;
  UPDATE public.finance_categories SET name=btrim(p_name),active=coalesce(p_active,true)
  WHERE id=p_id AND direction=p_direction RETURNING id INTO v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Δεν βρέθηκε η κατηγορία.'; END IF;
 END IF;
 PERFORM public.finance_record('category_change','category',v_id,jsonb_build_object('before',v_old,'after',jsonb_build_object('name',p_name,'active',p_active,'direction',p_direction)));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_new_register(p_direction text,p_title text,p_category uuid DEFAULT NULL,p_description text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.finance_check();
 IF p_direction NOT IN ('income','expense') THEN RAISE EXCEPTION 'Μη έγκυρος τύπος.'; END IF;
 IF p_category IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.finance_categories WHERE id=p_category AND direction=p_direction AND active) THEN
  RAISE EXCEPTION 'Η κατηγορία δεν αντιστοιχεί στο έσοδο/έξοδο.';
 END IF;
 INSERT INTO public.finance_registers(direction,title,category_id,description,created_by)
 VALUES(p_direction,btrim(p_title),p_category,btrim(coalesce(p_description,'')),auth.uid()) RETURNING id INTO v_id;
 PERFORM public.finance_record('create','register',v_id,jsonb_build_object('direction',p_direction,'title',p_title));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_post(
 p_kind text,p_date date,p_amount numeric,p_account uuid,p_to_account uuid DEFAULT NULL,
 p_register uuid DEFAULT NULL,p_note text DEFAULT '',p_allocations jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_direction text; v_entry jsonb; v_alloc_sum numeric(14,2):=0; v_event uuid; v_amt numeric; v_count integer:=0;
BEGIN
 PERFORM public.finance_check(p_date);
 IF (SELECT count(DISTINCT entity_id) FROM public.finance_audit WHERE action='opening' AND entity_kind='account') < 4 THEN
  RAISE EXCEPTION 'Πρέπει πρώτα να οριστούν αρχικά υπόλοιπα και για τους 4 λογαριασμούς.';
 END IF;
 IF p_date < (SELECT min((details->>'date')::date) FROM public.finance_audit WHERE action='opening' AND entity_kind='account') THEN
  RAISE EXCEPTION 'Η κίνηση προηγείται της έναρξης του οικονομικού ημερολογίου.';
 END IF;
 IF p_kind NOT IN ('income','expense','transfer') OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999.99 OR round(p_amount,2) <> p_amount THEN
  RAISE EXCEPTION 'Μη έγκυρη συναλλαγή / ποσό.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.finance_accounts WHERE id=p_account) THEN RAISE EXCEPTION 'Άγνωστος λογαριασμός.'; END IF;
 IF p_kind='transfer' THEN
  IF p_register IS NOT NULL OR p_to_account IS NULL OR p_account=p_to_account OR NOT EXISTS(SELECT 1 FROM public.finance_accounts WHERE id=p_to_account) THEN
   RAISE EXCEPTION 'Η μεταφορά απαιτεί δύο διαφορετικούς λογαριασμούς.';
  END IF;
  IF coalesce(jsonb_array_length(p_allocations),0)<>0 THEN RAISE EXCEPTION 'Οι μεταφορές δεν συνδέονται με εκδηλώσεις ως έσοδα/έξοδα.'; END IF;
 ELSE
  IF p_to_account IS NOT NULL THEN RAISE EXCEPTION 'Το έσοδο/έξοδο αφορά έναν λογαριασμό.'; END IF;
  SELECT direction INTO v_direction FROM public.finance_registers WHERE id=p_register;
  IF v_direction IS DISTINCT FROM p_kind THEN RAISE EXCEPTION 'Επίλεξε αντίστοιχη εγγραφή εσόδου/εξόδου.'; END IF;
 END IF;
 IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations)>30 THEN RAISE EXCEPTION 'Μη έγκυρος επιμερισμός.'; END IF;
 -- Validate all allocations BEFORE posting, to avoid partial writes.
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_allocations) LOOP
  v_event:=(v_entry->>'event_id')::uuid;
  v_amt:=(v_entry->>'amount')::numeric;
  IF v_amt IS NULL OR v_amt<=0 OR round(v_amt,2)<>v_amt OR NOT EXISTS(SELECT 1 FROM public.events WHERE id=v_event) THEN
   RAISE EXCEPTION 'Μη έγκυρο ποσό/εκδήλωση στον επιμερισμό.';
  END IF;
  v_alloc_sum:=v_alloc_sum+v_amt;
  v_count:=v_count+1;
 END LOOP;
 IF v_alloc_sum>p_amount THEN RAISE EXCEPTION 'Ο επιμερισμός υπερβαίνει το ποσό.'; END IF;
 IF (SELECT count(DISTINCT value->>'event_id') FROM jsonb_array_elements(p_allocations))<>v_count THEN
  RAISE EXCEPTION 'Μία εκδήλωση μπορεί να εμφανιστεί μόνο μία φορά ανά κίνηση.';
 END IF;
 INSERT INTO public.finance_transactions(kind,register_id,amount,happened_on,note,created_by)
 VALUES(p_kind,p_register,p_amount,p_date,btrim(coalesce(p_note,'')),auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.finance_legs(transaction_id,account_id,delta)
 VALUES(v_id,p_account,CASE WHEN p_kind='income' THEN p_amount ELSE -p_amount END);
 IF p_kind='transfer' THEN
  INSERT INTO public.finance_legs(transaction_id,account_id,delta) VALUES(v_id,p_to_account,p_amount);
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_allocations) LOOP
  INSERT INTO public.finance_allocations(transaction_id,event_id,amount)
  VALUES(v_id,(v_entry->>'event_id')::uuid,(v_entry->>'amount')::numeric);
 END LOOP;
 PERFORM public.finance_record('post','transaction',v_id,jsonb_build_object('kind',p_kind,'amount',p_amount,'date',p_date));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_opening(p_date date,p_account uuid,p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.finance_check(p_date);
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Το αρχικό υπόλοιπο ορίζεται μόνο από Admin.'; END IF;
 IF p_amount IS NULL OR p_amount<0 OR round(p_amount,2)<>p_amount OR p_amount>999999999.99 THEN RAISE EXCEPTION 'Μη έγκυρο αρχικό υπόλοιπο.'; END IF;
 IF p_date IS NULL OR EXTRACT(DAY FROM p_date)<>1 THEN RAISE EXCEPTION 'Η ημερομηνία αρχικών υπολοίπων πρέπει να είναι η πρώτη του μήνα.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_accounts WHERE id=p_account) THEN RAISE EXCEPTION 'Άγνωστος λογαριασμός.'; END IF;
 IF EXISTS(SELECT 1 FROM public.finance_legs WHERE account_id=p_account) OR EXISTS(SELECT 1 FROM public.finance_audit WHERE action='opening' AND entity_kind='account' AND entity_id=p_account) THEN RAISE EXCEPTION 'Υπάρχουν ήδη κινήσεις ή αρχικό υπόλοιπο σε αυτόν τον λογαριασμό.'; END IF;
 IF EXISTS(SELECT 1 FROM public.finance_audit WHERE action='opening' AND entity_kind='account' AND (details->>'date')::date IS DISTINCT FROM p_date) THEN RAISE EXCEPTION 'Όλοι οι λογαριασμοί πρέπει να έχουν κοινή ημερομηνία εκκίνησης.'; END IF;
 IF EXISTS(SELECT 1 FROM public.finance_transactions WHERE happened_on<p_date) THEN RAISE EXCEPTION 'Το αρχικό υπόλοιπο πρέπει να προηγείται όλων των κινήσεων.'; END IF;
 INSERT INTO public.finance_transactions(kind,amount,happened_on,note,created_by)
 VALUES('opening',p_amount,p_date,'Αρχικό υπόλοιπο',auth.uid()) RETURNING id INTO v_id;
 -- An initial 0.00 is represented by an opening marker without a leg; never invent 0.01 of balance.
 IF p_amount>0 THEN INSERT INTO public.finance_legs VALUES(v_id,p_account,p_amount); END IF;
 PERFORM public.finance_record('opening','account',p_account,jsonb_build_object('amount',p_amount,'date',p_date,'tx',v_id));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_reverse(p_transaction uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old public.finance_transactions%ROWTYPE; v_id uuid; v_leg record;
BEGIN
 IF char_length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Αιτιολόγησε τον αντιλογισμό (5+ χαρακτήρες).'; END IF;
 SELECT * INTO v_old FROM public.finance_transactions WHERE id=p_transaction FOR UPDATE;
 IF NOT FOUND OR v_old.kind NOT IN ('income','expense','transfer') THEN RAISE EXCEPTION 'Η κίνηση δεν μπορεί να αντιλογιστεί.'; END IF;
 PERFORM public.finance_check(v_old.happened_on);
 IF EXISTS (SELECT 1 FROM public.finance_transactions WHERE reversed_transaction_id=p_transaction) THEN RAISE EXCEPTION 'Η κίνηση έχει ήδη αντιλογιστεί.'; END IF;
 INSERT INTO public.finance_transactions(kind,amount,happened_on,note,reversed_transaction_id,created_by)
 VALUES('reversal',v_old.amount,v_old.happened_on,btrim(p_reason),p_transaction,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.finance_legs(transaction_id,account_id,delta)
 SELECT v_id,account_id,-delta FROM public.finance_legs WHERE transaction_id=p_transaction;
 INSERT INTO public.finance_allocations(transaction_id,event_id,amount)
 SELECT v_id,event_id,-amount FROM public.finance_allocations WHERE transaction_id=p_transaction;
 PERFORM public.finance_record('reverse','transaction',p_transaction,jsonb_build_object('reversal_id',v_id,'reason',p_reason));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_expected_write(
 p_id uuid,p_direction text,p_title text,p_amount numeric,p_date date,p_account uuid DEFAULT NULL,
 p_register uuid DEFAULT NULL,p_event uuid DEFAULT NULL,p_note text DEFAULT '',p_status text DEFAULT 'pending',p_beneficiary text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_old jsonb:=NULL;
BEGIN
 PERFORM public.finance_check();
 IF p_direction NOT IN ('income','expense') OR p_status NOT IN ('pending','cancelled') OR
  p_amount<=0 OR round(p_amount,2)<>p_amount OR char_length(btrim(p_title))<2 THEN RAISE EXCEPTION 'Μη έγκυρη αναμενόμενη συναλλαγή.'; END IF;
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

-- Turn an expected amount into a real payment atomically, then close the plan.
CREATE OR REPLACE FUNCTION public.finance_settle_expected(p_id uuid,p_date date,p_account uuid,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_plan public.finance_expected%ROWTYPE; v_register uuid; v_tx uuid; v_alloc jsonb:='[]'::jsonb;
BEGIN
 SELECT * INTO v_plan FROM public.finance_expected WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_plan.status<>'pending' THEN RAISE EXCEPTION 'Η αναμενόμενη εγγραφή δεν είναι εκκρεμής.'; END IF;
 PERFORM public.finance_check(p_date);
 v_register:=v_plan.register_id;
 IF v_register IS NULL THEN
  v_register:=public.finance_new_register(v_plan.direction,v_plan.title,NULL,v_plan.note);
 END IF;
 IF v_plan.event_id IS NOT NULL THEN
  v_alloc:=jsonb_build_array(jsonb_build_object('event_id',v_plan.event_id,'amount',v_plan.amount));
 END IF;
 v_tx:=public.finance_post(v_plan.direction,p_date,v_plan.amount,p_account,NULL,v_register,coalesce(nullif(btrim(p_note),''),v_plan.note),v_alloc);
 UPDATE public.finance_expected SET status='settled',settled_transaction_id=v_tx WHERE id=p_id;
 PERFORM public.finance_record('settle','expected',p_id,jsonb_build_object('transaction_id',v_tx));
 RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public.finance_close_month(p_month date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_snapshot jsonb;
BEGIN
 IF p_month IS NULL OR EXTRACT(DAY FROM p_month)<>1 OR p_month >= date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Κλείνουν μόνο προηγούμενοι μήνες.'; END IF;
 PERFORM public.finance_check(p_month);
 IF (SELECT count(DISTINCT entity_id) FROM public.finance_audit WHERE action='opening' AND entity_kind='account') < 4 THEN RAISE EXCEPTION 'Οριστικοποίησε τα 4 αρχικά υπόλοιπα πριν κλείσεις μήνα.'; END IF;
 IF p_month < (SELECT min((details->>'date')::date) FROM public.finance_audit WHERE action='opening' AND entity_kind='account') THEN RAISE EXCEPTION 'Δεν μπορείς να κλείσεις μήνα πριν την εκκίνηση.'; END IF;
 -- The month cannot be closed if an earlier month has unclosed recorded transactions.
 IF EXISTS(SELECT 1 FROM public.finance_transactions t
  WHERE t.happened_on < p_month AND NOT EXISTS (
   SELECT 1 FROM public.finance_month_closes c WHERE c.month_start=date_trunc('month',t.happened_on)::date))
  THEN RAISE EXCEPTION 'Κλείσε πρώτα τους προηγούμενους μήνες με κινήσεις.'; END IF;
 SELECT jsonb_build_object('month',p_month,'accounts',
  (SELECT jsonb_object_agg(a.code,coalesce((SELECT sum(l.delta) FROM public.finance_legs l
   JOIN public.finance_transactions t ON t.id=l.transaction_id
   WHERE l.account_id=a.id AND t.happened_on<(p_month+INTERVAL '1 month')::date),0))
   FROM public.finance_accounts a),
  'income',coalesce((SELECT sum(amount) FROM public.finance_transactions WHERE kind='income' AND happened_on>=p_month AND happened_on<(p_month+INTERVAL '1 month')::date AND NOT EXISTS(SELECT 1 FROM public.finance_transactions x WHERE x.reversed_transaction_id=finance_transactions.id)),0),
  'expense',coalesce((SELECT sum(amount) FROM public.finance_transactions WHERE kind='expense' AND happened_on>=p_month AND happened_on<(p_month+INTERVAL '1 month')::date AND NOT EXISTS(SELECT 1 FROM public.finance_transactions x WHERE x.reversed_transaction_id=finance_transactions.id)),0)) INTO v_snapshot;
 INSERT INTO public.finance_month_closes(month_start,snapshot,closed_by) VALUES(p_month,v_snapshot,auth.uid());
 PERFORM public.finance_record('close','month',NULL,v_snapshot);
END $$;

CREATE OR REPLACE FUNCTION public.finance_reopen_month(p_month date,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Μόνο Admin μπορεί να ανοίξει κλειστό μήνα.'; END IF;
 IF char_length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Αιτιολόγησε την επαναφορά.'; END IF;
 IF EXISTS(SELECT 1 FROM public.finance_month_closes WHERE month_start>p_month) THEN
  RAISE EXCEPTION 'Άνοιξε πρώτα τους επόμενους κλειδωμένους μήνες.';
 END IF;
 DELETE FROM public.finance_month_closes WHERE month_start=p_month;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ο μήνας δεν είναι κλειδωμένος.'; END IF;
 PERFORM public.finance_record('reopen','month',NULL,jsonb_build_object('month',p_month,'reason',p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.finance_reconcile(p_account uuid,p_date date,p_actual numeric,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.finance_check();
 IF p_actual IS NULL OR round(p_actual,2)<>p_actual THEN RAISE EXCEPTION 'Μη έγκυρο υπόλοιπο.'; END IF;
 INSERT INTO public.finance_reconciliations(account_id,happened_on,actual_balance,note,created_by)
 VALUES(p_account,p_date,p_actual,coalesce(p_note,''),auth.uid()) RETURNING id INTO v_id;
 PERFORM public.finance_record('reconcile','account',p_account,jsonb_build_object('date',p_date,'actual',p_actual));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finance_attach(p_transaction uuid,p_path text,p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.finance_check();
 IF NOT EXISTS(SELECT 1 FROM public.finance_transactions WHERE id=p_transaction) OR
    p_path !~ ('^'||p_transaction::text||'/[a-zA-Z0-9_-]{8,80}[.](pdf|png|jpg|jpeg)$')
    THEN RAISE EXCEPTION 'Μη έγκυρο παραστατικό.'; END IF;
 INSERT INTO public.finance_files(transaction_id,storage_path,original_name,created_by)
 VALUES(p_transaction,p_path,p_name,auth.uid()) RETURNING id INTO v_id;
 PERFORM public.finance_record('attach','transaction',p_transaction,jsonb_build_object('file_id',v_id));
 RETURN v_id;
END $$;

-- Preserve existing event history if a planning event is linked to finance.
-- All other cancellation behavior from migration 009 is preserved.
CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Πρέπει να είσαι συνδεδεμένος.'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Η εκδήλωση δεν βρέθηκε ή έχει ήδη διαγραφεί.'; END IF;
 IF NOT public.can_manage_event_team(e.team_id) THEN RAISE EXCEPTION 'Δεν έχεις δικαίωμα ακύρωσης.'; END IF;
 IF e.stage='planning' THEN
  IF EXISTS(SELECT 1 FROM public.finance_allocations WHERE event_id=e.id)
    OR EXISTS(SELECT 1 FROM public.finance_expected WHERE event_id=e.id) THEN
   UPDATE public.events SET stage='cancelled' WHERE id=e.id;
   RETURN 'cancelled';
  END IF;
  IF EXISTS(SELECT 1 FROM public.tasks WHERE event_id=e.id) THEN
   RAISE EXCEPTION 'Η εκδήλωση έχει συνδεδεμένες εργασίες. Χρειάζεται έλεγχος πριν τη διαγραφή.';
  END IF;
  DELETE FROM public.events WHERE id=e.id;
  INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
  VALUES(auth.uid(),'events',e.id::text,'delete',
         jsonb_build_object('stage','planning','title',e.title,'team_id',e.team_id));
  RETURN 'deleted';
 ELSIF e.stage='confirmed' THEN
  UPDATE public.events SET stage='cancelled' WHERE id=e.id;
  RETURN 'cancelled';
 ELSE
  RAISE EXCEPTION 'Η εκδήλωση είναι ήδη ακυρωμένη.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.cancel_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid) TO authenticated;

-- PRIVATE receipts, no external access, and no delete/overwrite to preserve the audit trail.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('finance-receipts','finance-receipts',false,8388608,ARRAY['application/pdf','image/png','image/jpeg'])
 ON CONFLICT(id) DO NOTHING;
CREATE POLICY finance_storage_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='finance-receipts' AND public.can_use_finance());
CREATE POLICY finance_storage_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='finance-receipts' AND public.can_use_finance() AND
  EXISTS(SELECT 1 FROM public.finance_transactions WHERE id=split_part(name,'/',1)::uuid));

-- Restrict internal functions: only documented user RPCs are callable by authenticated roles.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'finance_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.finance_category_admin(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_new_register(text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_post(text,date,numeric,uuid,uuid,uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_opening(date,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_expected_write(uuid,text,text,numeric,date,uuid,uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_settle_expected(uuid,date,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_close_month(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reopen_month(date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reconcile(uuid,date,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_attach(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_finance() TO authenticated;

COMMIT;
