-- Migration: institution_configurations table v2 (two-tier taxonomy)
-- Handles both fresh creation and migration from v1 (primary_types jsonb -> primary_type text + characteristics jsonb)

-- Create table if it doesn't exist (fresh install)
CREATE TABLE IF NOT EXISTS institution_configurations (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  primary_type TEXT,
  characteristics JSONB NOT NULL DEFAULT '[]'::jsonb,
  hide_non_applicable BOOLEAN NOT NULL DEFAULT true,
  allow_users_to_toggle BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_institution_configurations_tenant_id ON institution_configurations(tenant_id);

-- If upgrading from v1, add new columns and migrate data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institution_configurations' AND column_name = 'primary_types') THEN
    -- Add new columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institution_configurations' AND column_name = 'primary_type') THEN
      ALTER TABLE institution_configurations ADD COLUMN primary_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institution_configurations' AND column_name = 'characteristics') THEN
      ALTER TABLE institution_configurations ADD COLUMN characteristics JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    -- Migrate data from old primary_types to new columns
    UPDATE institution_configurations
    SET
      primary_type = CASE
        WHEN primary_types ? 'public-universities' THEN 'public-4year'
        WHEN primary_types ? 'private-universities' THEN 'private-nonprofit-4year'
        WHEN primary_types ? 'community-colleges' THEN 'public-2year'
        WHEN primary_types ? 'for-profit-institutions' THEN 'private-for-profit'
        WHEN primary_types ? 'conservatories' THEN 'private-nonprofit-4year'
        WHEN primary_types ? 'technical-institutes' THEN 'private-for-profit'
        ELSE NULL
      END,
      characteristics = (
        SELECT COALESCE(jsonb_agg(mapped), '[]'::jsonb)
        FROM (
          SELECT CASE elem
            WHEN 'religious-institutions' THEN 'religious-affiliation'
            WHEN 'research-institutes' THEN 'research-intensive'
            WHEN 'professional-schools' THEN 'graduate-professional'
            ELSE NULL
          END AS mapped
          FROM jsonb_array_elements_text(primary_types) AS elem
        ) sub
        WHERE mapped IS NOT NULL
      )
    WHERE primary_type IS NULL AND primary_types IS NOT NULL AND primary_types != '[]'::jsonb;

    -- Drop old column
    ALTER TABLE institution_configurations DROP COLUMN primary_types;

    RAISE NOTICE 'Migrated institution_configurations from v1 to v2';
  END IF;
END $$;
