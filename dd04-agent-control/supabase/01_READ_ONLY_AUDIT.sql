-- DD04-A00-006 / Supabase schema + RLS read-only inventory
-- SELECT ONLY. DO NOT execute any CREATE/ALTER/DROP/INSERT/UPDATE/DELETE.
-- Run in the intended STAGING project after independently verifying project reference.
-- Returns metadata only, not business rows, PII, auth.users or credentials.

-- A. Existing public tables and views
select table_schema, table_name, table_type
from information_schema.tables
where table_schema in ('public')
order by table_schema, table_name;

-- B. Columns useful for avoiding collisions with current modules
select table_schema, table_name, ordinal_position, column_name,
       data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- C. Existing RLS activation flags
select n.nspname as schema_name, c.relname as object_name,
       case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table' else c.relkind::text end as object_type,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by c.relname;

-- D. Existing policy metadata (not a security certification)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- E. Keys and referential relationships (avoid storing secret material)
select tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as references_table, ccu.column_name as references_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
where tc.table_schema='public'
order by tc.table_name, tc.constraint_type, kcu.ordinal_position;

-- F. Do DD04-proposed names already exist?
select table_name from information_schema.tables
where table_schema='public' and table_name in (
 'dd04_commands','dd04_tasks','dd04_task_events','dd04_approvals',
 'dd04_agent_memories','dd04_capability_versions','dd04_artifacts'
) order by table_name;

-- STOP: No migration is authorized by this read-only audit.
