-- ==============================================================
-- Writerify Finance — Partner accounting for expenses
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- paid_by      : who paid ('Mustaqeem' / 'Sazzad')
-- fund_source  : where the money came from ('company' / 'sazzad' / 'mustaqeem')
-- ==============================================================

ALTER TABLE expenses_ledger ADD COLUMN IF NOT EXISTS paid_by TEXT DEFAULT '';
ALTER TABLE expenses_ledger ADD COLUMN IF NOT EXISTS fund_source TEXT DEFAULT 'company';
ALTER TABLE expenses_ledger ADD COLUMN IF NOT EXISTS amount_bdt NUMERIC DEFAULT 0;
ALTER TABLE expenses_ledger ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
