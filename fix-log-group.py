#!/usr/bin/env python3
"""
Fix ECS task definition with correct log group - bypasses shell issues
"""
import subprocess
import json
import time

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

def fix_log_group():
    """Fix task definition with correct log group"""
    print("🔧 FIXING TASK DEFINITION WITH CORRECT LOG GROUP")
    print("=" * 50)
    
    print("🎯 Target Log Group: /aws/ecs/edsteward")
    
    # Get current task definition
    print("\n📋 1. Getting current task definition...")
    task_def_cmd = ['ecs', 'describe-task-definition', '--task-definition', 'edsteward:5', '--output', 'json']
    result = run_aws_command(task_def_cmd)
    
    if not result:
        print("❌ Failed to get task definition")
        return
    
    try:
        data = json.loads(result)
        task_def = data['taskDefinition']
        
        print(f"   Current Log Group: {task_def['containerDefinitions'][0]['logConfiguration']['options']['awslogs-group']}")
        
        # Create new task definition with correct log group
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
        
        # Update container definition with correct log group
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            
            # Fix the log configuration
            if 'logConfiguration' in new_container:
                new_container['logConfiguration']['options']['awslogs-group'] = '/aws/ecs/edsteward'
            
            new_task_def['containerDefinitions'].append(new_container)
        
        # Remove fields that shouldn't be in registration
        for field in ['taskDefinitionArn', 'revision', 'status', 'registeredAt', 'registeredBy', 'placementConstraints', 'compatibilities']:
            new_task_def.pop(field, None)
        
        # Remove None values
        new_task_def = {k: v for k, v in new_task_def.items() if v is not None}
        
        print("\n📋 2. Registering new task definition with correct log group...")
        
        # Write task definition to temp file
        with open('/tmp/task-def-log-fix.json', 'w') as f:
            json.dump(new_task_def, f, indent=2)
        
        # Register new task definition
        register_cmd = [
            'ecs', 'register-task-definition',
            '--cli-input-json', f'file:///tmp/task-def-log-fix.json',
            '--output', 'json'
        ]
        
        result = run_aws_command(register_cmd)
        
        if result:
            data = json.loads(result)
            new_revision = data['taskDefinition']['revision']
            
            print(f"✅ Created new task definition: edsteward:{new_revision}")
            
            # Update service with new task definition
            print(f"\n📋 3. Updating service with new task definition...")
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
                print("⏳ Waiting 90 seconds for deployment...")
                time.sleep(90)
                
                # Test the application
                print("🧪 Testing application...")
                test_cmd = [
                    'curl', '-X', 'POST',
                    'https://edsteward.ai/api/register',
                    '-H', 'Content-Type: application/json',
                    '-d', '{"username":"log-fix-test-' + str(int(time.time())) + '","password":"test123","confirmPassword":"test123"}',
                    '--max-time', '10'
                ]
                
                try:
                    test_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=15)
                    response = test_result.stdout
                    print(f"📊 API Response: {response[:300]}...")
                    
                    if 'ssl' in response.lower() or 'enoent' in response.lower():
                        print("❌ Still seeing SSL/file errors")
                    elif 'user' in response.lower() or 'success' in response.lower():
                        print("🎉 SUCCESS! Application is working!")
                    elif '503' in response:
                        print("⏳ Service starting up - check again in a few minutes")
                    elif '502' in response:
                        print("⚠️ Bad Gateway - container may be crashing, check logs")
                    else:
                        print("⚠️ Check the response above")
                        
                except Exception as e:
                    print(f"⚠️ Could not test application: {e}")
                
            else:
                print("❌ Failed to update service")
        else:
            print("❌ Failed to register new task definition")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_log_group() 