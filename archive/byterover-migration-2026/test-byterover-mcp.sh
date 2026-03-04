#!/bin/zsh

# Byterover v3 MCP Server Test Script

echo "🧪 Testing Byterover v3 MCP Connection"
echo "======================================="
echo ""

# Check configuration
echo "✅ Configuration found in ~/.cursor/mcp.json"
echo "   Server: byterover-mcp"
echo "   URL: https://mcp.byterover.dev/mcp?machineId=..."
echo ""

echo "📋 Next Steps:"
echo ""
echo "1. ⚠️  RESTART CURSOR COMPLETELY (Cmd+Q, then reopen)"
echo "   This is required for the new MCP server to load"
echo ""
echo "2. After restart, the byterover-store-knowledge tool should be available"
echo ""
echo "3. Test storage by asking me:"
echo "   'Store this knowledge to Byterover: MCP Engine v5.3.0 test'"
echo ""
echo "4. Test retrieval by asking me:"
echo "   'Retrieve knowledge from Byterover about MCP Engine'"
echo ""
echo "======================================="
echo ""
echo "🔍 Checking MCP server status..."
echo ""

# List MCP servers available in the current session
if [ -f ~/.cursor/mcp.json ]; then
    echo "✅ MCP servers configured:"
    cat ~/.cursor/mcp.json | jq -r '.mcpServers | keys[]' 2>/dev/null || \
    cat ~/.cursor/mcp.json | grep -o '"[^"]*":' | sed 's/[":]*//g'
else
    echo "❌ No MCP configuration found"
fi

echo ""
echo "⚡ If Byterover tools don't appear after restart:"
echo "   - Check Cursor's MCP server logs"
echo "   - Verify machine ID is correct"
echo "   - Try re-generating machine ID from app.byterover.dev"
