#!/bin/bash

# Stop all CDC components
# This script stops all services and infrastructure

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping CDC System...${NC}"

# Stop Node.js processes
if [ -f .pids ]; then
  echo -e "${YELLOW}Stopping Node.js processes...${NC}"
  while read PID; do
    if ps -p $PID > /dev/null; then
      echo -e "${YELLOW}Stopping process with PID: ${PID}${NC}"
      kill $PID
    else
      echo -e "${RED}Process with PID ${PID} is not running${NC}"
    fi
  done < .pids
  rm .pids
else
  echo -e "${YELLOW}No PID file found, attempting to find processes...${NC}"
  # Try to find processes by command
  CDC_PID=$(pgrep -f "start:cdc")
  if [ ! -z "$CDC_PID" ]; then
    echo -e "${YELLOW}Stopping CDC consumer with PID: ${CDC_PID}${NC}"
    kill $CDC_PID
  fi
  
  WORKER_PID=$(pgrep -f "start:worker")
  if [ ! -z "$WORKER_PID" ]; then
    echo -e "${YELLOW}Stopping job worker with PID: ${WORKER_PID}${NC}"
    kill $WORKER_PID
  fi
  
  APP_PID=$(pgrep -f "start:app")
  if [ ! -z "$APP_PID" ]; then
    echo -e "${YELLOW}Stopping main application with PID: ${APP_PID}${NC}"
    kill $APP_PID
  fi
fi

# Stop Docker containers
echo -e "${YELLOW}Stopping infrastructure containers...${NC}"
npm run docker:down

echo -e "${GREEN}CDC system stopped successfully${NC}" 