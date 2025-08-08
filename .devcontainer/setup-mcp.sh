#!/bin/bash

# MCP Configuration Setup Script
# Runs automatically on every container rebuild via postCreateCommand
# Restores all 6 MCP servers and ensures proper configuration

set -e

echo "🔧 Setting up MCP Engine configuration..."

# Ensure we're in the right directory
cd /workspace

# Create necessary directories
mkdir -p /home/vscode/.cursor
mkdir -p logs
mkdir -p data

# Set proper permissions
sudo chown -R vscode:vscode /home/vscode/.cursor
sudo chown -R vscode:vscode /workspace/logs
sudo chown -R vscode:vscode /workspace/data

# Install project dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Install client dependencies
if [ -d "src/client" ] && [ ! -d "src/client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd src/client
    npm install
    cd /workspace
fi

# Configure MCP servers in Cursor configuration
echo "🔗 Configuring MCP servers..."

# Create MCP configuration file
cat > /home/vscode/.cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "context7": {
      "command": "curl",
      "args": ["-X", "POST", "https://mcp.context7.com/mcp"],
      "env": {}
    },
    "Filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
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
    },
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "mcp-gateway"],
      "env": {}
    }
  }
}
EOF

# Set proper permissions on MCP config
sudo chown vscode:vscode /home/vscode/.cursor/mcp.json
chmod 644 /home/vscode/.cursor/mcp.json

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔐 Creating environment configuration..."
    cp env.example .env 2>/dev/null || echo "NODE_ENV=development
LOG_LEVEL=debug
LLM_GATEWAY_PORT=3002
FRONTEND_PORT=3050
REGISTRY_PORT=3010
MCP_ENVIRONMENT=devcontainer" > .env
fi

# Install MCP packages globally for easy access
echo "📦 Installing MCP packages globally..."
npm install -g @modelcontextprotocol/server-filesystem @agentdeskai/browser-tools-mcp@1.2.0 @modelcontextprotocol/server-sequential-thinking @modelcontextprotocol/server-puppeteer

# Make scripts executable
chmod +x .devcontainer/*.sh
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

# Create health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

echo "🩺 MCP Engine Health Check"
echo "=========================="

# Check Node.js processes
echo "📊 Node.js Processes:"
ps aux | grep node | grep -v grep | wc -l

# Check MCP configuration
echo "🔗 MCP Configuration:"
if [ -f "/home/vscode/.cursor/mcp.json" ]; then
    echo "✅ MCP config exists"
    echo "📋 Configured servers: $(jq -r '.mcpServers | keys | length' /home/vscode/.cursor/mcp.json)"
else
    echo "❌ MCP config missing"
fi

# Check port availability
echo "🌐 Port Status:"
for port in 3002 3010 3050; do
    if netstat -tuln | grep -q ":$port "; then
        echo "✅ Port $port: In use"
    else
        echo "⚪ Port $port: Available"
    fi
done

# Check file permissions
echo "🔐 Permissions:"
ls -la /home/vscode/.cursor/mcp.json 2>/dev/null && echo "✅ MCP config permissions OK" || echo "❌ MCP config permissions issue"

echo "=========================="
echo "Health check complete!"
EOF

chmod +x scripts/health-check.sh

echo "✅ MCP Engine configuration setup complete!"
echo "🔧 Configuration restored:"
echo "   • MCP servers: context7, Filesystem, BrowserTools, Sequential Thinking, Puppeteer, MCP_DOCKER"
echo "   • Config location: /home/vscode/.cursor/mcp.json"
echo "   • Environment: devcontainer"
echo "   • Health check: scripts/health-check.sh"
echo ""
echo "🚀 Ready for development!"


