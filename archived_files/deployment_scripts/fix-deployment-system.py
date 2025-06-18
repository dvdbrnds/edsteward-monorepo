#!/usr/bin/env python3
"""
EMERGENCY ECS DEPLOYMENT FIX SCRIPT
===================================

This script fixes the persistent ECS deployment issues where:
1. New Docker images are built and pushed successfully
2. New task definitions are created successfully  
3. But ECS services never actually use the new task definitions
4. Services keep running old code indefinitely

Based on AWS documentation and best practices, this script will:
1. Force stop current tasks to break the deployment deadlock
2. Update service with explicit task definition and force new deployment
3. Monitor deployment progress and ensure it completes
4. Verify new code is actually running

Usage: python3 fix-deployment-system.py
"""

import boto3
import json
import time
import sys
from datetime import datetime

# Configuration
CLUSTER_NAME = "edsteward-cluster"
SERVICE_NAME = "edsteward-service"
REGION = "us-east-1"
ECR_REPO = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"

class ECSDeploymentFixer:
    def __init__(self):
        self.ecs = boto3.client('ecs', region_name=REGION)
        self.ecr = boto3.client('ecr', region_name=REGION)
        
    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def get_latest_image_tag(self):
        """Get the most recent Docker image tag from ECR"""
        try:
            response = self.ecr.describe_images(
                repositoryName='edsteward'
            )
            
            # Sort by pushed date and get the latest
            images = sorted(
                response['imageDetails'], 
                key=lambda x: x['imagePushedAt'], 
                reverse=True
            )
            
            if images and 'imageTags' in images[0]:
                latest_tag = images[0]['imageTags'][0]
                self.log(f"Latest ECR image tag: {latest_tag}")
                return latest_tag
            else:
                self.log("No tagged images found, using 'latest'")
                return 'latest'
                
        except Exception as e:
            self.log(f"Error getting ECR images: {e}")
            return 'latest'
    
    def get_current_service_info(self):
        """Get current service configuration"""
        try:
            response = self.ecs.describe_services(
                cluster=CLUSTER_NAME,
                services=[SERVICE_NAME]
            )
            
            if not response['services']:
                raise Exception(f"Service {SERVICE_NAME} not found")
                
            service = response['services'][0]
            self.log(f"Current service status: {service['status']}")
            self.log(f"Current task definition: {service['taskDefinition']}")
            self.log(f"Desired count: {service['desiredCount']}")
            self.log(f"Running count: {service['runningCount']}")
            
            return service
            
        except Exception as e:
            self.log(f"Error getting service info: {e}")
            raise
    
    def get_current_task_definition(self):
        """Get the current task definition details"""
        service = self.get_current_service_info()
        task_def_arn = service['taskDefinition']
        
        response = self.ecs.describe_task_definition(
            taskDefinition=task_def_arn
        )
        
        return response['taskDefinition']
    
    def create_new_task_definition(self, image_tag):
        """Create a new task definition with the latest image"""
        current_task_def = self.get_current_task_definition()
        
        # Create new task definition with updated image
        new_image = f"{ECR_REPO}:{image_tag}"
        
        # Update container image
        container_definitions = current_task_def['containerDefinitions'].copy()
        for container in container_definitions:
            if container['name'] == 'edsteward':
                old_image = container['image']
                container['image'] = new_image
                self.log(f"Updating image: {old_image} -> {new_image}")
        
        # Register new task definition
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
        
        response = self.ecs.register_task_definition(**new_task_def)
        new_task_def_arn = response['taskDefinition']['taskDefinitionArn']
        
        self.log(f"Created new task definition: {new_task_def_arn}")
        return new_task_def_arn
    
    def force_stop_current_tasks(self):
        """Force stop all current tasks to break deployment deadlock"""
        self.log("🚨 FORCE STOPPING CURRENT TASKS TO BREAK DEADLOCK")
        
        # List current tasks
        response = self.ecs.list_tasks(
            cluster=CLUSTER_NAME,
            serviceName=SERVICE_NAME
        )
        
        task_arns = response['taskArns']
        if not task_arns:
            self.log("No tasks currently running")
            return
        
        self.log(f"Found {len(task_arns)} running tasks")
        
        # Stop all tasks
        for task_arn in task_arns:
            try:
                self.ecs.stop_task(
                    cluster=CLUSTER_NAME,
                    task=task_arn,
                    reason='Force deployment - breaking deadlock'
                )
                self.log(f"Stopped task: {task_arn.split('/')[-1]}")
            except Exception as e:
                self.log(f"Error stopping task {task_arn}: {e}")
        
        # Wait for tasks to stop
        self.log("Waiting for tasks to stop...")
        time.sleep(30)
    
    def update_service_with_new_task_definition(self, task_def_arn):
        """Update service to use new task definition with force deployment"""
        self.log("🚀 UPDATING SERVICE WITH NEW TASK DEFINITION")
        
        try:
            response = self.ecs.update_service(
                cluster=CLUSTER_NAME,
                service=SERVICE_NAME,
                taskDefinition=task_def_arn,
                forceNewDeployment=True,
                deploymentConfiguration={
                    'maximumPercent': 200,
                    'minimumHealthyPercent': 0  # Allow complete replacement
                }
            )
            
            deployment_id = response['service']['deployments'][0]['id']
            self.log(f"Started deployment: {deployment_id}")
            return deployment_id
            
        except Exception as e:
            self.log(f"Error updating service: {e}")
            raise
    
    def monitor_deployment(self, timeout_minutes=15):
        """Monitor deployment progress until completion"""
        self.log("📊 MONITORING DEPLOYMENT PROGRESS")
        
        start_time = time.time()
        timeout_seconds = timeout_minutes * 60
        
        while time.time() - start_time < timeout_seconds:
            try:
                service = self.get_current_service_info()
                
                # Check deployment status
                primary_deployment = None
                for deployment in service['deployments']:
                    if deployment['status'] == 'PRIMARY':
                        primary_deployment = deployment
                        break
                
                if primary_deployment:
                    status = primary_deployment['status']
                    running = primary_deployment['runningCount']
                    desired = primary_deployment['desiredCount']
                    
                    self.log(f"Deployment status: {status}, Running: {running}/{desired}")
                    
                    if status == 'PRIMARY' and running == desired and running > 0:
                        self.log("✅ DEPLOYMENT SUCCESSFUL!")
                        return True
                
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                self.log(f"Error monitoring deployment: {e}")
                time.sleep(30)
        
        self.log("❌ DEPLOYMENT TIMEOUT - Manual intervention required")
        return False
    
    def verify_new_code_running(self):
        """Verify that new code is actually running by testing endpoints"""
        self.log("🔍 VERIFYING NEW CODE IS RUNNING")
        
        import requests
        
        test_endpoints = [
            "https://edsteward.ai/api/test",
            "https://edsteward.ai/api/db-direct",
            "https://edsteward.ai/api/db-stats"
        ]
        
        for endpoint in test_endpoints:
            try:
                response = requests.get(endpoint, timeout=10)
                if response.status_code == 200:
                    self.log(f"✅ {endpoint} - SUCCESS (200)")
                    if 'json' in response.headers.get('content-type', ''):
                        data = response.json()
                        self.log(f"   Response: {json.dumps(data, indent=2)[:100]}...")
                else:
                    self.log(f"❌ {endpoint} - FAILED ({response.status_code})")
                    
            except Exception as e:
                self.log(f"❌ {endpoint} - ERROR: {e}")
        
        # Test if emergency endpoints exist (they should if new code deployed)
        try:
            response = requests.get("https://edsteward.ai/api/db-direct", timeout=10)
            if response.status_code == 200:
                self.log("✅ NEW EMERGENCY ENDPOINTS ARE WORKING!")
                return True
            else:
                self.log("❌ Emergency endpoints still returning 404 - OLD CODE STILL RUNNING")
                return False
        except:
            self.log("❌ Cannot reach emergency endpoints - deployment may have failed")
            return False
    
    def fix_deployment_system(self):
        """Main method to fix the deployment system"""
        self.log("🚨 STARTING EMERGENCY ECS DEPLOYMENT FIX")
        self.log("=" * 60)
        
        try:
            # Step 1: Get current state
            self.log("STEP 1: Analyzing current deployment state")
            self.get_current_service_info()
            
            # Step 2: Get latest image
            self.log("\nSTEP 2: Finding latest Docker image")
            latest_tag = self.get_latest_image_tag()
            
            # Step 3: Create new task definition
            self.log("\nSTEP 3: Creating new task definition")
            new_task_def_arn = self.create_new_task_definition(latest_tag)
            
            # Step 4: Force stop current tasks (CRITICAL)
            self.log("\nSTEP 4: Force stopping current tasks")
            self.force_stop_current_tasks()
            
            # Step 5: Update service with force deployment
            self.log("\nSTEP 5: Updating service with new task definition")
            deployment_id = self.update_service_with_new_task_definition(new_task_def_arn)
            
            # Step 6: Monitor deployment
            self.log("\nSTEP 6: Monitoring deployment progress")
            success = self.monitor_deployment()
            
            if success:
                # Step 7: Verify new code
                self.log("\nSTEP 7: Verifying new code is running")
                code_updated = self.verify_new_code_running()
                
                if code_updated:
                    self.log("\n🎉 DEPLOYMENT FIX SUCCESSFUL!")
                    self.log("✅ New code is running")
                    self.log("✅ Emergency database endpoints are working")
                    self.log("✅ Deployment system is fixed")
                else:
                    self.log("\n⚠️  DEPLOYMENT COMPLETED BUT OLD CODE STILL RUNNING")
                    self.log("Manual investigation required")
            else:
                self.log("\n❌ DEPLOYMENT FAILED OR TIMED OUT")
                self.log("Manual intervention required")
                
        except Exception as e:
            self.log(f"\n💥 CRITICAL ERROR: {e}")
            self.log("Manual intervention required")
            raise

if __name__ == "__main__":
    fixer = ECSDeploymentFixer()
    fixer.fix_deployment_system() 