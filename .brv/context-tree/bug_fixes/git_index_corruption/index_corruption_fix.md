Git index corruption fix for MCP Engine repository. When encountering "Resource deadlock avoided" or "failed to insert into database" errors during git add:

```bash
# Fix Git index corruption
rm -f .git/index.lock
git reset --mixed HEAD

# Then commit essential files only (avoid problematic files)
git add .env src/llm-gateway/analysis-service.js src/llm-gateway/start-llm-gateway-phase4.js
git commit -m "Critical fixes"
git push origin branch-name
```

This resolves database lock issues and ensures critical code changes are safely committed to GitHub. Always commit essential files first when dealing with index corruption.