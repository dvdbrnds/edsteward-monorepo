Health check commands can resolve service issues in Node.js applications. When running `curl` tests against API endpoints, it can:

1. **Warm up module cache** - Forces lazy-loaded modules to initialize properly
2. **Clear DNS resolution issues** - Triggers fresh DNS lookups that may have been cached incorrectly  
3. **Initialize service connections** - Forces database/Redis connections to establish properly
4. **Load configuration** - Ensures environment variables and config files are read correctly

```bash
# Health check pattern that can fix service issues
curl -s http://localhost:3002/api/llm/health | jq '.status'
curl -s http://localhost:3002/api/llm/data/usc | jq '.success'
```

This is particularly effective for services that have been restarted multiple times or have intermittent connection issues. The act of making HTTP requests can stabilize services that are in a "degraded" state due to initialization problems.