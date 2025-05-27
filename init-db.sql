-- Create application user with replication permissions
CREATE USER app_user WITH PASSWORD 'app_password';
ALTER USER app_user WITH REPLICATION;
GRANT ALL PRIVILEGES ON DATABASE regulations TO app_user;

-- Connect to the regulations database
\c regulations

-- Create tenant context
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.set_tenant_id() RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', '', false);
END;
$$ LANGUAGE plpgsql;

-- Create regulations table with tenant isolation
CREATE TABLE IF NOT EXISTS regulations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  reg_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  revision VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on tenant_id and reg_id
ALTER TABLE regulations ADD CONSTRAINT unique_regulation_per_tenant UNIQUE (tenant_id, reg_id);

-- Create index for tenant-based queries
CREATE INDEX idx_regulations_tenant_id ON regulations(tenant_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY tenant_isolation_policy ON regulations
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- Grant permissions to app_user
GRANT ALL PRIVILEGES ON TABLE regulations TO app_user;
GRANT USAGE, SELECT ON SEQUENCE regulations_id_seq TO app_user;

-- Create publication for CDC
CREATE PUBLICATION regulations_publication FOR TABLE regulations;

-- Create replication slot for Debezium
SELECT pg_create_logical_replication_slot('debezium_slot', 'pgoutput');

-- Log completion
\echo 'Database initialization completed' 