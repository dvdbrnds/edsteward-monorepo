-- Add requirements column to regulation_updates table
-- This allows MCP Engine to send both full text and AI-generated requirements separately

ALTER TABLE regulation_updates 
ADD COLUMN requirements TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN regulation_updates.requirements IS 'AI-generated structured compliance requirements from MCP Engine LLM Stage 2';
