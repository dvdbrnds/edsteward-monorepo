#!/usr/bin/env python3
"""
Quick fix to deploy the specific Docker image that contains the emergency database endpoints
"""

import boto3
import time
from datetime import datetime

# Configuration
CLUSTER_NAME = "edsteward-cluster"
SERVICE_NAME = "edsteward-service"
REGION = "us-east-1"
# This is the final fix with endpoints in the correct location
EMERGENCY_IMAGE = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:correct-location-20250614-162557"

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def main():
    ecs = boto3.client('ecs', region_name=REGION)
    
    log("🚨 DEPLOYING EMERGENCY ENDPOINTS IMAGE")
    log("=" * 50)
    
    # Get current task definition
    log("Getting current task definition...")
    service_response = ecs.describe_services(
        cluster=CLUSTER_NAME,
        services=[SERVICE_NAME]
    )
    
    current_task_def_arn = service_response['services'][0]['taskDefinition']
    log(f"Current task definition: {current_task_def_arn}")
    
    # Get task definition details
    task_def_response = ecs.describe_task_definition(
        taskDefinition=current_task_def_arn
    )
    
    current_task_def = task_def_response['taskDefinition']
    
    # Update container image to emergency fix image
    container_definitions = current_task_def['containerDefinitions'].copy()
    for container in container_definitions:
        if container['name'] == 'edsteward':
            old_image = container['image']
            container['image'] = EMERGENCY_IMAGE
            log(f"Updating image: {old_image} -> {EMERGENCY_IMAGE}")
    
    # Create new task definition with emergency image
    new_task_def = {
        'family': current_task_def['family'],
        'networkMode': current_task_def['networkMode'],
        'requiresCompatibilities': current_task_def['requiresCompatibilities'],
        'cpu': current_task_def['cpu'],
        'memory': current_task_def['memory'],
        'containerDefinitions': container_definitions
    }
    
    # Add optional fields only if they exist
    if current_task_def.get('taskRoleArn'):
        new_task_def['taskRoleArn'] = current_task_def['taskRoleArn']
    if current_task_def.get('executionRoleArn'):
        new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
    
    log("Creating new task definition with emergency image...")
    response = ecs.register_task_definition(**new_task_def)
    new_task_def_arn = response['taskDefinition']['taskDefinitionArn']
    log(f"Created task definition: {new_task_def_arn}")
    
    # Update service to use new task definition
    log("Updating service with emergency image...")
    ecs.update_service(
        cluster=CLUSTER_NAME,
        service=SERVICE_NAME,
        taskDefinition=new_task_def_arn,
        forceNewDeployment=True,
        deploymentConfiguration={
            'maximumPercent': 200,
            'minimumHealthyPercent': 0
        }
    )
    
    log("✅ DIAGNOSTIC IMAGE DEPLOYMENT STARTED!")
    log("Wait 2-3 minutes for deployment to complete, then test:")
    log("curl https://edsteward.ai/api/diagnostic")
    log("curl https://edsteward.ai/api/db-direct")

if __name__ == "__main__":
    main() 