#!/usr/bin/env python3
"""
Deploy Authentication Fix to AWS
================================

This script deploys the fixed authentication configuration to AWS ECS.
"""

import subprocess
import boto3
import time
import sys

# Configuration
ECR_REPO = "588670245982.dkr.ecr.us-east-1.amazonaws.com/edsteward"
LOCAL_TAG = "edsteward:fix-auth"
REMOTE_TAG = f"{ECR_REPO}:auth-fix-{int(time.time())}"
CLUSTER_NAME = "edsteward-cluster"
SERVICE_NAME = "edsteward-service"

def run_command(cmd, description):
    """Run a command and return success status"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        print(f"✅ {description} completed")
        if result.stdout.strip():
            print(f"   Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def main():
    print("🚀 Starting deployment of authentication fix...")
    
    # Step 1: Login to ECR
    print("\n📦 Logging into ECR...")
    if not run_command(
        "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 588670245982.dkr.ecr.us-east-1.amazonaws.com",
        "ECR login"
    ):
        print("❌ ECR login failed. Trying alternative approach...")
        return False
    
    # Step 2: Tag the image
    print(f"\n🏷️  Tagging image...")
    if not run_command(
        f"docker tag {LOCAL_TAG} {REMOTE_TAG}",
        f"Tag image as {REMOTE_TAG}"
    ):
        return False
    
    # Step 3: Push to ECR
    print(f"\n📤 Pushing to ECR...")
    if not run_command(
        f"docker push {REMOTE_TAG}",
        f"Push {REMOTE_TAG} to ECR"
    ):
        return False
    
    # Step 4: Update ECS service
    print(f"\n🔄 Updating ECS service...")
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Get current task definition
        service_response = ecs.describe_services(
            cluster=CLUSTER_NAME,
            services=[SERVICE_NAME]
        )
        
        if not service_response['services']:
            print(f"❌ Service {SERVICE_NAME} not found")
            return False
            
        current_task_def = service_response['services'][0]['taskDefinition']
        print(f"   Current task definition: {current_task_def}")
        
        # Get task definition details
        task_def_response = ecs.describe_task_definition(
            taskDefinition=current_task_def
        )
        
        task_def = task_def_response['taskDefinition']
        
        # Update container image
        for container in task_def['containerDefinitions']:
            if container['name'] == 'edsteward':
                old_image = container['image']
                container['image'] = REMOTE_TAG
                print(f"   Updated image: {old_image} -> {REMOTE_TAG}")
                break
        
        # Remove fields that can't be included in registration
        for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 
                     'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
            if field in task_def:
                del task_def[field]
        
        # Register new task definition
        print("   Registering new task definition...")
        new_task_def = ecs.register_task_definition(**task_def)
        new_task_arn = new_task_def['taskDefinition']['taskDefinitionArn']
        print(f"   New task definition: {new_task_arn}")
        
        # Update service
        print("   Updating service...")
        ecs.update_service(
            cluster=CLUSTER_NAME,
            service=SERVICE_NAME,
            taskDefinition=new_task_arn
        )
        
        print("✅ ECS service update initiated")
        
    except Exception as e:
        print(f"❌ ECS update failed: {e}")
        return False
    
    # Step 5: Wait for deployment
    print(f"\n⏳ Waiting for deployment to complete...")
    try:
        waiter = ecs.get_waiter('services_stable')
        waiter.wait(
            cluster=CLUSTER_NAME,
            services=[SERVICE_NAME],
            WaiterConfig={'maxAttempts': 30, 'delay': 30}
        )
        print("✅ Deployment completed successfully!")
        
    except Exception as e:
        print(f"⚠️  Deployment may still be in progress: {e}")
        print("   Check AWS console for status")
    
    # Step 6: Test the deployment
    print(f"\n🧪 Testing deployment...")
    time.sleep(10)  # Give it a moment to start
    
    if run_command(
        "python3 diagnose-auth-issue.py",
        "Testing regulations endpoint"
    ):
        print("\n🎉 DEPLOYMENT SUCCESSFUL!")
        print("   The authentication fix has been deployed and is working!")
    else:
        print("\n⚠️  Deployment completed but endpoint test failed")
        print("   Please check the service logs")
    
    return True

if __name__ == "__main__":
    if main():
        print("\n✅ Authentication fix deployment completed!")
        sys.exit(0)
    else:
        print("\n❌ Deployment failed!")
        sys.exit(1) 