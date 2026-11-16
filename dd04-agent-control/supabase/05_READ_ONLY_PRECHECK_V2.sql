-- DD04-A00-007 / PRE-MIGRATION CHECK (SELECT ONLY)
-- Intended target: Supabase staging wbvkqfnrlasmtizjszab
-- Run only using read-only SQL, never execute V2 DDL without separate CEO approval.

select current_database() as database_name, current_setting('server_version') as postgres_version;

select nspname as schema_name
from pg_catalog.pg_namespace
where nspname in ('dd04_stage','public')
order by nspname;

select table_schema,table_name
from information_schema.tables
where table_schema='dd04_stage'
order by table_name;

-- Migration history should be checked using Supabase list_migrations tool
-- because fresh projects may not have a migrations table.
