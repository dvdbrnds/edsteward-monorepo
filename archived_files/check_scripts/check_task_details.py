#!/usr/bin/env python3
"""
Check Task Details
==================

Check detailed ECS task information to diagnose startup issues.
"""

import boto3
import time

def check_task_details():
    """Check detailed task information"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🔍 DETAILED TASK ANALYSIS')
        print('=' * 50)
        
        # Get service information
        service_info = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = service_info['services'][0]
        print(f'📋 Service: {service["serviceName"]}')
        print(f'📊 Status: {service["status"]}')
        print(f'👥 Tasks: {service["runningCount"]}/{service["desiredCount"]}')
        print(f'📦 Task Definition: {service["taskDefinition"]}')
        
        # Check deployments
        deployments = service['deployments']
        print(f'\n📦 Deployments ({len(deployments)}):')
        for i, deployment in enumerate(deployments):
            status = deployment['status']
            task_def = deployment['taskDefinition']
            created_at = deployment['createdAt']
            updated_at = deployment['updatedAt']
            running_count = deployment['runningCount']
            pending_count = deployment['pendingCount']
            desired_count = deployment['desiredCount']
            
            print(f'  {i+1}. {status}')
            print(f'     Task Definition: {task_def.split("/")[-1]}')
            print(f'     Created: {created_at}')
            print(f'     Updated: {updated_at}')
            print(f'     Tasks: {running_count} running, {pending_count} pending, {desired_count} desired')
            
            if 'rolloutState' in deployment:
                print(f'     Rollout State: {deployment["rolloutState"]}')
            if 'rolloutStateReason' in deployment:
                print(f'     Rollout Reason: {deployment["rolloutStateReason"]}')
        
        # List all tasks for this service
        print(f'\n🔍 TASK DETAILS')
        print('=' * 30)
        
        tasks_response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service'
        )
        
        task_arns = tasks_response['taskArns']
        print(f'📋 Found {len(task_arns)} tasks')
        
        if task_arns:
            # Get detailed task information
            tasks_detail = ecs.describe_tasks(
                cluster='edsteward-cluster',
                tasks=task_arns
            )
            
            for i, task in enumerate(tasks_detail['tasks']):
                print(f'\n📄 Task {i+1}: {task["taskArn"].split("/")[-1]}')
                print(f'   Task Definition: {task["taskDefinitionArn"].split("/")[-1]}')
                print(f'   Last Status: {task["lastStatus"]}')
                print(f'   Desired Status: {task["desiredStatus"]}')
                print(f'   Health Status: {task.get("healthStatus", "N/A")}')
                print(f'   Created: {task["createdAt"]}')
                
                if 'startedAt' in task:
                    print(f'   Started: {task["startedAt"]}')
                if 'stoppedAt' in task:
                    print(f'   Stopped: {task["stoppedAt"]}')
                    print(f'   Stop Code: {task.get("stopCode", "N/A")}')
                    if 'stoppedReason' in task:
                        print(f'   Stop Reason: {task["stoppedReason"]}')
                
                # Check container details
                if 'containers' in task:
                    for container in task['containers']:
                        print(f'   Container: {container["name"]}')
                        print(f'     Status: {container["lastStatus"]}')
                        print(f'     Health: {container.get("healthStatus", "N/A")}')
                        
                        if 'reason' in container:
                            print(f'     Reason: {container["reason"]}')
                        if 'exitCode' in container:
                            print(f'     Exit Code: {container["exitCode"]}')
        
        else:
            print('⚠️ No tasks found - this might indicate an issue')
            
            # Check for recent stopped tasks
            print('\n🔍 Checking recent stopped tasks...')
            stopped_tasks = ecs.list_tasks(
                cluster='edsteward-cluster',
                serviceName='edsteward-service',
                desiredStatus='STOPPED'
            )
            
            if stopped_tasks['taskArns']:
                print(f'📋 Found {len(stopped_tasks["taskArns"])} recent stopped tasks')
                
                # Get details of recent stopped tasks
                recent_stopped = stopped_tasks['taskArns'][:3]  # Last 3
                stopped_detail = ecs.describe_tasks(
                    cluster='edsteward-cluster',
                    tasks=recent_stopped
                )
                
                for task in stopped_detail['tasks']:
                    print(f'\n❌ Stopped Task: {task["taskArn"].split("/")[-1]}')
                    print(f'   Task Definition: {task["taskDefinitionArn"].split("/")[-1]}')
                    print(f'   Stop Code: {task.get("stopCode", "N/A")}')
                    print(f'   Stop Reason: {task.get("stoppedReason", "N/A")}')
                    print(f'   Stopped At: {task.get("stoppedAt", "N/A")}')
        
        # Check service events
        print(f'\n📋 SERVICE EVENTS')
        print('=' * 20)
        
        if 'events' in service:
            events = service['events'][:5]  # Last 5 events
            for event in events:
                created_at = event['createdAt']
                message = event['message']
                print(f'   {created_at}: {message}')
        
        # Test endpoint one more time
        print(f'\n🧪 QUICK TEST')
        print('=' * 15)
        
        import requests
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=10
            )
            
            print(f'📡 Status: {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    print(f'🎉 SUCCESS! Authentication fix is working!')
                    print(f'🎯 {len(data)} regulations accessible!')
                    return True
            elif response.status_code == 503:
                print('⏳ Service still starting up')
            elif response.status_code == 401:
                print('❌ Still getting 401 - deployment issue')
            
        except Exception as e:
            print(f'⚠️ Test error: {e}')
        
        return False
        
    except Exception as e:
        print(f'❌ Task analysis failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('🔍 DETAILED ECS TASK ANALYSIS')
    print('=' * 50)
    print('Checking why the authentication fix deployment is taking time...')
    print()
    
    if check_task_details():
        print('\n🎉 AUTHENTICATION FIX IS WORKING!')
    else:
        print('\n💭 ANALYSIS COMPLETE')
        print('Based on the task details above, we can see what\'s happening with the deployment.') 