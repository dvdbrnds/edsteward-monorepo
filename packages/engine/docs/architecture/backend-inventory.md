# Backend Inventory for Multi-tenant Regulation-compliance SaaS

## 1. Codebase Scan
* **Services**: Express.js-based LLM Gateway, MCP Server Registry, Model Context Protocol (MCP) servers for regulations
* **Entry Points**: `src/llm-gateway/start-llm-gateway.js` (main), `server/server.js`, `regulation-mcp-server-registry.cjs`
* **Key Runtime Dependencies**:
  * Express (API framework)
  * Mongoose (MongoDB ODM)
  * @modelcontextprotocol/sdk (MCP protocol implementation)
  * Axios (HTTP client)
  * CSV-parse (data processing)
  * Winston (logging)
  * Dotenv (configuration)
  * UUID (unique identifiers)

## 2. Data & CDC
* **Database Schema**:
  * PostgreSQL tables: regulatory_sources, source_updates, regulations, regulation_versions, requirements
  * DynamoDB tables: Regulations (regulationId key), Validations (id key)
  * S3 bucket for baselines storage
* **CDC Setup**: 🚧 No visible CDC configuration, though CDC format documented in `MCP_CDC_Format_Documentation.md`
* **Schema Indexing**: Indexes on source_id, regulation_id, update_timestamp, effective_date

## 3. API Surface
* **REST Endpoints**:
  * `/compliance/query` (POST): Process compliance queries
  * `/api/regulations` (GET): List regulations
  * `/api/regulations/category/:category` (GET): Filter by category
  * `/api/validate` (POST): Validate text against regulations
  * `/api/detect-changes` (POST): Detect regulatory changes
  * `/v1/regulations` (GET): List regulations (from API contract)
  * `/v1/regulations/{regulationId}` (GET): Get regulation details
  * `/v1/regulations/{regulationId}/diff` (GET): Compare regulation versions
  * `/v1/validate` (POST): Validate compliance data
* **Auth**: JWT-based with Amazon Cognito
* **Rate Limiting**: 🚧 Not explicitly implemented in code examined

## 4. Security & Auth
* **Auth Mechanism**: JWT tokens via Amazon Cognito
* **Tenant Isolation**: 🚧 No explicit tenant isolation seen in codebase
* **Rate Limiting**: 🚧 Not implemented in reviewed code

## 5. Job / Queue Infrastructure
* 🚧 No dedicated job infrastructure found in reviewed code
* Simple timeout-based scheduling in `MCPHostController`
* 🚧 Missing retries/backoff strategies

## 6. Observability
* **Logging**: Winston logger with custom setup in `src/utils/logger.js`
* **Health Checks**: `/health` endpoint in LLM Gateway
* 🚧 Missing APM tracing, metrics collection, alerting

## 7. Build & Deploy
* **Infrastructure**: AWS Serverless Framework configuration (Lambda, DynamoDB, S3)
* **CI/CD**: 🚧 No explicit CI/CD pipelines found
* **Environment Config**: Env variables in `.env` with example in `env.example`
* **Functions**: Serverless Lambda functions for orchestrator, validators, data collector

*Note: Port 3050 for the client is already in use - you'll need to change it to start development.* 