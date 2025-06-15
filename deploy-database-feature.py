#!/usr/bin/env python3

import boto3
import subprocess
import json
import time
from datetime import datetime

def run_command(command, description):
    """Run a shell command and return the result"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
        print(f"✅ {description} completed successfully")
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e.stderr}")
        raise

def main():
    print("🚀 Deploying Database Management Feature to AWS")
    print("=" * 50)
    
    # AWS clients
    ecs_client = boto3.client('ecs')
    ecr_client = boto3.client('ecr')
    
    # Configuration
    cluster_name = 'edsteward-cluster'
    service_name = 'edsteward-service'
    repository_name = 'edsteward'
    
    try:
        # Step 1: Get ECR login token
        print("🔐 Getting ECR login token...")
        ecr_response = ecr_client.get_authorization_token()
        token = ecr_response['authorizationData'][0]['authorizationToken']
        endpoint = ecr_response['authorizationData'][0]['proxyEndpoint']
        
        # Step 2: Docker login to ECR
        run_command(f"aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin {endpoint}", "Docker ECR login")
        
        # Step 3: Build Docker image
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        image_tag = f"database-feature-{timestamp}"
        full_image_name = f"{endpoint.replace('https://', '')}/{repository_name}:{image_tag}"
        
        run_command(f"docker build --platform linux/amd64 -t {repository_name}:{image_tag} .", "Building Docker image")
        
        # Step 4: Tag image for ECR
        run_command(f"docker tag {repository_name}:{image_tag} {full_image_name}", "Tagging image for ECR")
        
        # Step 5: Push image to ECR
        run_command(f"docker push {full_image_name}", "Pushing image to ECR")
        
        # Step 6: Get current task definition
        print("📋 Getting current task definition...")
        response = ecs_client.describe_services(
            cluster=cluster_name,
            services=[service_name]
        )
        
        current_task_def_arn = response['services'][0]['taskDefinition']
        
        # Get task definition details
        task_def_response = ecs_client.describe_task_definition(
            taskDefinition=current_task_def_arn
        )
        
        task_definition = task_def_response['taskDefinition']
        
        # Step 7: Create new task definition with updated image
        print("🔄 Creating new task definition...")
        
        # Update the image in the container definition
        new_task_def = {
            'family': task_definition['family'],
            'requiresCompatibilities': task_definition.get('requiresCompatibilities', []),
            'containerDefinitions': []
        }
        
        # Add optional fields only if they exist
        if task_definition.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_definition['taskRoleArn']
        if task_definition.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = task_definition['executionRoleArn']
        if task_definition.get('networkMode'):
            new_task_def['networkMode'] = task_definition['networkMode']
        if task_definition.get('cpu'):
            new_task_def['cpu'] = task_definition['cpu']
        if task_definition.get('memory'):
            new_task_def['memory'] = task_definition['memory']
        
        # Update container definitions with new image
        for container in task_definition['containerDefinitions']:
            new_container = container.copy()
            new_container['image'] = full_image_name
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register new task definition
        new_task_response = ecs_client.register_task_definition(**new_task_def)
        new_task_def_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        
        print(f"✅ New task definition created: {new_task_def_arn}")
        
        # Step 8: Update service with new task definition
        print("🔄 Updating ECS service...")
        ecs_client.update_service(
            cluster=cluster_name,
            service=service_name,
            taskDefinition=new_task_def_arn,
            forceNewDeployment=True
        )
        
        print("✅ Service update initiated")
        
        # Step 9: Wait for deployment to complete
        print("⏳ Waiting for deployment to complete...")
        waiter = ecs_client.get_waiter('services_stable')
        
        try:
            waiter.wait(
                cluster=cluster_name,
                services=[service_name],
                WaiterConfig={
                    'delay': 30,
                    'maxAttempts': 20
                }
            )
            print("✅ Deployment completed successfully!")
        except Exception as e:
            print(f"⚠️  Deployment may still be in progress: {e}")
        
        # Step 10: Verify deployment
        print("🔍 Verifying deployment...")
        final_response = ecs_client.describe_services(
            cluster=cluster_name,
            services=[service_name]
        )
        
        service = final_response['services'][0]
        running_count = service['runningCount']
        desired_count = service['desiredCount']
        
        print(f"📊 Service Status:")
        print(f"   Running tasks: {running_count}")
        print(f"   Desired tasks: {desired_count}")
        print(f"   Task definition: {service['taskDefinition']}")
        
        if running_count == desired_count and running_count > 0:
            print("🎉 Deployment successful! Database management feature is now live!")
            print("🌐 Access your application at: https://edsteward.ai")
            print("🔧 Go to Admin Settings → Database tab to use the new feature")
        else:
            print("⚠️  Deployment may still be stabilizing. Check AWS console for details.")
            
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 