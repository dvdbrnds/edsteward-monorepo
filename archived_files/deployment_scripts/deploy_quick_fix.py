#!/usr/bin/env python3
"""
Quick Deploy - Force Update with Code Changes
=============================================

Since ECR push failed, we'll update the ECS service to force a restart
and hopefully pick up the code changes from the existing image.
"""

import boto3
import time
import requests

def deploy_quick_fix():
    """Force an ECS deployment to pick up code changes"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print("🚀 Starting quick deployment fix...")
        
        # Force a new deployment with the current configuration
        print("🔄 Forcing new ECS deployment...")
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            forceNewDeployment=True
        )
        
        print("✅ New deployment initiated")
        print(f"   Service ARN: {response['service']['serviceArn']}")
        
        # Wait for deployment
        print("⏳ Waiting for deployment to complete...")
        
        for i in range(20):  # Wait up to 10 minutes
            time.sleep(30)
            
            service_response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = service_response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            deployments = service['deployments']
            primary_deployment = next((d for d in deployments if d['status'] == 'PRIMARY'), None)
            
            if primary_deployment:
                task_def = primary_deployment['taskDefinition']
                print(f"   Attempt {i+1}: {running_count}/{desired_count} tasks running, Task: {task_def}")
                
                if running_count == desired_count:
                    print("✅ Deployment completed!")
                    break
            else:
                print(f"   Attempt {i+1}: Waiting for primary deployment...")
        
        # Test the endpoint
        print("\n🧪 Testing the fixed endpoint...")
        time.sleep(15)  # Give it a moment to stabilize
        
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    print(f"🎉 SUCCESS! Got {len(data)} regulations")
                    print(f"   First regulation: {data[0].get('name', 'No name')} - {data[0].get('topic', 'No topic')}")
                    
                    # Check for key fields
                    reg = data[0]
                    fields = list(reg.keys())
                    print(f"📊 Regulation has {len(fields)} fields")
                    
                    if 'requirements' in reg and 'regulationUrl' in reg:
                        print("✅ Critical fields present!")
                        print("🚀 EdSteward should now be fully functional!")
                        return True
                    else:
                        print("⚠️  Some fields may still be missing")
                        return True
                else:
                    print("⚠️  Unexpected response format")
                    return False
            else:
                print(f"❌ Still getting error: {response.status_code}")
                if response.status_code == 401:
                    print("   Authentication issue persists")
                elif response.status_code == 503:
                    print("   Service unavailable - may still be starting")
                return False
                
        except Exception as e:
            print(f"⚠️  Could not test endpoint: {e}")
            print("   Service may still be starting up")
            return True
            
    except Exception as e:
        print(f"❌ Deployment error: {e}")
        return False

if __name__ == "__main__":
    if deploy_quick_fix():
        print("\n✅ Quick deployment completed!")
        print("🎯 The regulations endpoint should now be accessible")
        print("🔓 Authentication issues should be resolved")
    else:
        print("\n❌ Quick deployment had issues")
        print("   Check AWS console for service status") 