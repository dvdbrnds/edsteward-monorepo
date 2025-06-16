#!/usr/bin/env python3
"""
Deploy Working Fix to AWS
=========================

This script deploys the working version of the application that provides
regulations access without authentication requirements.
"""

import subprocess
import boto3
import time
import sys

def run_command(cmd, description):
    """Run a shell command and return success status"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        print(f"✅ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def push_to_ecr():
    """Push the Docker image to ECR"""
    print("📦 Pushing Docker image to ECR...")
    
    # Login to ECR
    if not run_command(
        "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 588670245982.dkr.ecr.us-east-1.amazonaws.com",
        "Logging into ECR"
    ):
        return False
    
    # Push image with new tag
    tag_num = int(time.time()) % 1000  # Use timestamp for unique tag
    image_tag = f"working-{tag_num}"
    
    if not run_command(
        f"docker tag edsteward:working 588670245982.dkr.ecr.us-east-1.amazonaws.com/edsteward:{image_tag}",
        f"Tagging image as {image_tag}"
    ):
        return False
    
    if not run_command(
        f"docker push 588670245982.dkr.ecr.us-east-1.amazonaws.com/edsteward:{image_tag}",
        f"Pushing image {image_tag} to ECR"
    ):
        return False
    
    return image_tag

def update_task_definition(image_tag):
    """Create new task definition with the working image"""
    print("📋 Creating new task definition...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward')
        current_task_def = response['taskDefinition']
        
        # Create new task definition with updated image
        new_task_def = {
            'family': current_task_def['family'],
            'taskRoleArn': current_task_def.get('taskRoleArn'),
            'executionRoleArn': current_task_def.get('executionRoleArn'),
            'networkMode': current_task_def.get('networkMode'),
            'requiresCompatibilities': current_task_def.get('requiresCompatibilities'),
            'cpu': current_task_def.get('cpu'),
            'memory': current_task_def.get('memory'),
            'containerDefinitions': []
        }
        
        # Update container image
        for container in current_task_def['containerDefinitions']:
            new_container = container.copy()
            if container['name'] == 'edsteward':
                new_container['image'] = f"588670245982.dkr.ecr.us-east-1.amazonaws.com/edsteward:{image_tag}"
                print(f"   Updated container image to: {new_container['image']}")
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register new task definition
        response = ecs.register_task_definition(**new_task_def)
        new_task_def_arn = response['taskDefinition']['taskDefinitionArn']
        
        print(f"✅ Created new task definition: {new_task_def_arn}")
        return new_task_def_arn
        
    except Exception as e:
        print(f"❌ Failed to create task definition: {e}")
        return None

def update_service(task_definition_arn):
    """Update the ECS service with new task definition"""
    print("🚀 Updating ECS service...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=task_definition_arn,
            forceNewDeployment=True
        )
        
        print("✅ Service update initiated")
        return True
        
    except Exception as e:
        print(f"❌ Failed to update service: {e}")
        return False

def wait_for_deployment():
    """Wait for the deployment to complete"""
    print("⏳ Waiting for deployment to complete...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        for i in range(60):  # Wait up to 10 minutes
            time.sleep(10)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            print(f"   Status: {running_count}/{desired_count} tasks running")
            
            if running_count == desired_count and running_count > 0:
                print("✅ Deployment completed successfully!")
                return True
        
        print("⚠️  Deployment timeout - check AWS console")
        return False
        
    except Exception as e:
        print(f"❌ Error waiting for deployment: {e}")
        return False

def test_deployment():
    """Test that the deployment is working"""
    print("🧪 Testing deployment...")
    
    import requests
    import json
    
    try:
        # Test the regulations endpoint
        response = requests.get('https://edsteward.blakbytes.tech/api/regulations', timeout=30)
        
        if response.status_code == 200:
            regulations = response.json()
            count = len(regulations)
            print(f"✅ Regulations endpoint working: {count} regulations found")
            
            if count > 0:
                print(f"   Sample regulation: {regulations[0].get('name', 'No name')}")
                return True
            else:
                print("⚠️  No regulations found in response")
                return False
        else:
            print(f"❌ Regulations endpoint failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    """Main deployment process"""
    print("🚀 Deploying Working Fix to AWS")
    print("=" * 40)
    
    # Step 1: Push image to ECR
    print("\n📋 Step 1: Push Docker Image to ECR")
    image_tag = push_to_ecr()
    if not image_tag:
        print("❌ Failed to push image to ECR")
        return False
    
    # Step 2: Update task definition
    print("\n📋 Step 2: Update Task Definition")
    task_def_arn = update_task_definition(image_tag)
    if not task_def_arn:
        print("❌ Failed to update task definition")
        return False
    
    # Step 3: Update service
    print("\n📋 Step 3: Update ECS Service")
    if not update_service(task_def_arn):
        print("❌ Failed to update service")
        return False
    
    # Step 4: Wait for deployment
    print("\n📋 Step 4: Wait for Deployment")
    if not wait_for_deployment():
        print("⚠️  Deployment may have issues - check manually")
    
    # Step 5: Test deployment
    print("\n📋 Step 5: Test Deployment")
    if test_deployment():
        print("\n🎉 Deployment successful!")
        print("✅ The regulations endpoint is now accessible without authentication")
        print("✅ Local and AWS environments now have consistent behavior")
        print(f"✅ Image deployed: {image_tag}")
        return True
    else:
        print("\n⚠️  Deployment completed but tests failed")
        print("   Check the application logs for issues")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 