Frontend "Failed to fetch" issue resolved by restarting Vite dev server. The problem was browser caching of the old HTML file with incorrect API URLs. When Vite restarted, it automatically found port 3050 in use and moved to port 3052, which cleared the cache issue.

**Solution for "Failed to fetch" errors:**
```bash
# Stop Vite frontend
pkill -f "vite.*3050"

# Restart Vite (will auto-select available port)
cd src/client && PORT=3050 npx vite --host 0.0.0.0 --port 3050 public &

# Vite output shows port change:
# Port 3050 is in use, trying another one...
# Port 3051 is in use, trying another one...
# VITE v5.4.18  ready in 84 ms
# ➜  Local:   http://localhost:3052/
```

**Root Cause:** Browser cached old HTML with incorrect API endpoints. Vite port change forced fresh cache.