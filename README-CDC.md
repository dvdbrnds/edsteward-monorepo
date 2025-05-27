# CDC Implementation for Multi-tenant Regulation-Compliance SaaS

This project implements a Change Data Capture (CDC) system for a multi-tenant regulation-compliance SaaS application. The CDC system captures database changes in real-time and processes them through a series of steps.

## Features

- **PostgreSQL with Logical Replication**: Captures database changes in real-time
- **Debezium and Kafka**: Streams database changes reliably
- **Tenant Isolation**: Multi-tenancy support with Row-Level Security
- **Job Queue**: Asynchronous processing of regulation changes
- **Observability**: Logging and monitoring
- **End-to-End Testing**: Complete test suite for the CDC pipeline

## Installation

### Install Dependencies

```bash
# Install required npm packages
npm install
```

### Create .env File

Create a `.env` file in the project root with the following content:

```
# Application Configuration
NODE_ENV=development
PORT=3000
APP_VERSION=1.0.0
LOG_LEVEL=info

# Security
JWT_SECRET=change-this-in-production
BYPASS_AUTH=true # Only for development

# Database Configuration
PG_HOST=localhost
PG_PORT=5432
PG_USER=app_user
PG_PASSWORD=app_password
PG_DATABASE=regulations

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Kafka and CDC Configuration
ENABLE_CDC=true
KAFKA_BROKER=localhost:9092
KAFKA_CONNECT_URL=http://localhost:8083
KAFKA_TOPIC_PREFIX=postgres-db-server

# Job Queue Configuration
ENABLE_WORKER=true

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3050,http://127.0.0.1:3050

# Feature Flags
ENABLE_METRICS=true
ENABLE_TELEMETRY=false
```

## Starting the System

### Start Infrastructure

```bash
# Start PostgreSQL, Kafka, Zookeeper, Debezium, and Redis
npm run docker:up
```

### Set Up Debezium Connector

```bash
# Wait for infrastructure to be ready (~30 seconds)
npm run debezium:setup
```

### Start CDC Consumer

```bash
# Start the CDC consumer
npm run start:cdc
```

### Start Job Worker

```bash
# Start the job worker
npm run start:worker
```

### Start the Application

```bash
# Start the main application
npm run start:app
```

## Testing

### Option 1: End-to-End Test

```bash
# Run the E2E test
npm run test:e2e
```

### Option 2: CDC Pipeline Test

```bash
# Run the CDC pipeline test
npm run test:cdc
```

### Option 3: Manual Testing

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

## Architecture Diagram

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ PostgreSQL │    │  Debezium  │    │   Kafka    │    │    CDC     │
│  Database  │───►│ Connector  │───►│  Message   │───►│  Consumer  │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
                                                             │
                                                             ▼
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Application│    │  Worker    │    │  BullMQ    │    │    Job     │
│    API     │◄───│  Process   │◄───│   Queue    │◄───│ Dispatcher │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

## Shutting Down

```bash
# Stop the application and components
npm run docker:down
```

## Further Documentation

See [CDC-README.md](./CDC-README.md) for more detailed information on the CDC implementation. 