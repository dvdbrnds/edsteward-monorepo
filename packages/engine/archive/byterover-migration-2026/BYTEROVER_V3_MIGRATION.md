# Byterover v3 Complete Migration Guide

## 🚨 MAJOR CHANGES (January 2026)

**Byterover has completely changed its architecture in v3!**

### What's Different:
- ❌ **Old:** Simple MCP server with token authentication at `dashboard.byterover.dev`
- ✅ **New:** CLI-based tool with OAuth authentication at `app.byterover.dev`
- ❌ **Old:** `byterover-store-knowledge` MCP tool
- ✅ **New:** `brv curate` CLI command
- ❌ **Old:** Dashboard token
- ✅ **New:** OAuth login + team/space workspace model

---

## ✅ Your Current Status

You have ByteRover CLI installed: **v1.2.1**
```bash
brv --version
# byterover-cli/1.2.1 darwin-arm64 node-v24.6.0
```

**Project Status:** ❌ Not initialized yet

---

## 📋 Setup Instructions

### **Step 1: Create Account & Workspace**

1. Visit: **https://app.byterover.dev** (the NEW web app)
2. Sign up or log in
3. Create a **Team** (your organization)
4. Create a **Space** (your workspace for this project)

### **Step 2: Start ByteRover REPL**

```bash
cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"
brv
```

This opens an interactive terminal with two tabs:
- **Activity Tab**: Shows operations in progress
- **Console Tab**: Where you type commands

### **Step 3: Login**

Press `Tab` to switch to Console tab, then:

```bash
/login
```

This will:
1. Open your browser for OAuth authentication
2. Store credentials securely in your system keychain
3. Connect to your ByteRover account

### **Step 4: Initialize Project**

```bash
/init
```

You'll be prompted to:
1. Select your **team**
2. Select your **space**
3. Choose your **coding agent** (Cursor)

ByteRover will:
- Sync your remote context
- Generate rule files in `.brv/` folder
- Create local context tree structure

### **Step 5: Store Knowledge (Curate)**

#### Via Cursor (AI Agent):
Prompt Cursor:
```
Use brv curate command to store knowledge about MCP Engine v5.3.0 architecture
```

#### Manually in Console:
```bash
/curate "MCP Engine v5.3.0 runs services on ports: Registry API (3010), LLM Gateway (3004), Delivery System (3051), Frontend (3050), Inquisitor (3061)"
```

### **Step 6: Retrieve Knowledge (Query)**

#### Via Cursor (AI Agent):
```
Use brv query command to check what MCP Engine ports are configured
```

#### Manually in Console:
```bash
/query "What are the MCP Engine service ports?"
```

### **Step 7: Check Status**

```bash
/status
```

Shows your context tree with all curated knowledge.

---

## 🔄 Command Comparison

| Old v2 MCP | New v3 CLI | Description |
|------------|------------|-------------|
| `byterover-store-knowledge` | `brv curate` | Store knowledge |
| `byterover-retrieve-knowledge` | `brv query` | Retrieve knowledge |
| N/A | `brv sync` | Sync with remote space |
| N/A | `brv status` | View context tree |
| Dashboard UI | `app.byterover.dev` | Web interface |

---

## 📁 New File Structure

After initialization, you'll see:

```
MCP-Engine/
├── .brv/                          # ByteRover config (auto-generated)
│   ├── config.json               # Project configuration
│   ├── local/                    # Local context tree
│   │   ├── structure/           # Architecture context
│   │   ├── testing/             # Test strategies
│   │   ├── database/            # Database patterns
│   │   └── backend/             # Backend logic
│   └── rules/                    # Generated rule files
│       └── brv-context.md       # Auto-generated rules for Cursor
```

---

## 🎯 Common Workflows

### Store System Overview
```bash
/curate "MCP Engine v5.3.0 - EdSteward Integration Platform
- PostgreSQL-backed regulation database
- Zeus orchestrator manages 6 microservices
- Recent: Executive Orders integration (Jan 26)
- Current focus: Phase 3 regulation enhancement"
```

### Store Recent Changes
```bash
/curate "Jan 26, 2026 commit: Fixed EdSteward auth (mcp-engine username), added EO tracking to all 285 regulation consoles, taskSyncMode: merge to preserve completed tasks"
```

### Query Architecture
```bash
/query "Explain the MCP Engine service architecture and ports"
```

### Query Recent Changes
```bash
/query "What were the latest changes to EdSteward integration?"
```

### Sync with Team
```bash
/sync
```

---

## 🔧 Troubleshooting

### Node.js Version Warning
You may see:
```
⚠️  Node.js version warning
Node.js 24.6 has not been fully tested with ByteRover CLI.
Recommended versions: Node.js 20.x or 22.x
```

**Solution (optional):**
```bash
nvm install 22
nvm use 22
```

### Not Authenticated
If you see authentication errors:
```bash
brv
/login
```

### Project Not Initialized
```bash
brv
/init
```

### View Logs
```bash
brv --verbose
```

---

## 🆚 Why the Change?

Byterover v3 introduces:
1. **Better Context Organization**: Structured domains (structure, testing, database, etc.)
2. **Team Collaboration**: Shared spaces for team knowledge
3. **Agent Integration**: Direct CLI commands agents can use
4. **Workspace Model**: Separate spaces for different projects
5. **OAuth Security**: No more manual token management

---

## 📚 Resources

- **Web App**: https://app.byterover.dev
- **Documentation**: https://docs.byterover.dev
- **Quickstart**: https://docs.byterover.dev/quickstart
- **Discord**: https://discord.gg/UMRrpNjh5W
- **CLI Reference**: https://docs.byterover.dev/reference/cli-reference

---

## 🚀 Quick Start Script

Run this to see all steps:
```bash
./setup-byterover-v3.sh
```

---

**Status**: Ready to initialize
**Action**: Follow Step 1 to create account at app.byterover.dev

