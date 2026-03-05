# CDC Pipeline Implementation Guide

This document provides instructions for setting up and using the Change Data Capture (CDC) pipeline for the multi-tenant regulation-compliance SaaS application.

## Overview

The CDC pipeline captures database changes in real-time and processes them through a series of steps:

1. PostgreSQL database with logical replication enabled
2. Debezium connector capturing changes
3. Kafka as the message bus for CDC events
4. CDC consumer processing change events
5. BullMQ job queue for asynchronous regulation processing

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- Redis server (included in Docker Compose)

## Setup Instructions

### 1. Start Infrastructure

Start the required infrastructure using Docker Compose:

```bash
# Start PostgreSQL, Kafka, Zookeeper, Debezium, and Redis
npm run docker:up
```

This will start:
- PostgreSQL with logical replication enabled
- Kafka and Zookeeper
- Debezium Connect
- Redis for job queue

### 2. Set Up Debezium Connector

Register the Debezium connector with Kafka Connect:

```bash
# Wait for infrastructure to be ready (~30 seconds)
npm run debezium:setup
```

This will:
- Register the PostgreSQL connector with Debezium
- Configure it to capture changes from the regulations table
- Set up the transformations and routing

### 3. Start CDC Consumer

Start the CDC consumer to process database changes:

```bash
# Start the CDC consumer
npm run start:cdc
```

The CDC consumer will:
- Connect to Kafka
- Subscribe to the CDC topics
- Process change events
- Add jobs to the regulation queue

### 4. Start Job Worker

Start the job worker to process regulation jobs:

```bash
# Start the job worker
npm run start:worker
```

The worker will:
- Process jobs from the queue
- Handle regulation updates
- Implement back-pressure and retries

### 5. Start the Application

Start the main application:

```bash
# Start the main application
npm run start:app
```

## Testing the CDC Pipeline

### Option 1: End-to-End Test

Run the automated end-to-end test:

```bash
# Run the E2E test
npm run test:e2e
```

This will:
1. Start the application
2. Create a test regulation
3. Trigger CDC events
4. Verify the processing

### Option 2: CDC Pipeline Test

Test just the CDC pipeline components:

```bash
# Run the CDC pipeline test
npm run test:cdc
```

This test simulates CDC events without requiring the full infrastructure.

### Option 3: Manual Testing

You can manually test the CDC pipeline using the admin API:

```bash
# Start the admin server
npm run start:admin

# In another terminal, use curl to inject a test regulation
curl -X POST http://localhost:3000/v1/admin/inject-test-reg \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "reg_id": "TEST-REG-001",
    "title": "Test Regulation",
    "revision": "2023-01",
    "payload": {
      "summary": "This is a test regulation"
    }
  }'
```

## CDC Flow Explanation

1. **Database Change**: A regulation is created, updated, or deleted in the PostgreSQL database.

2. **Debezium Capture**: Debezium captures the change from PostgreSQL's logical replication slot.

3. **Kafka Message**: The change is published to a Kafka topic with standardized format.

4. **CDC Consumer**: Our CDC consumer reads the message from Kafka.

5. **Job Queue**: A job is added to the BullMQ queue with appropriate priority.

6. **Job Processing**: The worker processes the job, performing any required actions.

7. **Application Update**: The application reflects the changes from the database.

## Troubleshooting

### Check Kafka Connect Status

```bash
curl -X GET http://localhost:8083/connectors/regulations-connector/status
```

### Check Kafka Topics

```bash
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### View Kafka Messages

```bash
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic postgres-db-server.public.regulations --from-beginning
```

### Check Redis Queue

```bash
# Start Redis CLI
docker exec -it redis redis-cli

# View queues
KEYS *

# View queue length
LLEN regulation-processing
```

## Shutting Down

```bash
# Stop the application and components
npm run docker:down
```

This will stop all containers and clean up resources. 