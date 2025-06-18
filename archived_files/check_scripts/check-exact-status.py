#!/usr/bin/env python3

import boto3
import json
from datetime import datetime

def main():
    print("🔍 EXACT ECS TASK STATUS CHECK")
    print("===============================")
    
    # Initialize AWS clients
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get service details
        print("1️⃣ Getting service details...")
        service_response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = service_response['services'][0]
        print(f"   Service ARN: {service['serviceArn']}")
        print(f"   Task Definition: {service['taskDefinition']}")
        print(f"   Running Count: {service['runningCount']}")
        print(f"   Pending Count: {service['pendingCount']}")
        print(f"   Desired Count: {service['desiredCount']}")
        print()
        
        # Get all tasks (running and stopped)
        print("2️⃣ Getting all tasks...")
        tasks_response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service',
            maxResults=10
        )
        
        if tasks_response['taskArns']:
            print(f"   Found {len(tasks_response['taskArns'])} tasks:")
            
            # Get detailed task information
            task_details = ecs.describe_tasks(
                cluster='edsteward-cluster',
                tasks=tasks_response['taskArns']
            )
            
            for task in task_details['tasks']:
                task_id = task['taskArn'].split('/')[-1]
                task_def = task['taskDefinitionArn'].split('/')[-1]
                created = task['createdAt']
                last_status = task['lastStatus']
                desired_status = task['desiredStatus']
                
                print(f"\n📋 Task: {task_id}")
                print(f"   Task Definition: {task_def}")
                print(f"   Created: {created}")
                print(f"   Last Status: {last_status}")
                print(f"   Desired Status: {desired_status}")
                print(f"   Health Status: {task.get('healthStatus', 'UNKNOWN')}")
                print(f"   CPU Architecture: {task.get('cpuArchitecture', 'UNKNOWN')}")
                
                # Container details
                print("   📦 Containers:")
                for container in task['containers']:
                    container_name = container['name']
                    container_status = container['lastStatus']
                    runtime_id = container.get('runtimeId', 'None')
                    health_status = container.get('healthStatus', 'UNKNOWN')
                    
                    print(f"     - {container_name}: {container_status} (Health: {health_status})")
                    print(f"       Runtime ID: {runtime_id}")
                    
                    # Exit information if container stopped
                    if 'exitCode' in container:
                        print(f"       Exit Code: {container['exitCode']}")
                        if 'reason' in container:
                            print(f"       Exit Reason: {container['reason']}")
                
                # Connectivity info
                if 'connectivity' in task:
                    print(f"   🌐 Connectivity: {task['connectivity']}")
                if 'connectivityAt' in task:
                    print(f"   🌐 Connected At: {task['connectivityAt']}")
                
                print("   " + "="*50)
        else:
            print("   ❌ No tasks found")
        
        # Check load balancer target health
        print("\n3️⃣ Checking load balancer targets...")
        try:
            elbv2 = boto3.client('elbv2', region_name='us-east-1')
            
            # Get target groups
            tg_response = elbv2.describe_target_groups()
            edsteward_tgs = [tg for tg in tg_response['TargetGroups'] if 'edsteward' in tg['TargetGroupName']]
            
            for tg in edsteward_tgs:
                tg_arn = tg['TargetGroupArn']
                tg_name = tg['TargetGroupName']
                print(f"   📊 Target Group: {tg_name}")
                
                # Get target health
                health_response = elbv2.describe_target_health(TargetGroupArn=tg_arn)
                for target in health_response['TargetHealthDescriptions']:
                    target_id = target['Target']['Id']
                    target_port = target['Target']['Port']
                    health_state = target['TargetHealth']['State']
                    
                    print(f"     - Target: {target_id}:{target_port} -> {health_state}")
                    
                    if 'Description' in target['TargetHealth']:
                        print(f"       Description: {target['TargetHealth']['Description']}")
                        
        except Exception as e:
            print(f"   ⚠️ Could not check load balancer: {e}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 