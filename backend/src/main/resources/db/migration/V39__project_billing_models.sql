-- Project billing models drive how invoices are generated:
--   STAFF_AUGMENTATION  approved hours x each resource's billing rate
--   TIME_AND_MATERIAL   approved hours x the project's hourly rate
--   FIXED_MONTHLY       a fixed fee per calendar month
--   FIXED_BID           an agreed contract value, invoiced in instalments
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_chk;

UPDATE projects SET billing_type = CASE billing_type
    WHEN 'FIXED_PRICE' THEN 'FIXED_BID'
    WHEN 'MILESTONE' THEN 'FIXED_BID'
    WHEN 'HOURLY' THEN 'TIME_AND_MATERIAL'
    WHEN 'RETAINER' THEN 'FIXED_MONTHLY'
    ELSE billing_type
END;

ALTER TABLE projects
    ADD COLUMN hourly_rate numeric(18, 2),
    ADD COLUMN monthly_fee numeric(18, 2),
    ADD COLUMN contract_value numeric(18, 2),
    ADD CONSTRAINT projects_billing_chk CHECK (billing_type IN (
        'STAFF_AUGMENTATION', 'TIME_AND_MATERIAL', 'FIXED_MONTHLY', 'FIXED_BID'
    )),
    ADD CONSTRAINT projects_billing_amounts_chk CHECK (
        (hourly_rate IS NULL OR hourly_rate >= 0)
        AND (monthly_fee IS NULL OR monthly_fee >= 0)
        AND (contract_value IS NULL OR contract_value >= 0)
    );

-- Existing fixed-price projects used the budget as the agreed value.
UPDATE projects SET contract_value = budget WHERE billing_type = 'FIXED_BID' AND budget IS NOT NULL;

ALTER TABLE invoices
    ADD COLUMN billing_period_start date,
    ADD COLUMN billing_period_end date;

CREATE INDEX invoices_project_period_idx ON invoices (project_id, billing_period_start)
    WHERE deleted_at IS NULL AND project_id IS NOT NULL;
