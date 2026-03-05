-- Regulation Metadata Schema Extension
-- Extends existing regulations table to handle CSV data structure

-- Create topics table for normalized topic management
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  topic_name VARCHAR(255) NOT NULL,
  topic_category VARCHAR(100) NOT NULL, -- civil-rights, financial, healthcare, education, etc.
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, topic_name)
);

-- Create enforcement_agencies table
CREATE TABLE enforcement_agencies (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  agency_code VARCHAR(50) NOT NULL,
  agency_name VARCHAR(255) NOT NULL,
  agency_type VARCHAR(100) NOT NULL, -- federal, state, local
  description TEXT,
  contact_info JSONB,
  website_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, agency_code)
);

-- Extend regulations table with CSV metadata fields
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS item_id INTEGER;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_name VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_1 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_2 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_3 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_4 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statute_ids VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_1 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_2 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_3 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_4 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_5 VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS statutory_summary TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS reporting_requirements TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS deadlines VARCHAR(500);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS additional_resources_1 TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS additional_resources_2 TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS sortable_month VARCHAR(50);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS topic_id_original INTEGER;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS last_updated_original VARCHAR(100);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS enforcement_agency_id INTEGER REFERENCES enforcement_agencies(id);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS compliance_focus VARCHAR(255);
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS regulation_slug VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_regulations_item_id ON regulations(item_id);
CREATE INDEX IF NOT EXISTS idx_regulations_topic_id ON regulations(topic_id);
CREATE INDEX IF NOT EXISTS idx_regulations_enforcement_agency_id ON regulations(enforcement_agency_id);
CREATE INDEX IF NOT EXISTS idx_regulations_regulation_slug ON regulations(regulation_slug);
CREATE INDEX IF NOT EXISTS idx_topics_tenant_id ON topics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_topics_topic_category ON topics(topic_category);
CREATE INDEX IF NOT EXISTS idx_enforcement_agencies_tenant_id ON enforcement_agencies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_agencies_agency_type ON enforcement_agencies(agency_type);

-- Enable RLS for new tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_agencies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_topics ON topics
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_enforcement_agencies ON enforcement_agencies
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Insert default topics based on CSV analysis
INSERT INTO topics (tenant_id, topic_name, topic_category, description) VALUES
  ('default', 'Academic Programs', 'education', 'Educational program requirements and standards'),
  ('default', 'Accounting', 'financial', 'Financial reporting and accounting standards'),
  ('default', 'Contracts & Procurement', 'financial', 'Contract and procurement regulations'),
  ('default', 'Diversity/Affirmative Action', 'civil-rights', 'Equal opportunity and non-discrimination requirements'),
  ('default', 'Health Care and Insurance', 'healthcare', 'Healthcare and insurance regulations'),
  ('default', 'Human Resources', 'employment', 'Employment and human resources compliance'),
  ('default', 'Privacy & Information Security', 'privacy', 'Data privacy and information security requirements'),
  ('default', 'Student Services', 'education', 'Student support and services regulations'),
  ('default', 'Research', 'education', 'Research compliance and oversight'),
  ('default', 'Safety & Environmental', 'environmental', 'Safety and environmental compliance')
ON CONFLICT (tenant_id, topic_name) DO NOTHING;

-- Insert default enforcement agencies
INSERT INTO enforcement_agencies (tenant_id, agency_code, agency_name, agency_type, description, website_url) VALUES
  ('default', 'ED', 'Department of Education', 'federal', 'U.S. Department of Education', 'https://www.ed.gov'),
  ('default', 'OCR', 'Office for Civil Rights', 'federal', 'Office for Civil Rights (Department of Education)', 'https://www.ed.gov/ocr'),
  ('default', 'HUD', 'Department of Housing and Urban Development', 'federal', 'U.S. Department of Housing and Urban Development', 'https://www.hud.gov'),
  ('default', 'DOL', 'Department of Labor', 'federal', 'U.S. Department of Labor', 'https://www.dol.gov'),
  ('default', 'TREASURY', 'Department of Treasury', 'federal', 'U.S. Department of Treasury', 'https://www.treasury.gov'),
  ('default', 'SEC', 'Securities and Exchange Commission', 'federal', 'U.S. Securities and Exchange Commission', 'https://www.sec.gov'),
  ('default', 'HHS', 'Department of Health and Human Services', 'federal', 'U.S. Department of Health and Human Services', 'https://www.hhs.gov'),
  ('default', 'EPA', 'Environmental Protection Agency', 'federal', 'U.S. Environmental Protection Agency', 'https://www.epa.gov'),
  ('default', 'COPYRIGHT', 'U.S. Copyright Office', 'federal', 'U.S. Copyright Office (Library of Congress)', 'https://www.copyright.gov'),
  ('default', 'EEOC', 'Equal Employment Opportunity Commission', 'federal', 'U.S. Equal Employment Opportunity Commission', 'https://www.eeoc.gov'),
  ('default', 'PA-ED', 'Pennsylvania Department of Education', 'state', 'Pennsylvania Department of Education', 'https://www.pa.gov/agencies/education/'),
  ('default', 'PA-PSP', 'Pennsylvania State Police', 'state', 'Pennsylvania State Police', 'https://www.psp.pa.gov/'),
  ('default', 'PA-SEC', 'Pennsylvania State Ethics Commission', 'state', 'Pennsylvania State Ethics Commission', 'https://www.ethics.pa.gov/')
ON CONFLICT (tenant_id, agency_code) DO NOTHING;

