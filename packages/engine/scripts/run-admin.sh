#!/bin/bash

# Run the simple admin server with environment variables set directly
# This avoids having to use a .env file

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting simple admin server with environment variables...${NC}"

# Create logs directory if it doesn't exist
mkdir -p logs

# Set environment variables for testing
export NODE_ENV=development
export PORT=3001
export LOG_LEVEL=info

# Run the simple admin server
echo -e "${YELLOW}Running simple admin server on port ${PORT}...${NC}"
node src/simple-admin-server.js 