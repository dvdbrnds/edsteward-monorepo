#!/bin/zsh

# ByteRover v3 Setup Script for MCP Engine
# This script initializes ByteRover CLI in the MCP Engine project

echo "🚀 ByteRover v3 Setup for MCP Engine"
echo "======================================"
echo ""

# Check if brv is installed
if ! command -v brv &> /dev/null; then
    echo "❌ ByteRover CLI not found. Installing..."
    npm install -g byterover-cli
else
    echo "✅ ByteRover CLI found: $(brv --version)"
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Sign up/login at: https://app.byterover.dev"
echo "   - Create a team"
echo "   - Create a space (workspace)"
echo ""
echo "2. Run the interactive setup:"
echo "   brv"
echo ""
echo "3. In the ByteRover console, type:"
echo "   /login"
echo "   (This will open your browser for OAuth)"
echo ""
echo "4. Then initialize the project:"
echo "   /init"
echo "   (Select your team, space, and coding agent)"
echo ""
echo "5. Test storage:"
echo "   /curate \"MCP Engine v5.3.0 system overview\""
echo ""
echo "6. Test retrieval:"
echo "   /query \"What are the MCP Engine service ports?\""
echo ""
echo "======================================"
echo "📚 Documentation: https://docs.byterover.dev"
echo "🆘 Support: https://discord.gg/UMRrpNjh5W"
