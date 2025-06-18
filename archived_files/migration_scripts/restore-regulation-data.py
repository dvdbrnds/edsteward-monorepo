#!/usr/bin/env python3

import boto3
import json
import time
import sys

def create_regulation_restore_task():
    """Create ECS task to restore regulation data specifically"""
    
    # AWS clients
    ecs = boto3.client('ecs', region_name='us-east-1')
    s3 = boto3.client('s3', region_name='us-east-1')
    
    # Use existing bucket from previous successful restoration
    bucket_name = 'edsteward-temp-backup'
    backup_key = 'nosync_backup.sql'
    
    # Create bucket if it doesn't exist
    try:
        s3.head_bucket(Bucket=bucket_name)
        print(f"✅ Bucket {bucket_name} exists")
    except:
        print(f"📦 Creating bucket {bucket_name}...")
        s3.create_bucket(Bucket=bucket_name)
        print("✅ Bucket created")
    
    try:
        print("📤 Uploading backup file to S3...")
        s3.upload_file('nosync_backup.sql', bucket_name, backup_key)
        print("✅ Backup uploaded successfully")
    except Exception as e:
        print(f"⚠️  Upload warning (may already exist): {e}")
    
    # Task definition for regulation data restoration
    task_definition = {
        "family": "edsteward-regulation-restore",
        "networkMode": "awsvpc",
        "requiresCompatibilities": ["FARGATE"],
        "cpu": "1024",
        "memory": "2048",
        "executionRoleArn": "arn:aws:iam::259661441422:role/ecsTaskExecutionRole",
        "containerDefinitions": [
            {
                "name": "regulation-restore-container",
                "image": "postgres:16",
                "essential": True,
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group": "/ecs/edsteward-regulation-restore",
                        "awslogs-region": "us-east-1",
                        "awslogs-stream-prefix": "ecs"
                    }
                },
                "environment": [
                    {"name": "PGPASSWORD", "value": "EdSteward2024!Secure"},
                    {"name": "AWS_DEFAULT_REGION", "value": "us-east-1"}
                ],
                "command": [
                    "/bin/bash",
                    "-c",
                    f"""
                    echo "🔄 Starting regulation data restoration..."
                    
                    # Install AWS CLI
                    apt-get update && apt-get install -y awscli curl
                    
                    # Download backup from S3
                    echo "📥 Downloading backup from S3..."
                    aws s3 cp s3://{bucket_name}/{backup_key} /tmp/backup.sql --no-sign-request
                    
                    # Database connection details
                    DB_HOST="edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
                    DB_USER="postgres"
                    DB_NAME="postgres"
                    
                    echo "🔍 Checking current regulation count..."
                    CURRENT_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM regulations;" 2>/dev/null || echo "0")
                    echo "Current regulations in database: $CURRENT_COUNT"
                    
                    if [ "$CURRENT_COUNT" -gt "0" ]; then
                        echo "⚠️  Regulations already exist. Clearing table first..."
                        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE regulations RESTART IDENTITY CASCADE;"
                        echo "✅ Regulations table cleared"
                    fi
                    
                    echo "📊 Restoring regulation data..."
                    
                    # Extract and restore only regulation data
                    grep -A 10000 "COPY public.regulations" /tmp/backup.sql | sed '/^\\\\\\./q' > /tmp/regulations_only.sql
                    
                    # Restore the regulation data
                    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f /tmp/regulations_only.sql
                    
                    # Verify restoration
                    echo "🔍 Verifying regulation restoration..."
                    FINAL_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM regulations;")
                    echo "Final regulation count: $FINAL_COUNT"
                    
                    # Show sample regulations
                    echo "📋 Sample regulations restored:"
                    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT id, name, category, jurisdiction FROM regulations LIMIT 5;"
                    
                    echo "✅ Regulation data restoration complete!"
                    echo "📊 Total regulations restored: $FINAL_COUNT"
                    """
                ]
            }
        ]
    }
    
    # Create CloudWatch log group if it doesn't exist
    try:
        logs = boto3.client('logs', region_name='us-east-1')
        logs.create_log_group(logGroupName='/ecs/edsteward-regulation-restore')
        print("✅ CloudWatch log group created")
    except Exception as e:
        if 'ResourceAlreadyExistsException' in str(e):
            print("✅ CloudWatch log group already exists")
        else:
            print(f"⚠️  Log group warning: {e}")
    
    try:
        print("📝 Creating task definition...")
        response = ecs.register_task_definition(**task_definition)
        task_def_arn = response['taskDefinition']['taskDefinitionArn']
        print(f"✅ Task definition created: {task_def_arn}")
        
        # Run the task
        print("🚀 Starting regulation restoration task...")
        run_response = ecs.run_task(
            cluster='edsteward-cluster',
            taskDefinition=task_def_arn,
            launchType='FARGATE',
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': [
                        'subnet-0454e60b7de1d53ec',
                        'subnet-033c10e26a9264deb'
                    ],
                    'securityGroups': ['sg-06cc3f04176c6adcb'],
                    'assignPublicIp': 'ENABLED'
                }
            }
        )
        
        task_arn = run_response['tasks'][0]['taskArn']
        task_id = task_arn.split('/')[-1]
        
        print(f"✅ Task started: {task_id}")
        print(f"📊 Task ARN: {task_arn}")
        
        # Monitor task
        print("⏳ Monitoring task progress...")
        while True:
            response = ecs.describe_tasks(
                cluster='edsteward-cluster',
                tasks=[task_arn]
            )
            
            if not response['tasks']:
                print("❌ Task not found")
                break
                
            task = response['tasks'][0]
            status = task['lastStatus']
            
            print(f"📊 Task status: {status}")
            
            if status in ['STOPPED']:
                exit_code = task['containers'][0].get('exitCode', 'unknown')
                print(f"🏁 Task completed with exit code: {exit_code}")
                
                # Show logs location
                print(f"📋 Check logs at: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/%2Fecs%2Fedsteward-regulation-restore")
                break
            elif status == 'RUNNING':
                print("🔄 Task is running... (check CloudWatch logs for progress)")
                
            time.sleep(30)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

def test_regulation_endpoint():
    """Test the regulations endpoint after restoration"""
    import requests
    
    try:
        print("\n🧪 Testing regulations endpoint...")
        
        # Test the regulations API
        url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations"
        
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                print(f"✅ Regulations endpoint working! Found {len(data)} regulations")
                print(f"📋 Sample regulation: {data[0].get('name', 'Unknown')}")
                return True
            else:
                print("⚠️  Endpoint working but no regulations found")
                return False
        else:
            print(f"❌ Endpoint returned status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing endpoint: {e}")
        return False

if __name__ == "__main__":
    print("🎯 EdSteward Regulation Data Restoration")
    print("=" * 50)
    
    # Run the restoration
    if create_regulation_restore_task():
        print("\n⏳ Waiting for restoration to complete...")
        time.sleep(60)  # Give it time to complete
        
        # Test the endpoint
        test_regulation_endpoint()
        
        print("\n🎉 Regulation restoration process completed!")
        print("🌐 Check your application at: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
    else:
        print("❌ Restoration failed")
        sys.exit(1) 