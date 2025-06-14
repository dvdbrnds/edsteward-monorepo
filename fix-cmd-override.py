#!/usr/bin/env python3
import boto3
import json
from datetime import datetime

def fix_cmd_override():
    print("🔧 FIXING TASK DEFINITION CMD OVERRIDE")
    print("The current task definition has wrong CMD: /server/index.js")
    print("It should be: dist/index.js")
    print("=" * 50)
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Get current task definition
    response = ecs.describe_task_definition(taskDefinition='edsteward')
    current_task_def = response['taskDefinition']
    
    print(f"📋 Current task definition: {current_task_def['family']}:{current_task_def['revision']}")
    
    # Create new task definition with correct CMD
    new_task_def = {
        'family': current_task_def['family'],
        'executionRoleArn': current_task_def['executionRoleArn'],
        'networkMode': current_task_def['networkMode'],
        'requiresCompatibilities': current_task_def['requiresCompatibilities'],
        'cpu': current_task_def['cpu'],
        'memory': current_task_def['memory'],
        'containerDefinitions': []
    }
    
    # Copy and fix container definitions
    for container in current_task_def['containerDefinitions']:
        new_container = container.copy()
        
        # Remove the problematic CMD override
        if 'command' in new_container:
            print(f"🚨 Found CMD override: {new_container['command']}")
            del new_container['command']
            print("✅ Removed CMD override - will use Dockerfile CMD")
        
        # Ensure correct log configuration
        new_container['logConfiguration'] = {
            'logDriver': 'awslogs',
            'options': {
                'awslogs-group': '/aws/ecs/edsteward',
                'awslogs-region': 'us-east-1',
                'awslogs-stream-prefix': 'ecs'
            }
        }
        
        new_task_def['containerDefinitions'].append(new_container)
    
    # Register new task definition
    print("📋 Registering new task definition...")
    response = ecs.register_task_definition(**new_task_def)
    new_revision = response['taskDefinition']['revision']
    
    print(f"✅ Created task definition: {new_task_def['family']}:{new_revision}")
    
    # Update service
    print("📋 Updating service...")
    ecs.update_service(
        cluster='edsteward-cluster',
        service='edsteward-service',
        taskDefinition=f"{new_task_def['family']}:{new_revision}",
        forceNewDeployment=True
    )
    
    print("✅ Service updated!")
    print("⏳ Waiting for deployment...")
    
    # Wait for deployment
    import time
    for i in range(12):  # 12 * 10 = 2 minutes
        time.sleep(10)
        
        # Check service status
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        running_count = service['runningCount']
        
        print(f"   Status check {i+1}/12: Running={running_count}")
        
        if running_count > 0:
            print("🎉 Task is running!")
            break
    
    print("\n🧪 Testing application...")
    import requests
    try:
        response = requests.get('https://edsteward.ai/health', timeout=10)
        print(f"📊 Health check: {response.status_code}")
        if response.status_code == 200:
            print("🎉 APPLICATION IS NOW WORKING!")
        else:
            print("⚠️ Application starting - check again in a few minutes")
    except Exception as e:
        print(f"⚠️ Health check failed: {e}")
        print("Application may still be starting up")

if __name__ == "__main__":
    fix_cmd_override() 