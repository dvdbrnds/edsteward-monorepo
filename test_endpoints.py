#!/usr/bin/env python3
import requests
import json
import time
import subprocess
import os

# Set environment variables to avoid AWS CLI pager issues
os.environ['AWS_PAGER'] = ''
os.environ['AWS_CLI_AUTO_PROMPT'] = 'off'

BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

def test_endpoint(endpoint, description):
    """Test an API endpoint and return the result"""
    try:
        print(f"\n🔧 Testing {description}: {endpoint}")
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    print(f"✅ SUCCESS: {description} - Returned {len(data)} items")
                    if len(data) > 0:
                        print(f"   Sample item keys: {list(data[0].keys()) if isinstance(data[0], dict) else 'Not a dict'}")
                else:
                    print(f"✅ SUCCESS: {description} - Returned: {type(data).__name__}")
                    if isinstance(data, dict):
                        print(f"   Keys: {list(data.keys())}")
                return True, data
            except json.JSONDecodeError:
                print(f"✅ SUCCESS: {description} - Non-JSON response: {response.text[:100]}")
                return True, response.text
        else:
            print(f"❌ FAILED: {description} - Status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False, response.text
            
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: {description} - {str(e)}")
        return False, str(e)

def check_ecs_deployment():
    """Check ECS deployment status"""
    try:
        print("\n🔧 Checking ECS deployment status...")
        result = subprocess.run([
            'aws', 'ecs', 'describe-services',
            '--cluster', 'edsteward-cluster',
            '--services', 'edsteward-service',
            '--region', 'us-east-1',
            '--query', 'services[0].{runningCount:runningCount,desiredCount:desiredCount,status:status}'
        ], capture_output=True, text=True, env=os.environ)
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            print(f"✅ ECS Status: {data}")
            return data.get('runningCount', 0) == data.get('desiredCount', 1)
        else:
            print(f"❌ ECS check failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ ECS check error: {e}")
        return False

def main():
    print("🚀 Testing EdSteward API Endpoints")
    print("=" * 50)
    
    # Check ECS deployment first
    deployment_ready = check_ecs_deployment()
    if not deployment_ready:
        print("\n⚠️  ECS deployment may not be ready, but continuing with tests...")
    
    # Test all the endpoints the frontend expects
    endpoints_to_test = [
        ("/health", "Health Check"),
        ("/api/health", "API Health Check"),
        ("/api/regulations", "Regulations List"),
        ("/api/public/regulations", "Public Regulations List"),
        ("/api/deadlines", "Deadlines List"),
        ("/api/notifications", "Notifications List"),
        ("/api/setup/status", "Setup Status"),
    ]
    
    results = {}
    
    for endpoint, description in endpoints_to_test:
        success, data = test_endpoint(endpoint, description)
        results[endpoint] = {
            'success': success,
            'description': description,
            'data': data if success else None
        }
        time.sleep(1)  # Small delay between requests
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    successful = sum(1 for r in results.values() if r['success'])
    total = len(results)
    
    print(f"✅ Successful: {successful}/{total}")
    print(f"❌ Failed: {total - successful}/{total}")
    
    if successful == total:
        print("\n🎉 ALL ENDPOINTS ARE WORKING!")
        print("The regulations should now be visible in the frontend.")
    else:
        print("\n⚠️  Some endpoints are still failing:")
        for endpoint, result in results.items():
            if not result['success']:
                print(f"   ❌ {result['description']}: {endpoint}")
    
    # Special check for regulations data
    if results.get('/api/regulations', {}).get('success'):
        regs_data = results['/api/regulations']['data']
        if isinstance(regs_data, list) and len(regs_data) > 0:
            print(f"\n📋 Regulations Data: {len(regs_data)} regulations found")
            print(f"   Sample regulation: {regs_data[0].get('name', 'No name')} (ID: {regs_data[0].get('id', 'No ID')})")
        else:
            print(f"\n⚠️  Regulations endpoint returned empty or invalid data")

if __name__ == "__main__":
    main() 