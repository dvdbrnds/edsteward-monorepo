MCP Engine SaaS Port Configuration Analysis:

**INTERNAL SERVICES (MCP Engine runs these):**
- Frontend: 3050 (React/Vite dev server)
- Registry API: 3010 (regulation data management)
- LLM Gateway: 3002 (AI processing)
- Delivery System: 3051 (real-time regulation updates)
- TUF Repository: 3052 (secure regulation delivery)
- WebSocket Service: 3003 (EdSteward integration)
- System Monitor: 3099 (system health dashboard)

**EXTERNAL DEPENDENCIES (MCP Engine connects to these):**
- PostgreSQL: 5432 (database)
- Redis: 6379 (caching)
- EdSteward: 3000 (external customer system)
- Kafka: 9092 (event streaming)
- Zookeeper: 2181 (Kafka coordination)
- Debezium: 8083 (change data capture)

**EXTERNAL APIs (outbound HTTPS/443):**
- uscode.house.gov (USC text)
- api.congress.gov (legislative data)
- copyright.gov (Copyright Office guidance)
- ecfr.gov (CFR regulations)

**KUBERNETES/PRODUCTION PORTS:**
- Prometheus: 9090 (metrics)
- Grafana: 3000 (monitoring dashboard)
- Jaeger: 16686 (distributed tracing)

The system uses fixed port allocation with automatic port conflict resolution during startup.