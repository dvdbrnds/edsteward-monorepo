#!/usr/bin/env python3
"""
Check why ECS task is failing to start
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
            timeout=30
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"Exception: {e}")
        return None

def check_task_failure():
    """Check why tasks are failing"""
    print("🔍 DIAGNOSING TASK FAILURE")
    print("=" * 50)
    
    # Get all tasks (including stopped ones)
    print("\n📋 1. Getting all recent tasks...")
    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--desired-status', 'STOPPED', '--output', 'json']
    result = run_aws_command(tasks_cmd)
    
    stopped_tasks = []
    if result:
        try:
            data = json.loads(result)
            stopped_tasks = data.get('taskArns', [])
            print(f"   Found {len(stopped_tasks)} stopped tasks")
        except Exception as e:
            print(f"   Error: {e}")
    
    # Get running/pending tasks
    running_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--desired-status', 'RUNNING', '--output', 'json']
    result = run_aws_command(running_cmd)
    
    running_tasks = []
    if result:
        try:
            data = json.loads(result)
            running_tasks = data.get('taskArns', [])
            print(f"   Found {len(running_tasks)} running/pending tasks")
        except Exception as e:
            print(f"   Error: {e}")
    
    # Check the most recent tasks
    all_tasks = stopped_tasks[-3:] + running_tasks  # Last 3 stopped + all running
    
    if all_tasks:
        print(f"\n📋 2. Checking details of {len(all_tasks)} recent tasks...")
        
        for i, task_arn in enumerate(all_tasks):
            print(f"\n   Task {i+1}: {task_arn.split('/')[-1]}")
            
            task_details_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks', task_arn, '--output', 'json']
            task_result = run_aws_command(task_details_cmd)
            
            if task_result:
                try:
                    task_data = json.loads(task_result)
                    task = task_data['tasks'][0]
                    
                    print(f"     Status: {task['lastStatus']}")
                    print(f"     Created: {task.get('createdAt', 'N/A')}")
                    print(f"     Started: {task.get('startedAt', 'N/A')}")
                    print(f"     Stopped: {task.get('stoppedAt', 'N/A')}")
                    
                    if 'stoppedReason' in task:
                        print(f"     Stopped Reason: {task['stoppedReason']}")
                    
                    if 'stopCode' in task:
                        print(f"     Stop Code: {task['stopCode']}")
                    
                    # Check containers
                    for container in task.get('containers', []):
                        print(f"     Container {container['name']}: {container['lastStatus']}")
                        if 'reason' in container:
                            print(f"       Reason: {container['reason']}")
                        if 'exitCode' in container:
                            print(f"       Exit Code: {container['exitCode']}")
                    
                    # Check for task definition details
                    task_def_arn = task['taskDefinitionArn']
                    print(f"     Task Definition: {task_def_arn.split('/')[-1]}")
                    
                except Exception as e:
                    print(f"     Error parsing task: {e}")
    
    # Check service events
    print("\n📋 3. Recent Service Events...")
    service_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
    result = run_aws_command(service_cmd)
    
    if result:
        try:
            data = json.loads(result)
            service = data['services'][0]
            
            events = service.get('events', [])[:5]  # Last 5 events
            for event in events:
                print(f"   {event['createdAt']}: {event['message']}")
                
        except Exception as e:
            print(f"   Error checking events: {e}")
    
    # Check network configuration
    print("\n📋 4. Network Configuration...")
    if result:
        try:
            data = json.loads(result)
            service = data['services'][0]
            
            network_config = service.get('networkConfiguration', {}).get('awsvpcConfiguration', {})
            print(f"   Subnets: {network_config.get('subnets', [])}")
            print(f"   Security Groups: {network_config.get('securityGroups', [])}")
            print(f"   Public IP: {network_config.get('assignPublicIp', 'DISABLED')}")
            
        except Exception as e:
            print(f"   Error checking network: {e}")

if __name__ == "__main__":
    check_task_failure() 