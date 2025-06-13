#!/usr/bin/env python3
"""
Check current infrastructure status
"""
import subprocess
import json

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

def check_infrastructure():
    """Check current infrastructure status"""
    print("🔍 CHECKING CURRENT INFRASTRUCTURE STATUS")
    print("=" * 50)
    
    # Check ECS service
    print("\n📋 1. ECS Service Status...")
    service_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
    result = run_aws_command(service_cmd)
    
    if result:
        try:
            data = json.loads(result)
            service = data['services'][0]
            
            print(f"   Service Status: {service['status']}")
            print(f"   Running Count: {service['runningCount']}")
            print(f"   Desired Count: {service['desiredCount']}")
            print(f"   Task Definition: {service['taskDefinition']}")
            print(f"   Platform Version: {service.get('platformVersion', 'N/A')}")
            
            # Check for deployment
            if 'deployments' in service:
                for deployment in service['deployments']:
                    print(f"   Deployment Status: {deployment['status']}")
                    print(f"   Deployment Running: {deployment['runningCount']}")
                    
        except Exception as e:
            print(f"   Error parsing service data: {e}")
    
    # Check tasks
    print("\n📋 2. ECS Tasks...")
    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
    result = run_aws_command(tasks_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_arns = data.get('taskArns', [])
            print(f"   Number of tasks: {len(task_arns)}")
            
            if task_arns:
                # Get task details
                task_details_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + task_arns + ['--output', 'json']
                task_result = run_aws_command(task_details_cmd)
                
                if task_result:
                    task_data = json.loads(task_result)
                    for task in task_data.get('tasks', []):
                        print(f"   Task Status: {task['lastStatus']}")
                        print(f"   Health Status: {task.get('healthStatus', 'N/A')}")
                        print(f"   Connectivity: {task.get('connectivity', 'N/A')}")
                        
                        # Check for stopped reason
                        if 'stoppedReason' in task:
                            print(f"   Stopped Reason: {task['stoppedReason']}")
                        
                        # Check container statuses
                        for container in task.get('containers', []):
                            print(f"   Container {container['name']}: {container['lastStatus']}")
                            if 'reason' in container:
                                print(f"     Reason: {container['reason']}")
            else:
                print("   No tasks found")
                
        except Exception as e:
            print(f"   Error checking tasks: {e}")
    
    # Quick connectivity test
    print("\n📋 3. Quick Connectivity Test...")
    try:
        test_result = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'https://edsteward.ai/api/health', '--max-time', '5'],
            capture_output=True,
            text=True,
            timeout=10
        )
        print(f"   API Health Check: HTTP {test_result.stdout}")
    except Exception as e:
        print(f"   API Health Check failed: {e}")

if __name__ == "__main__":
    check_infrastructure() 