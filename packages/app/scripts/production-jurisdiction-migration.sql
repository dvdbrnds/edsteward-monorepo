-- Enhanced Jurisdiction System - Production Migration
-- This script safely migrates the production database to support the enhanced jurisdiction system
-- 
-- IMPORTANT: This script is designed to be run on production with zero downtime
-- It adds new fields without removing the old jurisdiction field for backward compatibility

BEGIN;

-- Step 1: Add new columns (safe, non-destructive)
DO $$ 
BEGIN
    -- Add jurisdiction_source column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'regulations' AND column_name = 'jurisdiction_source'
    ) THEN
        ALTER TABLE regulations 
        ADD COLUMN jurisdiction_source TEXT NOT NULL DEFAULT 'federal';
        
        RAISE NOTICE 'Added jurisdiction_source column';
    ELSE
        RAISE NOTICE 'jurisdiction_source column already exists';
    END IF;
    
    -- Add applicable_institutions column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'regulations' AND column_name = 'applicable_institutions'
    ) THEN
        ALTER TABLE regulations 
        ADD COLUMN applicable_institutions JSONB;
        
        RAISE NOTICE 'Added applicable_institutions column';
    ELSE
        RAISE NOTICE 'applicable_institutions column already exists';
    END IF;
END $$;

-- Step 2: Migrate existing data (safe, preserves original jurisdiction field)
DO $$
DECLARE
    migration_count INTEGER := 0;
    total_count INTEGER := 0;
BEGIN
    -- Get total count for reporting
    SELECT COUNT(*) INTO total_count FROM regulations;
    
    -- Migrate jurisdiction values to jurisdiction_source where not already set
    UPDATE regulations 
    SET jurisdiction_source = COALESCE(jurisdiction, 'federal')
    WHERE jurisdiction_source = 'federal' 
    AND jurisdiction IS NOT NULL 
    AND jurisdiction IN ('federal', 'state', 'international');
    
    GET DIAGNOSTICS migration_count = ROW_COUNT;
    RAISE NOTICE 'Updated jurisdiction_source for % out of % regulations', migration_count, total_count;
    
    -- Set default applicable_institutions for records that don't have it
    UPDATE regulations 
    SET applicable_institutions = '["all-institutions"]'::JSONB
    WHERE applicable_institutions IS NULL;
    
    GET DIAGNOSTICS migration_count = ROW_COUNT;
    RAISE NOTICE 'Set default applicable_institutions for % regulations', migration_count;
    
    -- Handle some intelligent defaults based on patterns
    -- Federal regulations often apply to all institutions
    UPDATE regulations 
    SET applicable_institutions = '["all-institutions"]'::JSONB
    WHERE jurisdiction_source = 'federal' 
    AND applicable_institutions = '["all-institutions"]'::JSONB;
    
    -- State regulations might be more targeted to public institutions
    -- But we'll be conservative and leave them as all-institutions for now
    
    RAISE NOTICE 'Enhanced jurisdiction migration completed successfully';
END $$;

-- Step 3: Create indexes for performance (safe)
DO $$
BEGIN
    -- Index for jurisdiction_source filtering
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'regulations' AND indexname = 'idx_regulations_jurisdiction_source'
    ) THEN
        CREATE INDEX idx_regulations_jurisdiction_source ON regulations(jurisdiction_source);
        RAISE NOTICE 'Created index on jurisdiction_source';
    END IF;
    
    -- GIN index for JSONB applicable_institutions filtering
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'regulations' AND indexname = 'idx_regulations_applicable_institutions'
    ) THEN
        CREATE INDEX idx_regulations_applicable_institutions ON regulations USING GIN(applicable_institutions);
        RAISE NOTICE 'Created GIN index on applicable_institutions';
    END IF;
END $$;

-- Step 4: Add constraints (safe)
DO $$
BEGIN
    -- Check constraint for valid jurisdiction sources
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'regulations_jurisdiction_source_check'
    ) THEN
        ALTER TABLE regulations 
        ADD CONSTRAINT regulations_jurisdiction_source_check 
        CHECK (jurisdiction_source IN ('federal', 'state', 'international', 'private-organization', 'accreditor', 'industry-association'));
        
        RAISE NOTICE 'Added jurisdiction_source check constraint';
    END IF;
END $$;

-- Step 5: Verification queries
DO $$
DECLARE
    total_regs INTEGER;
    with_jurisdiction_source INTEGER;
    with_applicable_institutions INTEGER;
    jurisdiction_breakdown TEXT;
BEGIN
    -- Count totals
    SELECT COUNT(*) INTO total_regs FROM regulations;
    SELECT COUNT(*) INTO with_jurisdiction_source FROM regulations WHERE jurisdiction_source IS NOT NULL;
    SELECT COUNT(*) INTO with_applicable_institutions FROM regulations WHERE applicable_institutions IS NOT NULL;
    
    -- Get jurisdiction breakdown
    SELECT string_agg(jurisdiction_source || ': ' || count::TEXT, ', ')
    INTO jurisdiction_breakdown
    FROM (
        SELECT jurisdiction_source, COUNT(*) as count 
        FROM regulations 
        GROUP BY jurisdiction_source 
        ORDER BY count DESC
    ) breakdown;
    
    RAISE NOTICE '=== MIGRATION VERIFICATION ===';
    RAISE NOTICE 'Total regulations: %', total_regs;
    RAISE NOTICE 'With jurisdiction_source: %', with_jurisdiction_source;
    RAISE NOTICE 'With applicable_institutions: %', with_applicable_institutions;
    RAISE NOTICE 'Jurisdiction breakdown: %', jurisdiction_breakdown;
    
    -- Verify success
    IF with_jurisdiction_source = total_regs AND with_applicable_institutions = total_regs THEN
        RAISE NOTICE '✅ MIGRATION SUCCESSFUL - All regulations have enhanced jurisdiction data';
    ELSE
        RAISE EXCEPTION '❌ MIGRATION INCOMPLETE - Some regulations missing enhanced jurisdiction data';
    END IF;
END $$;

COMMIT;

-- Final verification query
SELECT 
    'MIGRATION COMPLETE' as status,
    COUNT(*) as total_regulations,
    COUNT(CASE WHEN jurisdiction_source IS NOT NULL THEN 1 END) as with_jurisdiction_source,
    COUNT(CASE WHEN applicable_institutions IS NOT NULL THEN 1 END) as with_applicable_institutions,
    jsonb_object_agg(jurisdiction_source, count) as jurisdiction_breakdown
FROM (
    SELECT 
        jurisdiction_source,
        COUNT(*) as count
    FROM regulations 
    GROUP BY jurisdiction_source
) subq, regulations; 