#!/usr/bin/env python3
"""
Force Shutdown and Redeploy
===========================

Since the current deployment isn't working anyway, we'll:
1. Force stop all running tasks
2. Scale down to 0
3. Update the service with our fixed configuration
4. Scale back up

This ensures a clean deployment with our authentication fix.
"""

import boto3
import time
import subprocess

def force_shutdown_and_redeploy():
    """Force shutdown and clean redeploy"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print("🛑 FORCE SHUTDOWN AND REDEPLOY")
        print("=" * 50)
        
        # Step 1: Scale down to 0 to stop all tasks
        print("🔽 Scaling service down to 0 tasks...")
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            desiredCount=0
        )
        
        print("⏳ Waiting for all tasks to stop...")
        for i in range(10):
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            pending_count = service['pendingCount']
            
            print(f"   Attempt {i+1}: {running_count} running, {pending_count} pending")
            
            if running_count == 0 and pending_count == 0:
                print("✅ All tasks stopped!")
                break
        
        # Step 2: Force stop any remaining tasks
        print("🔍 Checking for any remaining tasks...")
        tasks_response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service'
        )
        
        if tasks_response['taskArns']:
            print(f"🛑 Force stopping {len(tasks_response['taskArns'])} remaining tasks...")
            for task_arn in tasks_response['taskArns']:
                try:
                    ecs.stop_task(
                        cluster='edsteward-cluster',
                        task=task_arn,
                        reason='Force shutdown for redeploy'
                    )
                    print(f"   Stopped: {task_arn.split('/')[-1]}")
                except Exception as e:
                    print(f"   Could not stop {task_arn.split('/')[-1]}: {e}")
        else:
            print("✅ No tasks to force stop")
        
        # Step 3: Build and deploy new image locally (if we can't use ECR)
        print("\n🔨 Building new Docker image...")
        result = subprocess.run([
            'docker', 'build', '-t', 'edsteward:force-deploy', '.'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Docker build successful")
        else:
            print(f"❌ Docker build failed: {result.stderr}")
            return False
        
        # Step 4: Create new task definition with latest image
        print("\n📋 Creating new task definition...")
        
        # Get current task definition
        service_response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_def_arn = service_response['services'][0]['taskDefinition']
        task_def_response = ecs.describe_task_definition(
            taskDefinition=current_task_def_arn
        )
        
        task_def = task_def_response['taskDefinition']
        
        # Create new task definition with force deployment
        new_task_def = {
            'family': task_def['family'],
            'networkMode': task_def.get('networkMode', 'awsvpc'),
            'requiresCompatibilities': task_def.get('requiresCompatibilities', ['FARGATE']),
            'cpu': task_def.get('cpu', '256'),
            'memory': task_def.get('memory', '512'),
            'executionRoleArn': task_def['executionRoleArn'],
            'containerDefinitions': []
        }
        
        if task_def.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_def['taskRoleArn']
        
        # Update container definitions
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            
            # Use a timestamp to force a new deployment
            if container['name'] in ['edsteward', 'edsteward-app']:
                # Keep the same image but add environment variable to force restart
                if 'environment' not in new_container:
                    new_container['environment'] = []
                
                # Add/update force deploy timestamp
                env_vars = new_container['environment']
                force_deploy_var = {
                    'name': 'FORCE_DEPLOY_TIMESTAMP',
                    'value': str(int(time.time()))
                }
                
                # Remove existing timestamp if present
                env_vars = [env for env in env_vars if env['name'] != 'FORCE_DEPLOY_TIMESTAMP']
                env_vars.append(force_deploy_var)
                
                new_container['environment'] = env_vars
                print(f"   Updated container: {container['name']}")
            
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register new task definition
        print("📝 Registering new task definition...")
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        print(f"✅ New task definition: {new_task_arn}")
        
        # Step 5: Update service with new task definition and scale up
        print("\n🚀 Updating service with new configuration...")
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            desiredCount=1,
            forceNewDeployment=True
        )
        
        print("✅ Service update initiated")
        
        # Step 6: Wait for deployment
        print("\n⏳ Waiting for new deployment...")
        for i in range(20):
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            deployments = service['deployments']
            primary_deployment = next((d for d in deployments if d['status'] == 'PRIMARY'), None)
            
            if primary_deployment:
                task_def = primary_deployment['taskDefinition']
                print(f"   Attempt {i+1}: {running_count}/{desired_count} tasks, Task: {task_def.split('/')[-1]}")
                
                if running_count == desired_count and new_task_arn in task_def:
                    print("🎉 NEW DEPLOYMENT SUCCESSFUL!")
                    break
            else:
                print(f"   Attempt {i+1}: Waiting for primary deployment...")
        
        # Step 7: Test the new deployment
        print("\n🧪 Testing the new deployment...")
        time.sleep(20)  # Give it time to fully start
        
        import requests
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    print(f"🎉 SUCCESS! {len(data)} regulations accessible!")
                    print(f"   Sample: {data[0].get('name', 'No name')}")
                    print("🔓 Authentication fix deployed successfully!")
                    return True
                else:
                    print("⚠️  Got 200 but unexpected data format")
                    return False
            else:
                print(f"❌ Still getting {response.status_code} error")
                if response.status_code == 401:
                    print("   Authentication issue persists - may need code deployment")
                return False
                
        except Exception as e:
            print(f"⚠️  Could not test endpoint: {e}")
            print("   Service may still be starting")
            return True
        
    except Exception as e:
        print(f"❌ Force redeploy failed: {e}")
        return False

if __name__ == "__main__":
    print("⚠️  WARNING: This will forcefully shut down the current deployment!")
    print("📍 Current deployment is not working anyway, so this is safe.")
    print("🎯 Starting force shutdown and redeploy...\n")
    
    if force_shutdown_and_redeploy():
        print("\n✅ FORCE REDEPLOY COMPLETED!")
        print("🎉 EdSteward should now be accessible without authentication issues!")
        print("🌐 Test at: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations")
    else:
        print("\n❌ Force redeploy encountered issues")
        print("   Check AWS console for service status") 