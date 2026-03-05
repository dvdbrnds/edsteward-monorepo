Updated Docker development setup with port conflict avoidance for MCP Engine development.

**Context**: User has existing edsteward client frontend SaaS running in Docker, needed to avoid port conflicts.

**Solution**: Modified Simple Docker Container option (Option 1) to use alternative port mappings:

**Port Mapping Changes**:
- 4000:3000 (Main App - was 3000:3000)
- 4002:3002 (LLM Gateway - was 3002:3002) 
- 4010:3010 (Registry API - was 3010:3010)
- 4050:3050 (Frontend Console - was 3050:3050)
- 4100:3100 (MCP Host Controller - was 3100:3100)
- 4200:3200 (Enhanced LLM Gateway - was 4200:3200)
- 4300:3300 (Regulation Generators - was 3300:3300)
- 4400:3400 (Admin Server - was 3400:3400)
- 4500:3500 (CDC Pipeline - was 3500:3500)

**Updated Script**: `docker-run-dev.sh` now uses 4000-series ports to avoid conflicts with existing containers.

**Usage**:
```bash
# From host machine (outside container):
./docker-run-dev.sh

# Access services on:
# - Main app: http://localhost:4000
# - Frontend: http://localhost:4050
# - Admin: http://localhost:4400
```

**Key Benefits**:
- Avoids port conflicts with edsteward frontend
- Maintains all MCP Engine functionality
- Simple single-container development
- Easy to start/stop and manage

**Files Modified**:
- `docker-run-dev.sh` - Updated port mappings from 3000-series to 4000-series

**Next Steps**: User ready to build and start the container from host machine.