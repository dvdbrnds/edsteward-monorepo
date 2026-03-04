#!/bin/bash

# Manual MCP Setup Script
# Run this after the dev container starts successfully

set -e

echo "🔧 Setting up MCP Engine configuration manually..."

# Create necessary directories
mkdir -p ~/.cursor
mkdir -p logs
mkdir -p data

# Configure MCP servers in Cursor configuration
echo "🔗 Configuring MCP servers..."

# Create MCP configuration file
cat > ~/.cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "context7": {
      "command": "curl",
      "args": ["-X", "POST", "https://mcp.context7.com/mcp"],
      "env": {}
    },
    "Filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspaces/MCP-Engine"],
      "env": {}
    },
    "BrowserTools": {
      "command": "npx",
      "args": ["-y", "@agentdeskai/browser-tools-mcp@1.2.0"],
      "env": {}
    },
    "Sequential_Thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    },
    "Puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {}
    }
  }
}
EOF

chmod 644 ~/.cursor/mcp.json

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔐 Creating environment configuration..."
    echo "NODE_ENV=development
LOG_LEVEL=debug
LLM_GATEWAY_PORT=3002
FRONTEND_PORT=3050
REGISTRY_PORT=3010
MCP_ENVIRONMENT=devcontainer" > .env
fi

# Install MCP packages globally
echo "📦 Installing MCP packages..."
npm install -g @modelcontextprotocol/server-filesystem @agentdeskai/browser-tools-mcp@1.2.0 @modelcontextprotocol/server-sequential-thinking @modelcontextprotocol/server-puppeteer

# Install project dependencies if not done
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Install client dependencies
if [ -d "src/client" ] && [ ! -d "src/client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd src/client
    npm install
    cd /workspaces/MCP-Engine
fi

echo "✅ MCP Engine setup complete!"
echo "🔧 Configuration:"
echo "   • MCP servers: context7, Filesystem, BrowserTools, Sequential Thinking, Puppeteer"
echo "   • Config location: ~/.cursor/mcp.json"
echo "   • Environment: devcontainer"
echo ""
echo "🚀 Ready for development!"
echo ""
echo "💡 To start services:"
echo "   npm run dev:gateway    # Start LLM Gateway on port 3002"
echo "   npm run dev:client     # Start Frontend on port 3050"
