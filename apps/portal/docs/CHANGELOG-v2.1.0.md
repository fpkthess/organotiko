# v2.1.0 — Finance & Admin Event Kinds (Release Candidate)

- Additive Supabase finance ledger + restricted RLS & SECURITY DEFINER RPCs.
- Role-gated finance: Admin, Leadership, or member granted `finance_manager` by Admin; access changes audited.
- Separate Cash/Bank/Revolut available vs Deposit outside the available balance, with opening/closing per account.
- Parent registers with repeated partial income/expense payments and two-way non-P&L internal transfers.
- Optional multiple-event allocations per payment; economic outcome per event, including negative reversal allocations.
- Editing of expected income/expenses, budget forecasts, beneficiaries/reimbursements, atomic settlement.
- Month closing/locking, fiscal June–May overview, reconciliations and reversals preserving financial history.
- Month-lock check corrected for later writable months; unified first-of-month opening dates required; cannot close before starting date.
- Private, permission-checked document storage with signed view URLs; CSV exports suitable for Excel.
- Admin management of event kinds with historical references, event cancellation safely preserves linked finance.
- Before/after audit details for editable financial plans/categories; named actors where profiles are visible.
- Sidebar navigation scrolling from v2.0.9 patch included.
- 78 Node tests, baseline + finance structure/unit tests. Source TSX transpilation syntax checked; full dependency-based build and staging RLS/SQL integration tests still outstanding.
- NOT deployed, no changes to live Supabase, no automatic historic Excel import.
