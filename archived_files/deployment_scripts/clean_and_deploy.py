#!/usr/bin/env python3
"""
Clean and Deploy
===============

Clean up multiple concurrent deployments and force a single clean deployment.
"""

import boto3
import time

def clean_and_deploy():
    """Clean up deployments and force a single deployment"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🧹 CLEANING UP CONCURRENT DEPLOYMENTS')
        print('=' * 50)
        
        # First, let's see what we have
        print('📋 Current service state:')
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        deployments = service['deployments']
        
        print(f'   Service: {service["serviceName"]}')
        print(f'   Tasks: {service["runningCount"]}/{service["desiredCount"]}')
        print(f'   Deployments: {len(deployments)}')
        
        for i, deployment in enumerate(deployments):
            print(f'     {i+1}. {deployment["status"]} - {deployment["taskDefinition"].split("/")[-1]}')
        
        # Step 1: Scale down to 0 to stop all tasks
        print('\n🛑 Scaling down to 0 tasks...')
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            desiredCount=0
        )
        
        # Wait for all tasks to stop
        print('⏳ Waiting for all tasks to stop...')
        for i in range(10):
            time.sleep(20)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            pending_count = service['pendingCount']
            
            print(f'   Check {i+1}: {running_count} running, {pending_count} pending')
            
            if running_count == 0 and pending_count == 0:
                print('✅ All tasks stopped!')
                break
        
        # Step 2: Get the latest task definition (should have our code fix)
        print('\n📋 Finding latest task definition...')
        task_families = ecs.list_task_definitions(
            familyPrefix='edsteward',
            status='ACTIVE',
            sort='DESC'
        )
        
        if task_families['taskDefinitionArns']:
            latest_task = task_families['taskDefinitionArns'][0]
            print(f'✅ Latest task definition: {latest_task}')
        else:
            print('❌ No task definitions found')
            return False
        
        # Step 3: Update service with latest task definition and scale up
        print(f'\n🚀 Deploying with clean single deployment...')
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=latest_task,
            desiredCount=1,
            forceNewDeployment=True
        )
        
        print('✅ Clean deployment initiated')
        
        # Step 4: Wait for new deployment to be stable
        print('\n⏳ Waiting for deployment to stabilize...')
        for i in range(15):
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            deployments = service['deployments']
            
            print(f'   Check {i+1}: {running_count}/{desired_count} tasks, {len(deployments)} deployments')
            
            # Check if we have a single PRIMARY deployment
            primary_deployments = [d for d in deployments if d['status'] == 'PRIMARY']
            if len(primary_deployments) == 1 and running_count == desired_count:
                print('🎉 Deployment stabilized with single PRIMARY deployment!')
                
                # Give it time to fully start
                print('⏱️  Allowing startup time...')
                time.sleep(60)
                
                # Test the deployment
                print('\n🧪 Testing clean deployment...')
                import requests
                
                try:
                    response = requests.get(
                        'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                        timeout=30
                    )
                    
                    print(f'📡 Status: {response.status_code}')
                    
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, list) and len(data) > 0:
                            print(f'🎉 SUCCESS! {len(data)} regulations accessible!')
                            print(f'   Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                            return True
                        else:
                            print('⚠️ Got 200 but unexpected data')
                    elif response.status_code == 401:
                        print('❌ Still 401 - code fix may not be in this deployment')
                    else:
                        print(f'⚠️ Status {response.status_code}: {response.text[:100]}...')
                        
                except Exception as e:
                    print(f'⚠️ Test error: {e}')
                
                return False
        
        print('⚠️ Deployment did not stabilize within expected time')
        return False
        
    except Exception as e:
        print(f'❌ Clean deployment failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('🚀 CLEAN AND DEPLOY')
    print('=' * 50)
    print('This will clean up concurrent deployments and force a single deployment')
    print()
    
    if clean_and_deploy():
        print('\n✅ CLEAN DEPLOYMENT SUCCESSFUL!')
        print('🎉 Authentication fix should now be live!')
    else:
        print('\n⚠️ Deployment needs attention')
        print('💭 Check AWS console for service status') 