-- pg-boss expects its own schema to exist. Pre-create it so pg-boss tables can be created inside.
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.8

CREATE SCHEMA IF NOT EXISTS pgboss;
GRANT USAGE ON SCHEMA pgboss TO service_role;
GRANT ALL ON SCHEMA pgboss TO service_role;
