-- Richer profile fields for admin setup records and organization settings.

ALTER TABLE users
    ADD COLUMN job_title varchar(128),
    ADD COLUMN employee_code varchar(64),
    ADD COLUMN mobile varchar(50),
    ADD COLUMN date_of_joining date,
    ADD COLUMN timezone varchar(64),
    ADD COLUMN locale varchar(16);

ALTER TABLE roles
    ADD COLUMN description text;

ALTER TABLE regions
    ADD COLUMN description text,
    ADD COLUMN manager_id uuid REFERENCES users (id),
    ADD COLUMN timezone varchar(64),
    ADD COLUMN currency_code varchar(3);

ALTER TABLE departments
    ADD COLUMN code varchar(32),
    ADD COLUMN description text,
    ADD COLUMN head_id uuid REFERENCES users (id),
    ADD COLUMN email varchar(255);

ALTER TABLE teams
    ADD COLUMN description text,
    ADD COLUMN email varchar(255),
    ADD COLUMN status varchar(32) NOT NULL DEFAULT 'ACTIVE',
    ADD CONSTRAINT teams_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));

ALTER TABLE organizations
    ADD COLUMN address_line varchar(255),
    ADD COLUMN city varchar(128),
    ADD COLUMN state varchar(128),
    ADD COLUMN country varchar(128),
    ADD COLUMN postal_code varchar(32),
    ADD COLUMN tax_id varchar(64),
    ADD COLUMN date_format varchar(32) NOT NULL DEFAULT 'dd/MM/yyyy',
    ADD COLUMN time_format varchar(8) NOT NULL DEFAULT '12h',
    ADD COLUMN week_start_day varchar(16) NOT NULL DEFAULT 'MONDAY',
    ADD COLUMN fiscal_year_start_month integer NOT NULL DEFAULT 4,
    ADD CONSTRAINT organizations_time_format_check CHECK (time_format IN ('12h', '24h')),
    ADD CONSTRAINT organizations_week_start_check CHECK (week_start_day IN ('SUNDAY', 'MONDAY', 'SATURDAY')),
    ADD CONSTRAINT organizations_fiscal_month_check CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

CREATE INDEX regions_manager_idx ON regions (manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX departments_head_idx ON departments (head_id) WHERE head_id IS NOT NULL;
