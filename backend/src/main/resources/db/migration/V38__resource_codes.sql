-- Auto-numbered resource codes per organization: EMP-001 (employees), CON-001 (contractors / consultants),
-- FRL-001 (freelancers). last_value is the highest number handed out so far for the prefix.
CREATE TABLE resource_code_sequences (
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    prefix          varchar(8)  NOT NULL,
    last_value      bigint      NOT NULL,
    PRIMARY KEY (organization_id, prefix)
);

-- Give every active resource without a code the next number of its prefix, oldest first.
WITH existing AS (
    SELECT organization_id,
           substring(employee_code FROM '^(EMP|CON|FRL)-[0-9]{1,9}$')                     AS prefix,
           MAX(substring(employee_code FROM '^(?:EMP|CON|FRL)-([0-9]{1,9})$')::bigint)    AS max_value
    FROM resources
    WHERE employee_code ~ '^(EMP|CON|FRL)-[0-9]{1,9}$'
    GROUP BY 1, 2
),
pending AS (
    SELECT r.id,
           r.organization_id,
           p.prefix,
           ROW_NUMBER() OVER (PARTITION BY r.organization_id, p.prefix ORDER BY r.created_at, r.id) AS rn
    FROM resources r
    CROSS JOIN LATERAL (
        SELECT CASE r.resource_type
                   WHEN 'EMPLOYEE' THEN 'EMP'
                   WHEN 'FREELANCER' THEN 'FRL'
                   ELSE 'CON'
               END AS prefix
    ) p
    WHERE r.employee_code IS NULL AND r.deleted_at IS NULL
),
numbered AS (
    SELECT pending.id,
           pending.prefix,
           (COALESCE(existing.max_value, 0) + pending.rn)::text AS num
    FROM pending
    LEFT JOIN existing
           ON existing.organization_id = pending.organization_id AND existing.prefix = pending.prefix
)
UPDATE resources r
SET employee_code = numbered.prefix || '-' || lpad(numbered.num, GREATEST(3, length(numbered.num)), '0')
FROM numbered
WHERE r.id = numbered.id;

INSERT INTO resource_code_sequences (organization_id, prefix, last_value)
SELECT organization_id,
       substring(employee_code FROM '^(EMP|CON|FRL)-[0-9]{1,9}$'),
       MAX(substring(employee_code FROM '^(?:EMP|CON|FRL)-([0-9]{1,9})$')::bigint)
FROM resources
WHERE employee_code ~ '^(EMP|CON|FRL)-[0-9]{1,9}$'
GROUP BY 1, 2;

-- A user can back only one live resource; a deleted resource no longer blocks re-linking the user.
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_user_id_key;
CREATE UNIQUE INDEX resources_user_uq ON resources (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
