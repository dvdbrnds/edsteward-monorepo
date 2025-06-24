-- Migration script to update jurisdiction fields
-- Run this script to migrate from old jurisdiction field to new jurisdictionSource and applicableInstitutions fields

BEGIN;

-- Add new columns
ALTER TABLE regulations 
ADD COLUMN jurisdiction_source TEXT NOT NULL DEFAULT 'federal',
ADD COLUMN applicable_institutions JSONB;

-- Migrate existing data
-- Map old 'jurisdiction' values to new 'jurisdiction_source' 
UPDATE regulations 
SET jurisdiction_source = jurisdiction
WHERE jurisdiction IN ('federal', 'state');

-- Set default applicable institutions based on current data patterns
-- For federal regulations, assume they apply to all institutions
UPDATE regulations 
SET applicable_institutions = '["all-institutions"]'::jsonb
WHERE jurisdiction_source = 'federal';

-- For state regulations, assume they apply to all institutions within that state
UPDATE regulations 
SET applicable_institutions = '["all-institutions"]'::jsonb
WHERE jurisdiction_source = 'state';

-- Drop the old jurisdiction column after migration
-- ALTER TABLE regulations DROP COLUMN jurisdiction;

-- Note: Uncomment the line above after verifying the migration worked correctly

COMMIT; 