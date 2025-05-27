#!/bin/bash

# Kill processes running on specific ports
# Usage: ./kill-port.sh PORT_NUMBER

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

if [ $# -eq 0 ]; then
  echo -e "${RED}Error: Please provide a port number${NC}"
  echo "Usage: ./kill-port.sh PORT_NUMBER"
  exit 1
fi

PORT=$1

# Find process using the port
echo -e "Finding process using port ${PORT}..."
PID=$(lsof -ti:${PORT})

if [ -z "$PID" ]; then
  echo -e "${RED}No process found using port ${PORT}${NC}"
  exit 0
else
  echo -e "Found process ${PID} using port ${PORT}"
  echo -e "Killing process ${PID}..."
  kill -9 $PID
  echo -e "${GREEN}Process killed successfully${NC}"
fi 