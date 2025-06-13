#!/usr/bin/env python3
"""
Check ECS task status and network configuration
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

def check_ecs_status():
    """Check ECS task status"""
    print("📦 CHECKING ECS TASK STATUS")
    print("=" * 30)
    
    # 1. Check service status
    print("\n📋 1. ECS Service Status:")
    service_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
    result = run_aws_command(service_cmd)
    
    if result:
        data = json.loads(result)
        service = data['services'][0]
        
        running_count = service['runningCount']
        desired_count = service['desiredCount']
        task_def = service['taskDefinition']
        
        print(f"   Running/Desired: {running_count}/{desired_count}")
        print(f"   Task Definition: {task_def}")
        
        # Check deployments
        for deployment in service['deployments']:
            status = deployment['status']
            task_def_deploy = deployment['taskDefinition']
            print(f"   Deployment: {task_def_deploy} - {status}")
    
    # 2. List current tasks
    print("\n📋 2. Current Tasks:")
    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
    result = run_aws_command(tasks_cmd)
    
    if result:
        data = json.loads(result)
        task_arns = data.get('taskArns', [])
        
        if task_arns:
            print(f"   Found {len(task_arns)} tasks:")
            
            # Get detailed task info
            task_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + task_arns + ['--output', 'json']
            result = run_aws_command(task_cmd)
            
            if result:
                data = json.loads(result)
                for i, task in enumerate(data['tasks'], 1):
                    task_def = task['taskDefinitionArn'].split('/')[-1]
                    status = task['lastStatus']
                    health = task.get('healthStatus', 'UNKNOWN')
                    created_at = task.get('createdAt', 'Unknown')
                    
                    print(f"   Task {i}: {task_def} - Status: {status} - Health: {health}")
                    print(f"      Created: {created_at}")
                    
                    # Check network configuration
                    for attachment in task.get('attachments', []):
                        if attachment['type'] == 'ElasticNetworkInterface':
                            for detail in attachment['details']:
                                if detail['name'] == 'subnetId':
                                    subnet_id = detail['value']
                                    print(f"      Subnet: {subnet_id}")
                                elif detail['name'] == 'networkInterfaceId':
                                    eni_id = detail['value']
                                    print(f"      ENI: {eni_id}")
                    
                    # Check container status
                    for container in task.get('containers', []):
                        container_name = container['name']
                        container_status = container.get('lastStatus', 'Unknown')
                        exit_code = container.get('exitCode', 'N/A')
                        
                        print(f"      Container '{container_name}': {container_status} (Exit: {exit_code})")
                        
                        if 'reason' in container:
                            print(f"         Reason: {container['reason']}")
        else:
            print("   ❌ NO TASKS FOUND - This explains the network diagnosis issue!")
    
    # 3. Check why tasks might not be running
    print("\n📋 3. Checking Task Failures:")
    
    # Check stopped tasks
    stopped_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--desired-status', 'STOPPED', '--max-items', '5', '--output', 'json']
    result = run_aws_command(stopped_cmd)
    
    if result:
        data = json.loads(result)
        stopped_arns = data.get('taskArns', [])
        
        if stopped_arns:
            print(f"   Found {len(stopped_arns)} recent stopped tasks:")
            
            # Get details of stopped tasks
            task_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + stopped_arns[:3] + ['--output', 'json']
            result = run_aws_command(task_cmd)
            
            if result:
                data = json.loads(result)
                for i, task in enumerate(data['tasks'], 1):
                    task_def = task['taskDefinitionArn'].split('/')[-1]
                    status = task['lastStatus']
                    stopped_reason = task.get('stoppedReason', 'Unknown')
                    
                    print(f"   Stopped Task {i}: {task_def} - {stopped_reason}")
                    
                    # Check container exit details
                    for container in task.get('containers', []):
                        if container.get('exitCode') is not None:
                            exit_code = container['exitCode']
                            reason = container.get('reason', 'No reason')
                            print(f"      Container exit: {exit_code} - {reason}")
    
    print(f"\n🎯 DIAGNOSIS:")
    print(f"If no tasks are running, that's why the network diagnosis found no ECS subnets.")
    print(f"The application cannot connect to the database because it's not even running!")

if __name__ == "__main__":
    check_ecs_status() 