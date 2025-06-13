#!/usr/bin/env python3
"""
Debug ECS deployment issues - bypasses shell issues
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

def debug_ecs():
    """Debug ECS deployment issues"""
    print("🔧 DEBUGGING ECS DEPLOYMENT ISSUES")
    print("=" * 40)
    
    # 1. Check available log groups
    print("📋 1. Checking available log groups...")
    logs_cmd = ['logs', 'describe-log-groups', '--output', 'json']
    result = run_aws_command(logs_cmd)
    
    if result:
        try:
            data = json.loads(result)
            log_groups = [lg['logGroupName'] for lg in data['logGroups']]
            ecs_logs = [lg for lg in log_groups if 'ecs' in lg.lower() or 'edsteward' in lg.lower()]
            
            print(f"   Found {len(log_groups)} total log groups")
            print(f"   ECS-related log groups: {ecs_logs}")
            
            if not ecs_logs:
                print("   ❌ No ECS log groups found - containers never started successfully")
            
        except Exception as e:
            print(f"   Error parsing log groups: {e}")
    
    # 2. Check task definition details
    print("\n📋 2. Checking task definition edsteward:4...")
    task_def_cmd = ['ecs', 'describe-task-definition', '--task-definition', 'edsteward:4', '--output', 'json']
    result = run_aws_command(task_def_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_def = data['taskDefinition']
            
            print(f"   Status: {task_def['status']}")
            print(f"   CPU: {task_def['cpu']}")
            print(f"   Memory: {task_def['memory']}")
            print(f"   Network Mode: {task_def.get('networkMode', 'N/A')}")
            print(f"   Requires Attributes: {len(task_def.get('requiresAttributes', []))}")
            
            # Check container definitions
            containers = task_def['containerDefinitions']
            for container in containers:
                print(f"   Container: {container['name']}")
                print(f"     Image: {container['image']}")
                print(f"     Memory: {container.get('memory', 'N/A')}")
                print(f"     CPU: {container.get('cpu', 'N/A')}")
                
                # Check log configuration
                log_config = container.get('logConfiguration', {})
                if log_config:
                    print(f"     Log Driver: {log_config.get('logDriver', 'N/A')}")
                    log_group = log_config.get('options', {}).get('awslogs-group', 'N/A')
                    print(f"     Log Group: {log_group}")
                else:
                    print("     ❌ No log configuration - this could be the problem!")
            
        except Exception as e:
            print(f"   Error parsing task definition: {e}")
    
    # 3. Check recent task failures
    print("\n📋 3. Checking recent tasks...")
    list_tasks_cmd = [
        'ecs', 'list-tasks',
        '--cluster', 'edsteward-cluster',
        '--service-name', 'edsteward-service',
        '--output', 'json'
    ]
    result = run_aws_command(list_tasks_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_arns = data['taskArns']
            
            if task_arns:
                print(f"   Found {len(task_arns)} current tasks")
                
                # Describe the tasks
                describe_cmd = [
                    'ecs', 'describe-tasks',
                    '--cluster', 'edsteward-cluster',
                    '--tasks'
                ] + task_arns + ['--output', 'json']
                
                task_result = run_aws_command(describe_cmd)
                if task_result:
                    task_data = json.loads(task_result)
                    for task in task_data['tasks']:
                        print(f"   Task: {task['taskArn'].split('/')[-1]}")
                        print(f"     Status: {task['lastStatus']}")
                        print(f"     Desired: {task['desiredStatus']}")
                        print(f"     Health: {task.get('healthStatus', 'N/A')}")
                        
                        if 'stoppedReason' in task:
                            print(f"     ❌ Stopped Reason: {task['stoppedReason']}")
                        
            else:
                print("   No current tasks found")
                
        except Exception as e:
            print(f"   Error checking tasks: {e}")
    
    # 4. Check recent stopped tasks
    print("\n📋 4. Checking stopped tasks (last failures)...")
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
                print(f"   Found {len(task_arns)} recent stopped tasks")
                
                # Describe the stopped tasks
                describe_cmd = [
                    'ecs', 'describe-tasks',
                    '--cluster', 'edsteward-cluster',
                    '--tasks'
                ] + task_arns[:3] + ['--output', 'json']  # Check last 3
                
                task_result = run_aws_command(describe_cmd)
                if task_result:
                    task_data = json.loads(task_result)
                    for task in task_data['tasks']:
                        print(f"   Task: {task['taskArn'].split('/')[-1]}")
                        print(f"     Status: {task['lastStatus']}")
                        if 'stoppedReason' in task:
                            print(f"     ❌ Stop Reason: {task['stoppedReason']}")
                        if 'stoppedAt' in task:
                            print(f"     Stopped At: {task['stoppedAt']}")
                        
                        # Check container exit codes
                        for container in task.get('containers', []):
                            if 'exitCode' in container:
                                print(f"     Container {container['name']}: Exit Code {container['exitCode']}")
                                if 'reason' in container:
                                    print(f"       Reason: {container['reason']}")
                        print()
            else:
                print("   No stopped tasks found")
                
        except Exception as e:
            print(f"   Error checking stopped tasks: {e}")

if __name__ == "__main__":
    debug_ecs() 