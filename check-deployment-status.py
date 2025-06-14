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

def check_service_status():
    """Check the current status of the ECS service"""
    log("🔍 Checking ECS service status...")
    
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
            elif status == 'PENDING':
                log(f"   ⏳ Pending deployment: {task_def}", "WARNING")
        
        return service
        
    except Exception as e:
        log(f"❌ Failed to check service status: {e}", "ERROR")
        return None

def check_task_status():
    """Check the status of individual tasks"""
    log("🔍 Checking task status...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # List tasks
        tasks_response = ecs.list_tasks(cluster='edsteward-cluster')
        task_arns = tasks_response['taskArns']
        
        if not task_arns:
            log("📋 No tasks currently running")
            return
        
        # Describe tasks
        tasks_detail_response = ecs.describe_tasks(
            cluster='edsteward-cluster',
            tasks=task_arns
        )
        
        for task in tasks_detail_response['tasks']:
            task_id = task['taskArn'].split('/')[-1]
            last_status = task['lastStatus']
            desired_status = task['desiredStatus']
            task_def = task['taskDefinitionArn'].split('/')[-1]
            
            log(f"📋 Task {task_id[:8]}...")
            log(f"   Status: {last_status} (desired: {desired_status})")
            log(f"   Task Definition: {task_def}")
            
            # Check container status
            for container in task['containers']:
                container_name = container['name']
                container_status = container.get('lastStatus', 'UNKNOWN')
                
                log(f"   Container {container_name}: {container_status}")
                
                # Check for exit code if stopped
                if 'exitCode' in container:
                    exit_code = container['exitCode']
                    if exit_code == 0:
                        log(f"   ✅ Container exited successfully (code: {exit_code})", "SUCCESS")
                    else:
                        log(f"   ❌ Container failed (exit code: {exit_code})", "ERROR")
                        
                        # Check for reason
                        if 'reason' in container:
                            log(f"   Reason: {container['reason']}")
        
    except Exception as e:
        log(f"❌ Failed to check task status: {e}", "ERROR")

def check_task_definition():
    """Check the current task definition being used"""
    log("🔍 Checking task definition...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get the latest task definition
        task_def_response = ecs.describe_task_definition(taskDefinition='edsteward-task:75')
        task_def = task_def_response['taskDefinition']
        
        log(f"📋 Task Definition: {task_def['family']}:{task_def['revision']}")
        log(f"📋 CPU: {task_def['cpu']}")
        log(f"📋 Memory: {task_def['memory']}")
        
        # Check environment variables
        container = task_def['containerDefinitions'][0]
        env_vars = container.get('environment', [])
        
        log("📋 Key Environment Variables:")
        for env_var in env_vars:
            name = env_var['name']
            value = env_var['value']
            
            if 'DATABASE' in name or 'SSL' in name or 'VERSION' in name:
                # Mask password
                if 'PASSWORD' in name:
                    value = '*' * len(value)
                log(f"   {name}: {value}")
        
    except Exception as e:
        log(f"❌ Failed to check task definition: {e}", "ERROR")

def main():
    log("🎯 Checking deployment status after force restart...")
    
    # Check service status
    service = check_service_status()
    
    print()  # Add spacing
    
    # Check task status
    check_task_status()
    
    print()  # Add spacing
    
    # Check task definition
    check_task_definition()
    
    # Summary
    log("=" * 60)
    log("🎯 DEPLOYMENT STATUS SUMMARY")
    log("=" * 60)
    
    if service:
        running = service['runningCount']
        desired = service['desiredCount']
        
        if running == desired and running > 0:
            log("✅ Service is running as expected", "SUCCESS")
        elif running == 0:
            log("⚠️ No tasks are running - deployment may be starting", "WARNING")
        else:
            log(f"⚠️ Partial deployment: {running}/{desired} tasks running", "WARNING")
    
    log("💡 If deployment is stuck, check CloudWatch logs for detailed errors")
    log("💡 The SSL-fixed version should start working once deployment completes")

if __name__ == "__main__":
    main()