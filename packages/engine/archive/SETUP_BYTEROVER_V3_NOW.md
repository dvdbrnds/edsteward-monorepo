# 🚀 Setup Byterover V3 - The Right Way

## ⚠️ CRITICAL: V2 vs V3

**You had V2 MCP configured** (deprecated January 25, 2026):
```
❌ https://mcp.byterover.dev/mcp?machineId=...
   - Storage disabled
   - Only retrieval works
   - This is the OLD system
```

**You need V3 CLI** (current, storage works):
```
✅ brv command-line tool
   - Already installed on your system!
   - Storage works via /curate
   - Retrieval works via /query
```

---

## 🎯 Setup V3 in 3 Steps (5 minutes)

### **Step 1: Create Account & Workspace**

1. Go to: **https://app.byterover.dev**
2. Sign up or log in
3. Create a **Team** (your organization name)
4. Create a **Space** (workspace for MCP Engine project)

### **Step 2: Initialize Your Project**

Open terminal in your MCP Engine directory:

```bash
cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"
brv
```

This will open the ByteRover REPL with two tabs:
- **Activity Tab**: Shows operations in progress
- **Console Tab**: Where you type commands (press Tab to switch)

### **Step 3: Login & Initialize**

In the **Console Tab** (press Tab if needed):

```bash
/login
```
- Opens browser for OAuth
- Authenticate with your account
- Returns to terminal when done

Then:

```bash
/init
```
- Select your Team
- Select your Space
- Choose **Cursor** as your coding agent
- Wait for sync to complete

---

## ✅ Test It Works

In the Console Tab:

```bash
/curate "MCP Engine v5.3.0 - Test storage works! Services: Registry API (3010), LLM Gateway (3004), Delivery System (3051)"

/query "What are the MCP Engine service ports?"

/status
```

You should see your knowledge stored and retrieved successfully!

---

## 💡 How to Use Going Forward

### **Option A: Via Cursor (Recommended)**

Just prompt me naturally:
```
"Store this to Byterover: [your knowledge]"
"Query Byterover about MCP Engine architecture"
```

I'll automatically use the `brv` CLI commands for you.

### **Option B: Direct CLI**

Start the REPL:
```bash
brv
```

Then use commands:
```bash
/curate "knowledge to store"
/query "what to find"
/sync   # sync with remote space
/status # view context tree
```

---

## 📁 What Gets Created

After initialization, you'll have:

```
MCP-Engine/
├── .brv/                      # ByteRover config (auto-generated)
│   ├── config.json           # Project settings
│   ├── local/                # Local context tree
│   │   ├── structure/       # Architecture context
│   │   ├── testing/         # Test strategies
│   │   ├── database/        # Database patterns
│   │   └── backend/         # Backend logic
│   └── rules/                # Generated rules for Cursor
│       └── brv-context.md   # Auto-generated context file
```

---

## 🎉 Success Indicators

You'll know it's working when:
- ✅ `/curate` stores knowledge without errors
- ✅ `/query` retrieves your stored knowledge
- ✅ `/status` shows your context tree
- ✅ `.brv/` folder exists in your project
- ✅ No "write operations disabled" errors

---

## 🆘 Troubleshooting

**"Command not found: brv"**
```bash
npm install -g byterover-cli
```

**"Not authenticated"**
```bash
brv
/login
```

**"Project not initialized"**
```bash
brv
/init
```

**Node.js version warning**
- Optional: `nvm install 22 && nvm use 22`
- Current version (24.6) works but may show warnings

---

## 📚 Resources

- **Web App**: https://app.byterover.dev
- **Documentation**: https://docs.byterover.dev
- **Discord Support**: https://discord.gg/UMRrpNjh5W
- **CLI Reference**: https://docs.byterover.dev/reference/cli-reference

---

## ⚡ Quick Start Command

```bash
cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"
brv
# Then: /login → /init → /curate "test" → /query "test"
```

---

**Status**: Ready to initialize
**Action**: Go to app.byterover.dev to create account/team/space
**Time**: 5 minutes total
