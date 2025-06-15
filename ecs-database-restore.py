#!/usr/bin/env python3
"""
ECS Database Restoration
========================

Since RDS is in private subnets, we'll use ECS (same VPC) to restore the database.
This runs a one-time ECS task that can access the RDS from within the VPC.
"""

import subprocess
import json
import time
import base64
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_cmd(command):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    log("🚀 ECS DATABASE RESTORATION")
    log("=" * 50)
    
    # Step 1: Upload backup to S3
    log("📍 STEP 1: Uploading backup to S3...")
    
    bucket_name = "edsteward-temp-backup"
    
    # Create S3 bucket
    success, _, error = run_cmd(f'aws s3 mb s3://{bucket_name} --region us-east-1')
    
    if success or "already exists" in error.lower():
        log(f"✅ S3 bucket ready: {bucket_name}")
        
        # Upload backup file
        success, _, error = run_cmd(f'aws s3 cp nosync_backup.sql s3://{bucket_name}/nosync_backup.sql')
        
        if success:
            log("✅ Backup uploaded to S3")
        else:
            log(f"❌ Failed to upload backup: {error}")
            return False
    else:
        log(f"❌ Failed to create S3 bucket: {error}")
        return False
    
    # Step 2: Get existing ECS configuration
    log("\n📍 STEP 2: Getting ECS configuration...")
    
    success, service_output, _ = run_cmd('aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --output json')
    
    if not success:
        log("❌ Failed to get ECS service details")
        return False
    
    service_data = json.loads(service_output)
    service = service_data['services'][0]
    network_config = service['networkConfiguration']['awsvpcConfiguration']
    
    log(f"✅ Found network config: {len(network_config['subnets'])} subnets, {len(network_config['securityGroups'])} security groups")
    
    # Step 3: Create database restoration task definition
    log("\n📍 STEP 3: Creating restoration task definition...")
    
    # Get current task definition for reference
    success, task_output, _ = run_cmd('aws ecs describe-task-definition --task-definition edsteward-task --output json')
    
    if success:
        task_data = json.loads(task_output)
        current_task = task_data['taskDefinition']
        
        # Create restoration task definition
        restoration_task_def = {
            'family': 'edsteward-db-restore',
            'networkMode': 'awsvpc',
            'requiresCompatibilities': ['FARGATE'],
            'cpu': '1024',
            'memory': '2048',
            'executionRoleArn': current_task['executionRoleArn'],
            'containerDefinitions': [
                {
                    'name': 'db-restore-container',
                    'image': 'postgres:16',
                    'memory': 2048,
                    'cpu': 1024,
                    'essential': True,
                    'logConfiguration': {
                        'logDriver': 'awslogs',
                        'options': {
                            'awslogs-group': '/ecs/edsteward',
                            'awslogs-region': 'us-east-1',
                            'awslogs-stream-prefix': 'db-restore'
                        }
                    },
                    'environment': [
                        {'name': 'PGPASSWORD', 'value': 'EdSteward2024!Secure'},
                        {'name': 'PGHOST', 'value': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com'},
                        {'name': 'PGPORT', 'value': '5432'},
                        {'name': 'PGUSER', 'value': 'postgres'},
                        {'name': 'PGDATABASE', 'value': 'postgres'},
                        {'name': 'AWS_DEFAULT_REGION', 'value': 'us-east-1'}
                    ],
                    'command': [
                        '/bin/bash',
                        '-c',
                        f'''
                        echo "🔧 Starting database restoration from ECS..."
                        
                        # Install AWS CLI
                        apt-get update && apt-get install -y awscli
                        
                        # Download backup file from S3
                        echo "📥 Downloading backup file..."
                        aws s3 cp s3://{bucket_name}/nosync_backup.sql /tmp/nosync_backup.sql
                        
                        if [ ! -f /tmp/nosync_backup.sql ]; then
                            echo "❌ Failed to download backup file"
                            exit 1
                        fi
                        
                        echo "✅ Backup file downloaded ($(wc -l < /tmp/nosync_backup.sql) lines)"
                        
                        # Test connection first
                        echo "📡 Testing database connection..."
                        psql -c "SELECT version();" || exit 1
                        
                        echo "✅ Database connection successful"
                        
                        # Run the restoration
                        echo "📋 Starting database restoration..."
                        psql < /tmp/nosync_backup.sql
                        
                        if [ $? -eq 0 ]; then
                            echo "🎉 DATABASE RESTORATION COMPLETED SUCCESSFULLY!"
                            
                            # Verify the restoration
                            echo "🧪 Verifying restored data..."
                            psql -c "SELECT 'Users:' as table_name, count(*) as record_count FROM users;"
                            psql -c "SELECT id, username, role FROM users LIMIT 3;"
                            
                            echo "✅ Database restoration verification complete!"
                        else
                            echo "❌ Database restoration failed!"
                            exit 1
                        fi
                        '''
                    ]
                }
            ]
        }
        
        # Add taskRoleArn if it exists
        if 'taskRoleArn' in current_task:
            restoration_task_def['taskRoleArn'] = current_task['taskRoleArn']
        
        # Register the restoration task definition
        log("📝 Registering database restoration task definition...")
        
        # Write task definition to file for debugging
        with open('/tmp/restore_task_def.json', 'w') as f:
            json.dump(restoration_task_def, f, indent=2)
        
        success, register_output, error = run_cmd('aws ecs register-task-definition --cli-input-json file:///tmp/restore_task_def.json --output json')
        
        if success:
            register_data = json.loads(register_output)
            restoration_task_arn = register_data['taskDefinition']['taskDefinitionArn']
            log(f"✅ Restoration task definition: {restoration_task_arn}")
        else:
            log(f"❌ Failed to register task definition: {error}")
            return False
    else:
        log("❌ Failed to get current task definition")
        return False
    
    # Step 4: Run the restoration task
    log("\n📍 STEP 4: Running database restoration task...")
    
    run_task_config = {
        'cluster': 'edsteward-cluster',
        'taskDefinition': restoration_task_arn,
        'launchType': 'FARGATE',
        'networkConfiguration': {
            'awsvpcConfiguration': network_config
        }
    }
    
    # Write run task config to file
    with open('/tmp/run_task_config.json', 'w') as f:
        json.dump(run_task_config, f, indent=2)
    
    success, run_output, error = run_cmd('aws ecs run-task --cli-input-json file:///tmp/run_task_config.json --output json')
    
    if success:
        run_data = json.loads(run_output)
        task_arn = run_data['tasks'][0]['taskArn']
        log(f"✅ Restoration task started: {task_arn}")
        
        # Step 5: Wait for task completion
        log("\n📍 STEP 5: Waiting for restoration to complete...")
        
        max_wait_time = 600  # 10 minutes
        start_time = time.time()
        
        while (time.time() - start_time) < max_wait_time:
            success, describe_output, _ = run_cmd(f'aws ecs describe-tasks --cluster edsteward-cluster --tasks {task_arn} --output json')
            
            if success:
                describe_data = json.loads(describe_output)
                task = describe_data['tasks'][0]
                last_status = task['lastStatus']
                
                log(f"📋 Task status: {last_status}")
                
                if last_status == 'STOPPED':
                    exit_code = task['containers'][0].get('exitCode', 1)
                    
                    if exit_code == 0:
                        log("🎉 DATABASE RESTORATION COMPLETED SUCCESSFULLY!")
                        
                        # Step 6: Get task logs
                        log("\n📍 STEP 6: Getting restoration logs...")
                        
                        # Get log stream name
                        task_id = task_arn.split('/')[-1]
                        log_stream = f"db-restore/{task_id}"
                        
                        success, logs_output, _ = run_cmd(f'aws logs get-log-events --log-group-name /ecs/edsteward --log-stream-name {log_stream} --output json')
                        
                        if success:
                            logs_data = json.loads(logs_output)
                            log("📋 Restoration logs:")
                            for event in logs_data['events'][-20:]:  # Last 20 log entries
                                print(f"   {event['message']}")
                        
                        # Step 7: Cleanup
                        log("\n📍 STEP 7: Cleaning up...")
                        
                        # Delete S3 bucket
                        run_cmd(f'aws s3 rm s3://{bucket_name}/nosync_backup.sql')
                        run_cmd(f'aws s3 rb s3://{bucket_name}')
                        log("✅ Cleaned up S3 bucket")
                        
                        # Clean up temp files
                        run_cmd('rm -f /tmp/restore_task_def.json /tmp/run_task_config.json')
                        
                        log("\n🎊 DATABASE RESTORATION SUCCESSFUL!")
                        log("Your RegulatoryTrackr application should now have:")
                        log("✅ All user accounts restored")
                        log("✅ Database schema recreated")
                        log("✅ Login functionality working")
                        log("✅ Frontend can connect to database")
                        
                        return True
                    else:
                        log(f"❌ Database restoration failed with exit code: {exit_code}")
                        return False
                
                elif last_status == 'RUNNING':
                    log("🔄 Database restoration in progress...")
            
            time.sleep(15)
        
        log("⚠️ Task timeout - restoration may still be running")
        return False
        
    else:
        log(f"❌ Failed to start restoration task: {error}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 SUCCESS! Your database has been restored!")
        print("Your frontend connectivity issues should now be resolved!")
    else:
        print("\n❌ Database restoration failed. Check the logs above.") 