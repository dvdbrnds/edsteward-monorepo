#!/usr/bin/env python3
"""
Final database fix deployment - bypasses shell issues
"""
import subprocess
import json
import time
from datetime import datetime

def run_command(cmd_args, timeout=300):
    """Run command directly"""
    try:
        result = subprocess.run(
            cmd_args,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        return result.returncode == 0, result.stdout, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

def run_aws_command(cmd_args):
    """Run AWS CLI command directly"""
    try:
        full_cmd = ['/opt/homebrew/bin/aws'] + cmd_args
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"Exception: {e}")
        return None

def final_database_fix():
    """Build and deploy final database fix"""
    print("🚀 FINAL DATABASE FIX DEPLOYMENT")
    print("=" * 40)
    
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v13.0-final-database-fix-{timestamp}"
    
    print(f"🎯 Building image: {image_tag}")
    print("📋 Current database.ts should have SSL certificate path fixes")
    
    # 1. Build Docker image
    print("\n📋 1. Building Docker image with current (fixed) code...")
    success, stdout, stderr = run_command([
        'docker', 'build', 
        '-t', f'edsteward:{image_tag}',
        '.'
    ])
    
    if not success:
        print(f"❌ Docker build failed: {stderr}")
        return
    
    print(f"✅ Docker image built: edsteward:{image_tag}")
    
    # 2. Tag for ECR
    print("\n📋 2. Tagging for ECR...")
    ecr_tag = f"259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:{image_tag}"
    success, stdout, stderr = run_command([
        'docker', 'tag', 
        f'edsteward:{image_tag}',
        ecr_tag
    ])
    
    if not success:
        print(f"❌ Docker tag failed: {stderr}")
        return
    
    print(f"✅ Tagged for ECR: {ecr_tag}")
    
    # 3. Push to ECR
    print("\n📋 3. Pushing to ECR...")
    success, stdout, stderr = run_command([
        'docker', 'push', ecr_tag
    ], timeout=600)  # 10 minutes for push
    
    if not success:
        print(f"❌ Docker push failed: {stderr}")
        return
    
    print(f"✅ Pushed to ECR: {ecr_tag}")
    
    # 4. Create new task definition
    print("\n📋 4. Creating new task definition...")
    
    # Get current task definition as template
    task_def_cmd = ['ecs', 'describe-task-definition', '--task-definition', 'edsteward:6', '--output', 'json']
    result = run_aws_command(task_def_cmd)
    
    if not result:
        print("❌ Failed to get current task definition")
        return
    
    try:
        data = json.loads(result)
        task_def = data['taskDefinition']
        
        # Create new task definition with new image
        new_task_def = {
            "family": task_def['family'],
            "networkMode": task_def['networkMode'],
            "requiresCompatibilities": task_def['requiresCompatibilities'],
            "cpu": task_def['cpu'],
            "memory": task_def['memory'],
            "executionRoleArn": task_def['executionRoleArn'],
            "taskRoleArn": task_def.get('taskRoleArn'),
            "containerDefinitions": []
        }
        
        # Update container definition with new image and correct log group
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            new_container['image'] = ecr_tag  # Use our new image
            
            # Ensure correct log configuration
            if 'logConfiguration' in new_container:
                new_container['logConfiguration']['options']['awslogs-group'] = '/aws/ecs/edsteward'
            
            new_task_def['containerDefinitions'].append(new_container)
        
        # Remove fields that shouldn't be in registration
        for field in ['taskDefinitionArn', 'revision', 'status', 'registeredAt', 'registeredBy', 'placementConstraints', 'compatibilities']:
            new_task_def.pop(field, None)
        
        # Remove None values
        new_task_def = {k: v for k, v in new_task_def.items() if v is not None}
        
        # Write task definition to temp file
        with open('/tmp/final-task-def.json', 'w') as f:
            json.dump(new_task_def, f, indent=2)
        
        # Register new task definition
        register_cmd = [
            'ecs', 'register-task-definition',
            '--cli-input-json', f'file:///tmp/final-task-def.json',
            '--output', 'json'
        ]
        
        result = run_aws_command(register_cmd)
        
        if result:
            data = json.loads(result)
            new_revision = data['taskDefinition']['revision']
            
            print(f"✅ Created new task definition: edsteward:{new_revision}")
            
            # 5. Update service
            print(f"\n📋 5. Updating service with new task definition...")
            update_cmd = [
                'ecs', 'update-service',
                '--cluster', 'edsteward-cluster',
                '--service', 'edsteward-service',
                '--task-definition', f'edsteward:{new_revision}',
                '--desired-count', '1'
            ]
            
            result = run_aws_command(update_cmd)
            if result:
                print(f"✅ Service updated with task definition edsteward:{new_revision}")
                print("⏳ Waiting 2 minutes for deployment...")
                time.sleep(120)
                
                # 6. Test the application
                print("🧪 Testing application...")
                test_cmd = [
                    'curl', '-X', 'POST',
                    'https://edsteward.ai/api/register',
                    '-H', 'Content-Type: application/json',
                    '-d', '{"username":"final-fix-test-' + str(int(time.time())) + '","password":"test123","confirmPassword":"test123"}',
                    '--max-time', '15'
                ]
                
                try:
                    test_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=20)
                    response = test_result.stdout
                    print(f"📊 API Response: {response[:400]}...")
                    
                    if 'ssl' in response.lower() or 'enoent' in response.lower() or 'rds-ca-2019-root.pem' in response:
                        print("❌ STILL seeing SSL certificate file errors")
                        print("   This suggests the Docker image wasn't built with the fixed code")
                    elif 'user' in response.lower() and ('created' in response.lower() or 'exists' in response.lower()):
                        print("🎉 SUCCESS! Database connection is working!")
                        print("✅ SSL certificate parsing issue resolved!")
                    elif '503' in response:
                        print("⏳ Service starting up - wait and test again")
                    elif '502' in response:
                        print("⚠️ Bad Gateway - container may be crashing")
                    else:
                        print("⚠️ Unexpected response - needs investigation")
                        
                except Exception as e:
                    print(f"⚠️ Could not test application: {e}")
                
                # 7. Check logs for verification
                print("\n📋 6. Checking application logs...")
                time.sleep(10)
                
                logs_cmd = [
                    'logs', 'filter-log-events',
                    '--log-group-name', '/aws/ecs/edsteward',
                    '--start-time', str(int((time.time() - 300) * 1000)),  # Last 5 minutes
                    '--output', 'json'
                ]
                
                result = run_aws_command(logs_cmd)
                if result:
                    try:
                        data = json.loads(result)
                        events = data.get('events', [])
                        
                        if events:
                            print("📊 Recent log events:")
                            for event in events[-5:]:  # Last 5 events
                                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                                message = event['message'].strip()
                                print(f"   {timestamp.strftime('%H:%M:%S')} | {message[:100]}...")
                            
                            # Check for specific errors
                            log_text = ' '.join([e['message'] for e in events]).lower()
                            if 'rds-ca-2019-root.pem' in log_text:
                                print("❌ SSL certificate file errors still present in logs")
                            elif 'database connection successful' in log_text:
                                print("✅ Database connection successful in logs!")
                            
                        else:
                            print("ℹ️ No recent log events found")
                            
                    except Exception as e:
                        print(f"Could not parse logs: {e}")
                
            else:
                print("❌ Failed to update service")
        else:
            print("❌ Failed to register new task definition")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    final_database_fix() 