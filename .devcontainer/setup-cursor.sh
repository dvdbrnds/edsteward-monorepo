#!/bin/bash

# EdSteward Cursor DevContainer Setup Script
echo "🎯 Setting up EdSteward DevContainer for Cursor..."

# Update package lists
apt-get update

# Install additional tools that work well with Cursor
echo "📦 Installing additional development tools..."

# Install ripgrep for better search (Cursor uses this)
apt-get install -y ripgrep

# Install fd-find for file searching
apt-get install -y fd-find

# Install bat for better file viewing
apt-get install -y bat

# Install exa for better ls
apt-get install -y exa

# Set up aliases that work well in Cursor
echo "⚙️  Setting up shell aliases..."
cat >> ~/.bashrc << 'EOF'

# Cursor-friendly aliases
alias ll='exa -la'
alias la='exa -la'
alias l='exa -l'
alias tree='exa --tree'
alias cat='batcat'
alias find='fdfind'

# Development shortcuts
alias dev='npm run dev'
alias build='npm run build'
alias test='npm test'
alias logs='docker compose -f docker-compose.dev.yml logs -f'

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline'

EOF

# Install global npm packages useful for development
echo "📦 Installing global npm packages..."
npm install -g typescript ts-node nodemon prettier eslint

# Set up git configuration for container
echo "🔧 Configuring git..."
git config --global init.defaultBranch main
git config --global core.editor "nano"

# Create a welcome message
echo "✅ EdSteward DevContainer setup complete!"
echo ""
echo "🚀 Available commands:"
echo "  npm run dev     - Start development server"
echo "  npm run build   - Build application"
echo "  npm test        - Run tests"
echo "  logs            - View application logs"
echo ""
echo "📁 Project structure:"
echo "  /app           - EdSteward application code"
echo "  /app/server    - Backend server code"
echo "  /app/client    - Frontend client code"
echo ""
echo "🎯 Ready for development with Cursor!"
