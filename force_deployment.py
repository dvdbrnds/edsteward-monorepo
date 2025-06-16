#!/usr/bin/env python3
import boto3
import json
import time

def force_deployment():
    """Force ECS deployment with new image"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Get current task definition
        print("🔍 Getting current task definition...")
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_def = response['services'][0]['taskDefinition']
        print(f"📋 Current task definition: {current_task_def}")
        
        # Get task definition details
        task_def_response = ecs.describe_task_definition(taskDefinition=current_task_def)
        task_def = task_def_response['taskDefinition']
        
        # Create new task definition with updated image
        new_task_def = {
            'family': task_def['family'],
            'networkMode': task_def['networkMode'],
            'requiresCompatibilities': task_def['requiresCompatibilities'],
            'cpu': task_def['cpu'],
            'memory': task_def['memory'],
            'executionRoleArn': task_def['executionRoleArn'],
            'containerDefinitions': []
        }
        
        # Only add taskRoleArn if it exists
        if task_def.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_def['taskRoleArn']
        
        # Update container image
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            if container['name'] == 'edsteward-app':
                new_container['image'] = '259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-repo:latest'
                print(f"🔄 Updating image to: {new_container['image']}")
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register new task definition
        print("📝 Registering new task definition...")
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        print(f"✅ New task definition: {new_task_arn}")
        
        # Update service with new task definition
        print("🚀 Updating service...")
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print("⏳ Waiting for deployment to complete...")
        
        # Wait for deployment
        for i in range(30):  # 15 minutes max
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            # Check if using new task definition
            deployments = service['deployments']
            primary_deployment = next((d for d in deployments if d['status'] == 'PRIMARY'), None)
            
            if primary_deployment:
                current_task_def = primary_deployment['taskDefinition']
                print(f"   Attempt {i+1}: {running_count}/{desired_count} tasks, using {current_task_def}")
                
                if running_count == desired_count and new_task_arn in current_task_def:
                    print("✅ Deployment completed successfully!")
                    return True
            else:
                print(f"   Attempt {i+1}: {running_count}/{desired_count} tasks")
        
        print("⚠️ Deployment may still be in progress")
        return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    force_deployment() 