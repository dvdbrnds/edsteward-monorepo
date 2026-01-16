# Fix RDS Authentication Issue

## Problem
The RDS instance is rejecting connections from ECS with error:
```
no pg_hba.conf entry for host "10.0.10.137", user "postgres", database "edsteward", no encryption
```

## Root Cause
RDS `pg_hba.conf` is not configured to allow non-SSL connections from the ECS subnet (10.0.0.0/16).

## Solution Options

### Option 1: Enable SSL in Task Definition (Recommended)
Update the DATABASE_URL in your task definition to use SSL:

```json
{
  "name": "DATABASE_URL",
  "value": "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require"
}
```

### Option 2: Configure RDS to Allow Non-SSL Connections
Create a custom DB parameter group and modify pg_hba.conf settings.

## Immediate Fix Steps

### Step 1: Update Task Definition
Replace `sslmode=disable` with `sslmode=require` in the DATABASE_URL.

### Step 2: Update RDS Security Group
Ensure the RDS security group allows connections from the ECS security group on port 5432.

### Step 3: Test Connection
Use the test script to verify the connection works.

## AWS Console Steps

### Update Task Definition
1. Go to ECS Console
2. Navigate to Task Definitions
3. Select `edsteward-task`
4. Create new revision
5. Update DATABASE_URL environment variable:
   - Remove `sslmode=disable`
   - Add `sslmode=require`
6. Register new task definition
7. Update ECS service to use new task definition

### Verify Security Groups
1. Go to RDS Console  
2. Select your RDS instance
3. Check security groups
4. Ensure inbound rule allows port 5432 from ECS security group

## Command Line Fix (Alternative)

If you have AWS CLI configured:

```bash
# Create new task definition with SSL enabled
aws ecs register-task-definition --cli-input-json file://ssl-task-def.json

# Update ECS service
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:52
``` 