## EdSteward Multi-Tenant Database Architecture (January 6, 2026)

Successfully implemented true database isolation for EdSteward customers:

### Architecture
- **Production Customers**: Each gets their own isolated Neon project with unique credentials
- **Internal Dev/Staging**: Branches within shared project for cost efficiency

### Current Setup
| Environment | Database | Project |
|-------------|----------|---------|
| moravian.edsteward.ai | ep-summer-pine-ae88mdbc | moravian-university (isolated) |
| staging.edsteward.ai | ep-fancy-scene-a56u8gwz | RegulatoryTrackr/staging branch |
| test.edsteward.ai | ep-square-art-a5pz9nnv | RegulatoryTrackr/dev branch |

### Deployment
Use `scripts/deploy-moravian-production.sh` which:
1. Builds Docker image with unique tag
2. Updates ECS task definition with new DATABASE_URL
3. Deploys to AWS ECS

### Compliance Tasks Seeded
- Clery Act: 42 tasks
- Title IX: 36 tasks
- FERPA: 23 tasks
- Total: 101 tasks across 3 regulations

### CRITICAL: MCP Engine Requirement
Only 3/355 regulations have task templates. MCP Engine MUST provide compliance task templates for all regulations requiring more than attestation. See `MCP_CRITICAL_REQUIREMENT_TASK_TEMPLATES.md`.