## Multi-Repository Byterover Cursor Integration Architecture

**Critical Context**: Two separate Cursor IDE instances requiring coordinated project management:

**EdSteward Repository (Frontend)**:
- React/Express.js application
- University-facing compliance interface
- Regulation display and acceptance UI
- Authentication system (SAML, local auth)
- Modules: edsteward_authentication, edsteward_regulation_updates

**MCP Engine Repository (Backend)**:
- Regulation processing and validation engine
- Federal Register API integration
- LLM gateway for compliance analysis
- Real-time delivery system
- Modules: mcp_engine_llm_gateway, mcp_engine_delivery_system

**Orchestration Challenges**:
1. Cross-repository task dependencies
2. Synchronized development progress tracking
3. Coordinated deployment and testing
4. Shared regulation data consistency
5. API contract alignment between repositories

**Integration Requirements**:
- Dual-repo byterover sync scripts
- Cross-repository task linking
- Coordinated daily standup across both projects
- API contract validation between EdSteward and MCP Engine
- Synchronized deployment coordination