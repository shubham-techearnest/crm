-- Extended lead fields aligned with Zoho CRM lead create form

ALTER TABLE leads
    ADD COLUMN salutation varchar(16),
    ADD COLUMN mobile varchar(50),
    ADD COLUMN fax varchar(50),
    ADD COLUMN email_opt_out boolean NOT NULL DEFAULT false,
    ADD COLUMN no_of_employees integer,
    ADD COLUMN rating varchar(32),
    ADD COLUMN skype_id varchar(128),
    ADD COLUMN secondary_email varchar(255),
    ADD COLUMN twitter varchar(128),
    ADD COLUMN address_country varchar(128),
    ADD COLUMN address_flat varchar(255),
    ADD COLUMN address_street varchar(255),
    ADD COLUMN address_city varchar(128),
    ADD COLUMN address_state varchar(128),
    ADD COLUMN address_zip varchar(32),
    ADD COLUMN address_latitude numeric(10, 7),
    ADD COLUMN address_longitude numeric(10, 7);

ALTER TABLE leads
    ADD CONSTRAINT leads_no_of_employees_chk CHECK (no_of_employees IS NULL OR no_of_employees >= 0);
