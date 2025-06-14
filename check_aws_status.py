#!/usr/bin/env python3

import boto3
import json
import time

def log(message: str, status: str = "INFO"):
    """Simple logging with colors"""
    colors = {
        "SUCCESS": "\033[92m✅",
        "ERROR": "\033[91m❌", 
        "WARNING": "\033[93m⚠️",
        "INFO": "\033[94mℹ️"
    }
    reset = "\033[0m"
    timestamp = time.strftime("%H:%M:%S")
    print(f"{colors.get(status, colors['INFO'])} [{timestamp}] {message}{reset}")

def check_current_deployment():
    """Check the current deployment status"""
    log("🎯 Checking current AWS deployment status (avoiding pager issues)...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get service details
        service_response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = service_response['services'][0]
        
        log(f"📋 Service Status: {service['status']}")
        log(f"📋 Running Count: {service['runningCount']}")
        log(f"📋 Pending Count: {service['pendingCount']}")
        log(f"📋 Desired Count: {service['desiredCount']}")
        
        # Check deployments
        deployments = service['deployments']
        log(f"📋 Active Deployments: {len(deployments)}")
        
        for i, deployment in enumerate(deployments):
            status = deployment['status']
            task_def = deployment['taskDefinition'].split('/')[-1]
            running = deployment['runningCount']
            desired = deployment['desiredCount']
            
            log(f"   Deployment {i+1}: {status} - {task_def} ({running}/{desired})")
            
            if status == 'PRIMARY':
                log(f"   ✅ Primary deployment: {task_def}", "SUCCESS")
        
        # Check if there are running tasks
        tasks_response = ecs.list_tasks(cluster='edsteward-cluster')
        task_arns = tasks_response['taskArns']
        
        if task_arns:
            log(f"📋 Found {len(task_arns)} running tasks")
            
            # Get task details
            tasks_detail = ecs.describe_tasks(
                cluster='edsteward-cluster',
                tasks=task_arns
            )
            
            for task in tasks_detail['tasks']:
                task_id = task['taskArn'].split('/')[-1][:8]
                status = task['lastStatus']
                desired = task['desiredStatus']
                log(f"   Task {task_id}: {status} (desired: {desired})")
                
                # Check health
                health = task.get('healthStatus', 'UNKNOWN')
                if health != 'UNKNOWN':
                    log(f"   Health: {health}")
        else:
            log("📋 No tasks currently running")
        
        # Check if deployment is healthy
        if service['runningCount'] > 0:
            log("✅ Deployment appears to be running!", "SUCCESS")
            log("🌐 Try accessing https://edsteward.ai to test", "SUCCESS")
        else:
            log("⚠️ No running tasks - deployment may be starting or failed", "WARNING")
            
            # Check recent stopped tasks for errors
            try:
                stopped_tasks = ecs.list_tasks(
                    cluster='edsteward-cluster',
                    desiredStatus='STOPPED',
                    maxResults=3
                )
                
                if stopped_tasks['taskArns']:
                    log("🔍 Checking recent stopped tasks for errors...")
                    
                    stopped_details = ecs.describe_tasks(
                        cluster='edsteward-cluster',
                        tasks=stopped_tasks['taskArns']
                    )
                    
                    for task in stopped_details['tasks']:
                        task_id = task['taskArn'].split('/')[-1][:8]
                        stop_reason = task.get('stopCode', 'Unknown')
                        
                        if 'stoppedReason' in task:
                            log(f"   Task {task_id} stopped: {task['stoppedReason']}")
                        
                        # Check for container errors
                        for container in task['containers']:
                            if 'reason' in container:
                                log(f"   Container error: {container['reason']}", "ERROR")
                                
            except Exception as e:
                log(f"Failed to check stopped tasks: {e}", "WARNING")
        
        return service
        
    except Exception as e:
        log(f"❌ Failed to check deployment: {e}", "ERROR")
        return None

if __name__ == "__main__":
    check_current_deployment()