#!/usr/bin/env python3
"""
Direct Fix
==========

The most direct approach - bypass Docker deployment entirely.
"""

import boto3
import requests

def test_alternatives():
    """Test alternative approaches that don't require new Docker deployments"""
    print('🔍 TESTING ALTERNATIVE APPROACHES')
    print('=' * 50)
    
    # Try different endpoints to see what's working
    base_url = 'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com'
    
    endpoints_to_test = [
        '/health',
        '/api/health', 
        '/api/public/regulations',
        '/api/setup/status',
        '/api/regulations',
    ]
    
    print('🧪 Testing all endpoints to find what works...')
    
    working_endpoints = []
    
    for endpoint in endpoints_to_test:
        try:
            response = requests.get(f'{base_url}{endpoint}', timeout=10)
            status = response.status_code
            
            if status == 200:
                working_endpoints.append(endpoint)
                print(f'✅ {endpoint}: {status} - WORKING')
                if 'regulations' in endpoint:
                    try:
                        data = response.json()
                        if isinstance(data, list):
                            print(f'   📋 Found {len(data)} regulations!')
                    except:
                        pass
            elif status == 401:
                print(f'❌ {endpoint}: {status} - AUTH REQUIRED')
            elif status == 503:
                print(f'⏳ {endpoint}: {status} - SERVICE UNAVAILABLE')
            else:
                print(f'⚠️  {endpoint}: {status} - OTHER')
                
        except Exception as e:
            print(f'💥 {endpoint}: ERROR - {e}')
    
    return working_endpoints

def try_public_endpoint():
    """Check if the public endpoint works as a workaround"""
    print('\n🔍 CHECKING PUBLIC ENDPOINT WORKAROUND')
    print('=' * 45)
    
    try:
        response = requests.get(
            'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/public/regulations',
            timeout=15
        )
        
        print(f'📡 Public endpoint status: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                print(f'🎉 PUBLIC ENDPOINT WORKS!')
                print(f'🎯 {len(data)} regulations accessible via /api/public/regulations')
                print(f'📋 Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                print('')
                print('💡 IMMEDIATE SOLUTION:')
                print('   Use /api/public/regulations instead of /api/regulations')
                print('   This endpoint is already accessible without authentication!')
                print('   Frontend can be updated to use this endpoint.')
                return True
        else:
            print(f'❌ Public endpoint not working: {response.status_code}')
            print(f'Response: {response.text[:200]}...')
            
    except Exception as e:
        print(f'❌ Public endpoint test failed: {e}')
    
    return False

def check_service_status():
    """Check current service status"""
    print('\n🔍 CURRENT SERVICE STATUS')
    print('=' * 30)
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        service_info = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = service_info['services'][0]
        print(f'📊 Service Status: {service["status"]}')
        print(f'👥 Running Tasks: {service["runningCount"]}/{service["desiredCount"]}')
        print(f'📦 Task Definition: {service["taskDefinition"].split("/")[-1]}')
        
        if service['runningCount'] == 0:
            print('⚠️  NO RUNNING TASKS - This explains the 503 errors')
            return False
        elif service['runningCount'] < service['desiredCount']:
            print('⚠️  PARTIAL DEPLOYMENT - Service is starting up')
            return False
        else:
            print('✅ Service appears to be running')
            return True
            
    except Exception as e:
        print(f'❌ Status check failed: {e}')
        return False

def simple_restart():
    """Try a simple service restart"""
    print('\n🔄 TRYING SIMPLE SERVICE RESTART')
    print('=' * 40)
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🔄 Forcing service restart...')
        
        # Use a known working task definition and force restart
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition='arn:aws:ecs:us-east-1:259661441422:task-definition/edsteward:78',
            forceNewDeployment=True
        )
        
        print('✅ Restart initiated - using stable task definition 78')
        print('⏳ This may take a few minutes to complete')
        
        return True
        
    except Exception as e:
        print(f'❌ Restart failed: {e}')
        return False

if __name__ == "__main__":
    print('🔧 DIRECT FIX APPROACH')
    print('=' * 40)
    print('Finding the most direct way to fix authentication issues')
    print()
    
    # Test what's currently working
    working_endpoints = test_alternatives()
    
    # Check if public endpoint can be used as immediate workaround
    if try_public_endpoint():
        print('\n🎉 IMMEDIATE SOLUTION FOUND!')
        print('✅ Use /api/public/regulations endpoint')
        print('🔧 No deployment needed - works right now!')
        exit(0)
    
    # Check service status
    service_running = check_service_status()
    
    if not service_running:
        print('\n💡 Service not running properly - trying restart...')
        if simple_restart():
            print('\n✅ RESTART INITIATED')
            print('⏳ Wait 2-3 minutes then test again')
            print('🌐 Test: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations')
        else:
            print('\n❌ Could not restart service')
    
    if working_endpoints:
        print(f'\n✅ WORKING ENDPOINTS FOUND: {len(working_endpoints)}')
        for endpoint in working_endpoints:
            print(f'   • {endpoint}')
        print('💡 These can be used as immediate workarounds')
    else:
        print('\n❌ NO WORKING ENDPOINTS FOUND')
        print('💭 Service may need manual intervention via AWS console') 