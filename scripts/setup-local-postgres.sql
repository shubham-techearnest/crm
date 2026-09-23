-- Run in pgAdmin as a SUPERUSER (your existing PostgreSQL 16 server login).
--
-- The Spring Boot error "role crm is not permitted to log in" means this role
-- exists as a group role (NOLOGIN). Creating a password is not enough.

-- 1) Enable login and set the password the app uses (see application.yml).
ALTER ROLE crm WITH LOGIN PASSWORD 'crm';

-- 2) Allow the role to use the database you already created.
GRANT CONNECT ON DATABASE techearnest_crm TO crm;
GRANT ALL PRIVILEGES ON DATABASE techearnest_crm TO crm;

-- 3) Open a new Query Tool on database techearnest_crm (not postgres) and run:
GRANT USAGE, CREATE ON SCHEMA public TO crm;
GRANT ALL ON SCHEMA public TO crm;
ALTER SCHEMA public OWNER TO crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm;
