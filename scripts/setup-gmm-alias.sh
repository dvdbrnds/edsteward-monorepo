#!/bin/zsh

# Setup script to add GMM alias to your shell profile
# Usage: ./setup-gmm-alias.sh

# Get the current directory (where gmm.sh is located)
CURRENT_DIR=$(pwd)
GMM_PATH="$CURRENT_DIR/gmm.sh"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up GMM alias...${NC}"

# Check if gmm.sh exists
if [[ ! -f "$GMM_PATH" ]]; then
    echo -e "${YELLOW}Error: gmm.sh not found in current directory${NC}"
    exit 1
fi

# Determine which shell profile to use
if [[ -f "$HOME/.zshrc" ]]; then
    PROFILE="$HOME/.zshrc"
elif [[ -f "$HOME/.bash_profile" ]]; then
    PROFILE="$HOME/.bash_profile"
elif [[ -f "$HOME/.bashrc" ]]; then
    PROFILE="$HOME/.bashrc"
else
    echo -e "${YELLOW}No shell profile found. Creating ~/.zshrc${NC}"
    PROFILE="$HOME/.zshrc"
    touch "$PROFILE"
fi

# Check if alias already exists
if grep -q "alias gmm=" "$PROFILE"; then
    echo -e "${YELLOW}GMM alias already exists in $PROFILE${NC}"
    echo "Current alias:"
    grep "alias gmm=" "$PROFILE"
else
    # Add the alias
    echo "" >> "$PROFILE"
    echo "# GMM - Good Morning MCP alias" >> "$PROFILE"
    echo "alias gmm='$GMM_PATH'" >> "$PROFILE"
    
    echo -e "${GREEN}✅ GMM alias added to $PROFILE${NC}"
fi

echo -e "${BLUE}Setup complete!${NC}"
echo ""
echo "To use GMM, either:"
echo "1. Restart your terminal and type: gmm"
echo "2. Or run: source $PROFILE && gmm"
echo "3. Or run directly: $GMM_PATH"
echo ""
echo -e "${GREEN}GMM will safely shutdown and restart your MCP Engine system every morning!${NC}"
