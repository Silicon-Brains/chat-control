-- Least-privilege roles (run once as the Neon owner, AFTER `alembic upgrade head` has created the tables).
--   migrator : owns the schema, used only by Alembic (direct endpoint)
--   app_user : DML only, no DDL, used by the API (pooled endpoint)
-- Replace the passwords, or create the roles in the Neon console and skip the CREATE ROLE lines.
CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE vaultchat TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
REVOKE ALL ON alembic_version FROM app_user;
-- future tables created by migrations inherit the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
