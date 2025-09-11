-- Migration: Add Federal Register enhancement metadata to regulation_updates table
-- Date: 2025-09-11
-- Purpose: Support enhanced Federal Register integration with rich metadata storage

-- Add metadata column to regulation_updates table
ALTER TABLE regulation_updates 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index for efficient querying of Federal Register enhancement status
CREATE INDEX IF NOT EXISTS idx_regulation_updates_metadata_enhancement 
ON regulation_updates USING GIN ((metadata->'federal_register_enhancement'));

-- Add index for source attribution queries
CREATE INDEX IF NOT EXISTS idx_regulation_updates_source_attribution 
ON regulation_updates USING GIN ((metadata->'source_attribution'));

-- Add comment explaining the metadata structure
COMMENT ON COLUMN regulation_updates.metadata IS 
'Federal Register enhancement metadata including contexts, processing info, and source attribution';

-- Example metadata structure for documentation:
/*
{
  "federal_register_enhancement": {
    "attempted": true,
    "successful": true,
    "contexts_found": 3,
    "total_documents_referenced": 48,
    "contexts": [
      {
        "document_number": "2025-05444",
        "title": "Electronic Payment of Royalties Using Pay.gov",
        "publication_date": "2025-03-31",
        "type": "Rule",
        "abstract": "Brief description...",
        "full_text": "Complete regulatory text...",
        "url": "https://www.federalregister.gov/documents/...",
        "cached": true
      }
    ],
    "all_documents": [...]
  },
  "processing_metadata": {
    "processed_at": "2025-09-11T14:05:54.465Z",
    "enhancement_attempted": true,
    "enhancement_successful": true
  },
  "source_attribution": "MCP Engine + Federal Register",
  "submission_guidelines": "Detailed compliance submission requirements...",
  "enhanced_summary": "AI-generated comprehensive summary..."
}
*/
