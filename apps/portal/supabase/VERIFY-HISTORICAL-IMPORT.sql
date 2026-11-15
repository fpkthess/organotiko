-- Read-only verification query after import 016.
SELECT a.code,a.name,coalesce(sum(l.delta),0)::numeric(14,2) AS balance
FROM public.finance_accounts a LEFT JOIN public.finance_legs l ON l.account_id=a.id
GROUP BY a.code,a.name ORDER BY a.code;
SELECT (SELECT count(*) FROM public.finance_historical_sources) AS imported_operations,
(SELECT count(*) FROM public.finance_transactions) AS total_financial_transactions,
(SELECT count(*) FROM public.finance_registers) AS historical_registers,
(SELECT count(*) FROM public.finance_month_closes) AS locked_months;
