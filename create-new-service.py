#!/usr/bin/env python3
"""
Create a brand new ECS service with the latest task definition
This bypasses any issues with the existing service
"""

import boto3
import json
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def main():
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    log("🚀 CREATING BRAND NEW ECS SERVICE")
    log("=" * 50)
    
    # First, scale down the old service
    log("Step 1: Scaling down old service...")
    try:
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            desiredCount=0
        )
        log("✅ Old service scaled down to 0")
    except Exception as e:
        log(f"⚠️ Could not scale down old service: {e}")
    
    # Wait a moment
    import time
    time.sleep(10)
    
    # Create new service with latest task definition
    log("Step 2: Creating new service with latest task definition...")
    
    service_definition = {
        'serviceName': 'edsteward-service-new',
        'cluster': 'edsteward-cluster',
        'taskDefinition': 'edsteward-task:95',  # Our latest with database endpoints
        'desiredCount': 1,
        'launchType': 'FARGATE',
        'networkConfiguration': {
            'awsvpcConfiguration': {
                'subnets': [
                    'subnet-0a1b2c3d4e5f6g7h8',  # You'll need to update these
                    'subnet-0h8g7f6e5d4c3b2a1'   # with your actual subnet IDs
                ],
                'securityGroups': [
                    'sg-0123456789abcdef0'  # You'll need to update with your security group
                ],
                'assignPublicIp': 'ENABLED'
            }
        },
        'loadBalancers': [
            {
                'targetGroupArn': 'arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg/1234567890abcdef',
                'containerName': 'edsteward',
                'containerPort': 3000
            }
        ]
    }
    
    try:
        response = ecs.create_service(**service_definition)
        log(f"✅ New service created: {response['service']['serviceName']}")
        log("🎯 NEW SERVICE WILL USE TASK DEFINITION 95 WITH DATABASE ENDPOINTS!")
        
    except Exception as e:
        log(f"❌ Failed to create new service: {e}")
        log("You'll need to create the service manually in the AWS Console")
        log("Use task definition: edsteward-task:95")

if __name__ == "__main__":
    main() 