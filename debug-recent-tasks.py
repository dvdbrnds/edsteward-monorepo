#!/usr/bin/env python3
"""
Debug recent ECS task failures - bypasses shell issues
"""
import subprocess
import json
from datetime import datetime

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

def debug_recent_tasks():
    """Debug recent ECS task failures"""
    print("🔧 DEBUGGING RECENT ECS TASK FAILURES")
    print("=" * 45)
    
    # Get all recent tasks (both running and stopped)
    print("📋 1. Getting all recent tasks...")
    all_tasks_cmd = [
        'ecs', 'list-tasks',
        '--cluster', 'edsteward-cluster',
        '--max-items', '10',
        '--output', 'json'
    ]
    result = run_aws_command(all_tasks_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_arns = data['taskArns']
            
            if task_arns:
                print(f"   Found {len(task_arns)} recent tasks")
                
                # Describe all recent tasks
                describe_cmd = [
                    'ecs', 'describe-tasks',
                    '--cluster', 'edsteward-cluster',
                    '--tasks'
                ] + task_arns + ['--output', 'json']
                
                task_result = run_aws_command(describe_cmd)
                if task_result:
                    task_data = json.loads(task_result)
                    
                    print("\n📊 TASK ANALYSIS:")
                    print("-" * 50)
                    
                    for i, task in enumerate(task_data['tasks']):
                        task_id = task['taskArn'].split('/')[-1][:12]
                        created_at = task.get('createdAt', 'Unknown')
                        
                        print(f"\nTask {i+1}: {task_id}")
                        print(f"  Created: {created_at}")
                        print(f"  Status: {task.get('lastStatus', 'Unknown')}")
                        print(f"  Desired: {task.get('desiredStatus', 'Unknown')}")
                        
                        # Task definition
                        task_def = task.get('taskDefinitionArn', 'Unknown')
                        if 'edsteward:' in task_def:
                            revision = task_def.split('edsteward:')[-1].split(' ')[0]
                            print(f"  Task Definition: edsteward:{revision}")
                        
                        # Stop information
                        if 'stoppedAt' in task:
                            print(f"  Stopped: {task['stoppedAt']}")
                        if 'stoppedReason' in task:
                            print(f"  Stop Reason: {task['stoppedReason']}")
                        
                        # Container information
                        containers = task.get('containers', [])
                        for container in containers:
                            print(f"  Container: {container['name']}")
                            if 'exitCode' in container:
                                print(f"    Exit Code: {container['exitCode']}")
                            if 'reason' in container:
                                print(f"    Reason: {container['reason']}")
                            if 'runtimeId' in container:
                                print(f"    Runtime ID: {container['runtimeId'][:12]}...")
                        
                        # Health status
                        if 'healthStatus' in task:
                            print(f"  Health: {task['healthStatus']}")
                        
                        print("-" * 30)
                        
            else:
                print("   No recent tasks found")
                
        except Exception as e:
            print(f"   Error checking recent tasks: {e}")
    
    # Also check stopped tasks specifically
    print("\n📋 2. Getting stopped tasks specifically...")
    stopped_tasks_cmd = [
        'ecs', 'list-tasks',
        '--cluster', 'edsteward-cluster',
        '--desired-status', 'STOPPED',
        '--max-items', '5',
        '--output', 'json'
    ]
    result = run_aws_command(stopped_tasks_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_arns = data['taskArns']
            
            if task_arns:
                print(f"   Found {len(task_arns)} stopped tasks")
                
                # Get details for stopped tasks
                describe_cmd = [
                    'ecs', 'describe-tasks',
                    '--cluster', 'edsteward-cluster',
                    '--tasks'
                ] + task_arns[:3] + ['--output', 'json']  # Check last 3
                
                task_result = run_aws_command(describe_cmd)
                if task_result:
                    task_data = json.loads(task_result)
                    
                    print("\n📊 STOPPED TASK DETAILS:")
                    print("-" * 50)
                    
                    for task in task_data['tasks']:
                        task_id = task['taskArn'].split('/')[-1][:12]
                        
                        print(f"\nStopped Task: {task_id}")
                        
                        # Task definition
                        task_def = task.get('taskDefinitionArn', 'Unknown')
                        if 'edsteward:' in task_def:
                            revision = task_def.split('edsteward:')[-1].split(' ')[0]
                            print(f"  Task Definition: edsteward:{revision}")
                        
                        # Timing
                        if 'createdAt' in task:
                            print(f"  Created: {task['createdAt']}")
                        if 'startedAt' in task:
                            print(f"  Started: {task['startedAt']}")
                        if 'stoppedAt' in task:
                            print(f"  Stopped: {task['stoppedAt']}")
                        
                        # Stop reason
                        if 'stoppedReason' in task:
                            print(f"  Stop Reason: {task['stoppedReason']}")
                        
                        # Container details
                        containers = task.get('containers', [])
                        for container in containers:
                            print(f"  Container '{container['name']}':")
                            if 'exitCode' in container:
                                print(f"    Exit Code: {container['exitCode']}")
                            if 'reason' in container:
                                print(f"    Reason: {container['reason']}")
                            
                            # Network bindings
                            if 'networkBindings' in container:
                                bindings = container['networkBindings']
                                if bindings:
                                    print(f"    Network: {bindings}")
                            
                            # Runtime info
                            if 'runtimeId' in container:
                                print(f"    Runtime: {container['runtimeId'][:20]}...")
                        
                        print("-" * 30)
                        
            else:
                print("   No stopped tasks found")
                
        except Exception as e:
            print(f"   Error checking stopped tasks: {e}")
    
    # Check the current service status for more details
    print("\n📋 3. Checking service events...")
    service_cmd = [
        'ecs', 'describe-services',
        '--cluster', 'edsteward-cluster',
        '--services', 'edsteward-service',
        '--output', 'json'
    ]
    result = run_aws_command(service_cmd)
    
    if result:
        try:
            data = json.loads(result)
            service = data['services'][0]
            
            # Service events
            events = service.get('events', [])
            if events:
                print("   Recent service events:")
                for event in events[:5]:  # Last 5 events
                    created_at = event.get('createdAt', 'Unknown')
                    message = event.get('message', 'No message')
                    print(f"     {created_at}: {message}")
            else:
                print("   No service events found")
                
        except Exception as e:
            print(f"   Error checking service events: {e}")

if __name__ == "__main__":
    debug_recent_tasks() 