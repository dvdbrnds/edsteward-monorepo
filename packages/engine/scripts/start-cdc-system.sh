#!/bin/bash

# Start all CDC components in one script
# This script starts the infrastructure and all required services

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting CDC System...${NC}"

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Docker containers
echo -e "${YELLOW}Starting infrastructure containers...${NC}"
npm run docker:up

# Wait for containers to be ready
echo -e "${YELLOW}Waiting for containers to be ready...${NC}"
sleep 15

# Set up Debezium connector
echo -e "${YELLOW}Setting up Debezium connector...${NC}"
npm run debezium:setup > logs/debezium-setup.log 2>&1 &

# Wait for Debezium to be set up
sleep 5

# Start CDC consumer
echo -e "${YELLOW}Starting CDC consumer...${NC}"
npm run start:cdc > logs/cdc-consumer.log 2>&1 &
CDC_PID=$!
echo -e "${GREEN}CDC consumer started with PID: ${CDC_PID}${NC}"

# Start job worker
echo -e "${YELLOW}Starting job worker...${NC}"
npm run start:worker > logs/job-worker.log 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}Job worker started with PID: ${WORKER_PID}${NC}"

# Start main application
echo -e "${YELLOW}Starting main application...${NC}"
npm run start:app > logs/app.log 2>&1 &
APP_PID=$!
echo -e "${GREEN}Main application started with PID: ${APP_PID}${NC}"

# Create a file with PIDs for cleanup
echo $CDC_PID > .pids
echo $WORKER_PID >> .pids
echo $APP_PID >> .pids

echo -e "${GREEN}All CDC system components started!${NC}"
echo -e "${BLUE}Use ./stop-cdc-system.sh to stop all components${NC}"
echo -e "${YELLOW}Logs are available in the logs/ directory${NC}"

# Keep the script running to maintain the processes
echo -e "${BLUE}Press Ctrl+C to stop all components${NC}"
trap "echo -e '${YELLOW}Stopping CDC system...${NC}'; ./stop-cdc-system.sh; exit" INT TERM
wait 