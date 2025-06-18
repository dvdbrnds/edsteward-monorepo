#!/usr/bin/env python3
"""
Check Deployment Status
======================

Check the current ECS deployment status and test the endpoint.
"""

import boto3
import requests
import time

def check_deployment_status():
    """Check the current deployment status"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🔍 Checking current ECS service status...')
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        running_count = service['runningCount']
        desired_count = service['desiredCount']
        task_definition = service['taskDefinition']
        service_status = service['status']
        
        print(f'📊 Service Status: {service_status}')
        print(f'📋 Running Tasks: {running_count}/{desired_count}')
        print(f'🔧 Task Definition: {task_definition}')
        
        # Check deployments
        deployments = service['deployments']
        print(f'\n📦 Deployments ({len(deployments)}):')
        for i, deployment in enumerate(deployments):
            status = deployment['status']
            task_def = deployment['taskDefinition']
            created_at = deployment['createdAt']
            print(f'  {i+1}. {status} - {task_def.split("/")[-1]} (Created: {created_at})')
        
        # Test endpoint
        print('\n🧪 Testing endpoint...')
        
        for attempt in range(3):
            try:
                print(f'  Attempt {attempt + 1}/3...')
                response = requests.get(
                    'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations', 
                    timeout=15
                )
                
                print(f'  Status: {response.status_code}')
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        print(f'  🎉 SUCCESS! {len(data)} regulations accessible!')
                        if len(data) > 0:
                            print(f'  Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                        return True
                    else:
                        print(f'  Unexpected data format: {type(data)}')
                elif response.status_code == 401:
                    print(f'  ❌ 401 Unauthorized - Authentication fix not yet deployed')
                elif response.status_code == 503:
                    print(f'  ⏳ 503 Service Unavailable - Deployment in progress')
                elif response.status_code == 502:
                    print(f'  ⏳ 502 Bad Gateway - Service starting up')
                else:
                    print(f'  Response: {response.text[:100]}...')
                    
            except requests.exceptions.Timeout:
                print(f'  ⏳ Request timed out - service may be starting')
            except requests.exceptions.ConnectionError:
                print(f'  ⏳ Connection error - service may be restarting')
            except Exception as e:
                print(f'  ❌ Error: {e}')
            
            if attempt < 2:
                print(f'  Waiting 30 seconds before retry...')
                time.sleep(30)
        
        return False
        
    except Exception as e:
        print(f'❌ Failed to check deployment status: {e}')
        return False

if __name__ == "__main__":
    print("🚀 DEPLOYMENT STATUS CHECK")
    print("=" * 50)
    
    success = check_deployment_status()
    
    if success:
        print("\n✅ DEPLOYMENT SUCCESSFUL!")
        print("🎉 Authentication fix is live!")
        print("🌐 Regulations are now accessible without authentication issues")
    else:
        print("\n⏳ DEPLOYMENT IN PROGRESS")
        print("💭 The deployment may still be completing")
        print("🔄 Run this script again in a few minutes to check status") 