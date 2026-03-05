-- Add tenant_id column to all tables

ALTER TABLE regulatory_sources 
  ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

ALTER TABLE source_updates 
  ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

ALTER TABLE regulations 
  ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

ALTER TABLE regulation_versions 
  ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

ALTER TABLE requirements 
  ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

-- Create indexes for tenant_id
CREATE INDEX idx_regulatory_sources_tenant_id ON regulatory_sources(tenant_id);
CREATE INDEX idx_source_updates_tenant_id ON source_updates(tenant_id);
CREATE INDEX idx_regulations_tenant_id ON regulations(tenant_id);
CREATE INDEX idx_regulation_versions_tenant_id ON regulation_versions(tenant_id);
CREATE INDEX idx_requirements_tenant_id ON requirements(tenant_id);

-- Create app user for actual connections (instead of postgres superuser)
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;

-- Create RLS policies for tenant isolation
ALTER TABLE regulatory_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_regulatory_sources ON regulatory_sources
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_source_updates ON source_updates
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_regulations ON regulations
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_regulation_versions ON regulation_versions
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_requirements ON requirements
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Create a view that respects tenant isolation automatically
CREATE OR REPLACE VIEW tenant_regulations AS
SELECT * FROM regulations WHERE tenant_id = current_setting('app.tenant_id', true); 