MCP Engine to EdSteward Delivery Workflow:

1. ENDPOINT CONFIGURATION:
- Customer endpoint should be /api/regulation-updates (creates pending updates for CCO review)
- DO NOT use /api/mcp/regulations/sync (bypasses approval workflow, writes directly to DB)
- Config in: config/customers.json

2. TASK HIERARCHY:
- Tasks need parent_task_id in database for hierarchy
- Delivery server sends tempId and parentTempId
- EdSteward does 2-pass creation: roots first, then children
- Example: 12 section headers + 40 child tasks = 52 total

3. REQUIRED PAYLOAD FIELDS:
- mcpRegKey, regKey, name, statute, category, topic, cfr
- complianceTasks array with: tempId, taskId, parentTempId, title, description, priority, requirementType

4. COMMON ISSUES:
- EdSteward port conflict (EADDRINUSE): kill process on port 3000
- EdSteward pool closed error: restart EdSteward via PM2
- Console HTML syntax error: check template literals for mismatched quotes

5. USER'S WORKFLOW:
- Push from console GUI button
- EdSteward receives as PENDING update
- CCO reviews and approves/denies
- NEVER write directly to EdSteward DB without explicit permission