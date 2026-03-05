User wants specific text blocks to coordinate port allocation between EdSteward AI and MCP Engine AI systems. Need to create clear instructions for each AI about port reservations and integration points.

Key coordination points:
- EdSteward uses ports 3000, 3003 (existing)
- MCP Engine uses ports 3002, 3003, 3010, 3050-3052, 3099, 3200-3330+ (existing)
- New Compliance Tracker MCP needs ports 3004-3009, 3060-3080 (new allocation)
- Shared database (5432) and Redis (6379) with schema/namespace isolation
- Integration flow: EdSteward → MCP Engine → Compliance Tracker MCP