#!/usr/bin/env python3

import boto3
import json
import sys

def update_task_definition():
    # Initialize ECS client
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward-task')
        task_def = response['taskDefinition']
        
        print(f"Current image: {task_def['containerDefinitions'][0]['image']}")
        
        # Update the image
        new_image = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v1.13"
        task_def['containerDefinitions'][0]['image'] = new_image
        
        # Remove fields that can't be used for registration
        for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 
                     'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
            task_def.pop(field, None)
        
        # Register new task definition
        new_task_def = ecs.register_task_definition(**task_def)
        new_revision = new_task_def['taskDefinition']['revision']
        
        print(f"Registered new task definition: edsteward-task:{new_revision}")
        print(f"New image: {new_image}")
        
        # Update ECS service to use new task definition
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=f'edsteward-task:{new_revision}'
        )
        
        print(f"Updated ECS service to use edsteward-task:{new_revision}")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = update_task_definition()
    sys.exit(0 if success else 1) 