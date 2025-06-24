#!/usr/bin/env python3
"""
Restart ECS Service
===================

Force a service restart to pick up any configuration changes.
"""

import boto3
import time
import requests

def restart_ecs_service():
    """Force restart the ECS service"""
    print("🔄 Restarting ECS service...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            forceNewDeployment=True
        )
        
        print("✅ Service restart initiated")
        return True
        
    except Exception as e:
        print(f"❌ Failed to restart service: {e}")
        return False

def wait_for_service():
    """Wait for the service to come online"""
    print("⏳ Waiting for service to come online...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        for i in range(30):  # Wait up to 5 minutes
            time.sleep(10)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            print(f"   Status: {running_count}/{desired_count} tasks running")
            
            if running_count >= desired_count and running_count > 0:
                print("✅ Service is running!")
                return True
        
        print("⚠️  Service restart timeout")
        return False
        
    except Exception as e:
        print(f"❌ Error waiting for service: {e}")
        return False

def test_endpoint():
    """Test the regulations endpoint"""
    print("🧪 Testing regulations endpoint...")
    
    try:
        response = requests.get('https://edsteward.blakbytes.tech/api/regulations', timeout=30)
        
        if response.status_code == 200:
            regulations = response.json()
            count = len(regulations)
            print(f"✅ SUCCESS: {count} regulations accessible!")
            
            if count > 0:
                sample = regulations[0]
                print(f"   Sample: {sample.get('name', 'No name')}")
            
            return True
        else:
            print(f"❌ Failed: Status {response.status_code}")
            if response.status_code == 401:
                print("   Still requires authentication")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    """Main process"""
    print("🚀 Restarting AWS Service")
    print("=" * 30)
    
    # Step 1: Force restart
    print("\n📋 Step 1: Force Service Restart")
    if not restart_ecs_service():
        return False
    
    # Step 2: Wait for service
    print("\n📋 Step 2: Wait for Service")
    if not wait_for_service():
        print("⚠️  Service may have issues")
    
    # Step 3: Test endpoint
    print("\n📋 Step 3: Test Endpoint")
    if test_endpoint():
        print("\n🎉 Success! Regulations endpoint is working!")
        return True
    else:
        print("\n❌ Endpoint still not working")
        print("💡 The authentication fix may need to be deployed as a new image")
        return False

if __name__ == "__main__":
    main() 