-- Create enhanced view for regulation data with all metadata
CREATE OR REPLACE VIEW regulation_metadata AS
SELECT 
  r.id,
  r.tenant_id,
  r.regulation_id,
  r.name,
  r.description,
  r.item_id,
  r.statute_name,
  r.statute_1,
  r.statute_2,
  r.statute_3,
  r.statute_4,
  r.statute_ids,
  r.regulation_1,
  r.regulation_2,
  r.regulation_3,
  r.regulation_4,
  r.regulation_5,
  r.statutory_summary,
  r.reporting_requirements,
  r.deadlines,
  r.additional_resources_1,
  r.additional_resources_2,
  r.sortable_month,
  r.topic_id_original,
  r.last_updated_original,
  r.compliance_focus,
  r.regulation_slug,
  r.is_active,
  r.created_at,
  r.updated_at,
  t.topic_name,
  t.topic_category,
  ea.agency_code,
  ea.agency_name,
  ea.agency_type,
  ea.website_url as agency_website
FROM regulations r
LEFT JOIN topics t ON r.topic_id = t.id
LEFT JOIN enforcement_agencies ea ON r.enforcement_agency_id = ea.id
WHERE r.tenant_id = current_setting('app.tenant_id', true);

-- Create function to get regulation by slug
CREATE OR REPLACE FUNCTION get_regulation_by_slug(
  p_slug VARCHAR(255),
  p_tenant_id VARCHAR(36) DEFAULT 'default'
) RETURNS TABLE (
  id INTEGER,
  regulation_id VARCHAR(100),
  name VARCHAR(255),
  description TEXT,
  item_id INTEGER,
  statute_name VARCHAR(500),
  statute_1 VARCHAR(500),
  statute_2 VARCHAR(500),
  statute_3 VARCHAR(500),
  statute_4 VARCHAR(500),
  statute_ids VARCHAR(500),
  regulation_1 VARCHAR(500),
  regulation_2 VARCHAR(500),
  regulation_3 VARCHAR(500),
  regulation_4 VARCHAR(500),
  regulation_5 VARCHAR(500),
  statutory_summary TEXT,
  reporting_requirements TEXT,
  deadlines VARCHAR(500),
  additional_resources_1 TEXT,
  additional_resources_2 TEXT,
  topic_name VARCHAR(255),
  topic_category VARCHAR(100),
  agency_code VARCHAR(50),
  agency_name VARCHAR(255),
  compliance_focus VARCHAR(255)
) AS $$
BEGIN
  -- Set tenant context
  PERFORM set_config('app.tenant_id', p_tenant_id, true);
  
  RETURN QUERY
  SELECT 
    rm.id,
    rm.regulation_id,
    rm.name,
    rm.description,
    rm.item_id,
    rm.statute_name,
    rm.statute_1,
    rm.statute_2,
    rm.statute_3,
    rm.statute_4,
    rm.statute_ids,
    rm.regulation_1,
    rm.regulation_2,
    rm.regulation_3,
    rm.regulation_4,
    rm.regulation_5,
    rm.statutory_summary,
    rm.reporting_requirements,
    rm.deadlines,
    rm.additional_resources_1,
    rm.additional_resources_2,
    rm.topic_name,
    rm.topic_category,
    rm.agency_code,
    rm.agency_name,
    rm.compliance_focus
  FROM regulation_metadata rm
  WHERE rm.regulation_slug = p_slug
    AND rm.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create function to search regulations
CREATE OR REPLACE FUNCTION search_regulations(
  p_search_term TEXT,
  p_topic_category VARCHAR(100) DEFAULT NULL,
  p_agency_code VARCHAR(50) DEFAULT NULL,
  p_tenant_id VARCHAR(36) DEFAULT 'default',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id INTEGER,
  regulation_id VARCHAR(100),
  name VARCHAR(255),
  description TEXT,
  topic_name VARCHAR(255),
  topic_category VARCHAR(100),
  agency_name VARCHAR(255),
  regulation_slug VARCHAR(255),
  relevance_score REAL
) AS $$
BEGIN
  -- Set tenant context
  PERFORM set_config('app.tenant_id', p_tenant_id, true);
  
  RETURN QUERY
  SELECT 
    rm.id,
    rm.regulation_id,
    rm.name,
    rm.description,
    rm.topic_name,
    rm.topic_category,
    rm.agency_name,
    rm.regulation_slug,
    -- Simple relevance scoring based on text matches
    (
      CASE WHEN rm.name ILIKE '%' || p_search_term || '%' THEN 1.0 ELSE 0.0 END +
      CASE WHEN rm.description ILIKE '%' || p_search_term || '%' THEN 0.8 ELSE 0.0 END +
      CASE WHEN rm.statutory_summary ILIKE '%' || p_search_term || '%' THEN 0.6 ELSE 0.0 END +
      CASE WHEN rm.topic_name ILIKE '%' || p_search_term || '%' THEN 0.4 ELSE 0.0 END
    )::REAL as relevance_score
  FROM regulation_metadata rm
  WHERE rm.is_active = true
    AND (
      rm.name ILIKE '%' || p_search_term || '%' OR
      rm.description ILIKE '%' || p_search_term || '%' OR
      rm.statutory_summary ILIKE '%' || p_search_term || '%' OR
      rm.topic_name ILIKE '%' || p_search_term || '%'
    )
    AND (p_topic_category IS NULL OR rm.topic_category = p_topic_category)
    AND (p_agency_code IS NULL OR rm.agency_code = p_agency_code)
  ORDER BY relevance_score DESC, rm.name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;




