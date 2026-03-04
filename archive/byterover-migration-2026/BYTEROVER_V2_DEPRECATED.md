# ⚠️ IMPORTANT: Byterover V2 MCP is DEPRECATED

## What Happened

As of **January 25, 2026**, Byterover V2 (MCP-based) is **DEPRECATED**.

- ❌ V2 MCP Server: `https://mcp.byterover.dev/v2/mcp` - **DISABLED**
- ❌ Write operations via MCP tools - **PERMANENTLY DISABLED**  
- ✅ V3 CLI is the ONLY way forward

## Official Timeline

- **December 16, 2025**: Migration announcement
- **December 28, 2025**: V3 CLI released
- **January 25, 2026**: **V2 memory creation DISABLED**

## Why MCP Was Removed

From Byterover's official blog:

> "MCP installation and tool triggers were inconsistent across IDEs, extensions, and LLMs. CLI provides a more reliable interface that AI agents are natively fluent in."

Source: https://www.byterover.dev/blog/byterover-cli-a-deep-dive-into-our-move-from-mcp-to-cli

---

## ✅ The ONLY Way to Use Byterover Now: V3 CLI

### Step 1: Remove Old V2 Configuration

✅ **DONE** - I've removed the deprecated MCP server from your `mcp.json`

### Step 2: Use ByteRover CLI (Already Installed!)

You have `byterover-cli@1.2.1` installed. Here's how to use it:

```bash
cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"
brv
```

### Step 3: Login & Initialize

In the ByteRover REPL:
```bash
/login    # Opens browser for OAuth at app.byterover.dev
/init     # Select team, space, coding agent (Cursor)
```

### Step 4: Store Knowledge

```bash
/curate "MCP Engine v5.3.0 system knowledge here"
```

### Step 5: Retrieve Knowledge

```bash
/query "What do we know about MCP Engine?"
```

---

## How AI Agents Use V3

### Before (V2 - DEPRECATED):
```
AI calls: byterover-store-knowledge MCP tool
Status: ❌ DISABLED since Jan 25, 2026
```

### Now (V3 - CURRENT):
```
You ask AI: "Use brv curate to store this knowledge"
AI runs: brv curate "knowledge content"
Status: ✅ WORKS via CLI
```

---

## Key Commands

| Task | Command | Where |
|------|---------|-------|
| Start | `brv` | Terminal |
| Login | `/login` | In brv REPL |
| Init Project | `/init` | In brv REPL |
| Store | `/curate "..."` | In brv REPL |
| Retrieve | `/query "..."` | In brv REPL |
| Check Status | `/status` | In brv REPL |
| Sync Team | `/sync` | In brv REPL |

---

## Resources

- **V3 Docs**: https://docs.byterover.dev/
- **Quickstart**: https://docs.byterover.dev/quickstart
- **Migration Guide**: https://docs.byterover.dev/migration-guide
- **V2 → V3 Blog**: https://www.byterover.dev/blog/byterover-cli-a-deep-dive-into-our-move-from-mcp-to-cli
- **Web App (NEW)**: https://app.byterover.dev
- **Web App (OLD V2)**: https://app-v2.byterover.dev (read-only)
- **Discord**: https://discord.gg/UMRrpNjh5W

---

## Bottom Line

**Byterover v3 does NOT use MCP anymore.**  
**It's CLI-only.**  
**You need to use `brv` commands, not MCP tools.**

The old MCP server you were trying to connect to is permanently shut down.
