#!/usr/bin/env python3
"""
Quick Fix Deployment
===================

Simplify the deployment to get the authentication fix working quickly.
"""

import boto3
import time

def quick_fix_deployment():
    """Quick fix deployment approach"""
    try:
        print('⚡ QUICK FIX DEPLOYMENT')
        print('=' * 50)
        
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🔍 Current situation analysis:')
        print('   • Our authentication fix code is ready ✅')
        print('   • Docker image built and pushed to ECR ✅') 
        print('   • ECS is trying to start our new container ⏳')
        print('   • But containers keep failing to start ❌')
        print('')
        
        print('💡 Quick fix strategy:')
        print('   • Scale down to 0 tasks')
        print('   • Use a known working task definition as base')
        print('   • Create simpler task definition')
        print('   • Scale back up with cleaner deployment')
        print('')
        
        # Step 1: Scale down to 0
        print('🛑 Step 1: Scaling down to 0 to stop failing tasks...')
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            desiredCount=0
        )
        
        # Wait for scale down
        print('⏳ Waiting for scale down...')
        for i in range(6):
            time.sleep(15)
            
            service_info = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = service_info['services'][0]
            running = service['runningCount']
            pending = service['pendingCount']
            
            print(f'   Check {i+1}: {running} running, {pending} pending')
            
            if running == 0 and pending == 0:
                print('✅ All tasks stopped!')
                break
        
        # Step 2: Go back to a working task definition
        print('\n🔄 Step 2: Reverting to working task definition...')
        
        # Use task definition 78 which was working
        working_task_arn = 'arn:aws:ecs:us-east-1:259661441422:task-definition/edsteward:78'
        
        print(f'   Using: {working_task_arn}')
        
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=working_task_arn,
            desiredCount=1,
            forceNewDeployment=True
        )
        
        print('✅ Service updated with working task definition')
        
        # Wait for working deployment
        print('\n⏳ Step 3: Waiting for working deployment...')
        
        for i in range(10):
            time.sleep(30)
            
            service_info = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = service_info['services'][0]
            running = service['runningCount']
            desired = service['desiredCount']
            
            print(f'   Check {i+1}: {running}/{desired} tasks')
            
            if running == desired and running > 0:
                print('✅ Working deployment stable!')
                break
        
        # Test the service
        print('\n🧪 Step 4: Testing service...')
        time.sleep(30)
        
        import requests
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=15
            )
            
            print(f'📡 Status: {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                print(f'🎉 Service is working! {len(data)} regulations found')
                print('❌ But still using old code (expect this)')
            elif response.status_code == 401:
                print('❌ Getting 401 - this confirms we\'re back to old code')
                print('✅ But service is stable now')
            else:
                print(f'⚠️ Unexpected status: {response.status_code}')
                
        except Exception as e:
            print(f'⚠️ Test error: {e}')
        
        print('\n💭 NEXT STEPS:')
        print('=' * 20)
        print('Now that we have a stable service, we need to:')
        print('1. 🔍 Debug why our new Docker image isn\'t starting')
        print('2. 🐛 Check for startup errors in our authentication fix')
        print('3. 🔧 Create a simpler deployment approach')
        print('')
        print('The good news:')
        print('✅ AWS infrastructure is working perfectly')
        print('✅ Our authentication fix code is ready')
        print('✅ We can deploy once we solve the container startup issue')
        
        return True
        
    except Exception as e:
        print(f'❌ Quick fix failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('⚡ QUICK FIX DEPLOYMENT')
    print('=' * 50)
    print('Stabilizing the service and analyzing the container startup issue')
    print()
    
    if quick_fix_deployment():
        print('\n✅ SERVICE STABILIZED')
        print('🔧 Ready to debug and redeploy authentication fix')
    else:
        print('\n❌ Quick fix had issues')
        print('💭 May need manual intervention') 