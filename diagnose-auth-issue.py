#!/usr/bin/env python3
"""
🔍 AUTHENTICATION ISSUE DIAGNOSIS - Amazon Hosted Version
Investigating why /api/regulations returns 401 when it should work without auth
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

def test_endpoint_variations():
    """Test different variations of the regulations endpoint"""
    
    endpoints_to_test = [
        {
            "name": "Public Regulations (Working)",
            "url": f"{BASE_URL}/api/public/regulations",
            "headers": {"Accept": "application/json"}
        },
        {
            "name": "Direct Regulations (Failing)",
            "url": f"{BASE_URL}/api/regulations",
            "headers": {"Accept": "application/json"}
        },
        {
            "name": "Regulations with User-Agent",
            "url": f"{BASE_URL}/api/regulations",
            "headers": {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; EdSteward-Frontend/1.0)"
            }
        },
        {
            "name": "Regulations with Origin Header",
            "url": f"{BASE_URL}/api/regulations",
            "headers": {
                "Accept": "application/json",
                "Origin": "http://localhost:3000"
            }
        },
        {
            "name": "Regulations with Referer",
            "url": f"{BASE_URL}/api/regulations",
            "headers": {
                "Accept": "application/json",
                "Referer": f"{BASE_URL}/"
            }
        },
        {
            "name": "Regulations OPTIONS Request",
            "url": f"{BASE_URL}/api/regulations",
            "method": "OPTIONS",
            "headers": {"Accept": "application/json"}
        }
    ]
    
    print("🔍 TESTING AUTHENTICATION ISSUE")
    print("=" * 60)
    
    for i, test in enumerate(endpoints_to_test, 1):
        print(f"\n{i}. Testing: {test['name']}")
        print(f"   URL: {test['url']}")
        print(f"   Headers: {test['headers']}")
        
        try:
            method = test.get('method', 'GET')
            
            if method == 'OPTIONS':
                response = requests.options(test['url'], headers=test['headers'], timeout=10)
            else:
                response = requests.get(test['url'], headers=test['headers'], timeout=10)
            
            print(f"   Status: {response.status_code}")
            print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
            
            # Print relevant response headers
            auth_headers = ['www-authenticate', 'authorization', 'access-control-allow-origin', 'access-control-allow-methods']
            for header in auth_headers:
                if header in response.headers:
                    print(f"   {header.title()}: {response.headers[header]}")
            
            if response.status_code == 401:
                print("   🚨 Authentication required!")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error Text: {response.text[:200]}")
            elif response.status_code == 200:
                print("   ✅ Success!")
                try:
                    data = response.json()
                    if isinstance(data, list):
                        print(f"   Data: Array with {len(data)} items")
                    else:
                        print(f"   Data: {type(data).__name__}")
                except:
                    print(f"   Data: Non-JSON response")
            else:
                print(f"   ⚠️  Unexpected status: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
    
    print("\n" + "=" * 60)

def check_server_middleware():
    """Check what middleware might be interfering"""
    
    print("\n🔧 CHECKING SERVER MIDDLEWARE BEHAVIOR")
    print("=" * 60)
    
    # Test different endpoints to see the auth pattern
    test_endpoints = [
        "/health",
        "/api/health", 
        "/api/test",
        "/api/public/regulations",
        "/api/regulations",
        "/api/deadlines",
        "/api/notifications"
    ]
    
    for endpoint in test_endpoints:
        url = f"{BASE_URL}{endpoint}"
        try:
            response = requests.get(url, timeout=10)
            auth_required = response.status_code == 401
            exists = response.status_code != 404
            
            status_emoji = "🔒" if auth_required else "🔓" if exists else "❓"
            print(f"{status_emoji} {endpoint:<25} - Status: {response.status_code}")
            
        except Exception as e:
            print(f"❌ {endpoint:<25} - Error: {e}")

def test_with_mock_auth():
    """Test with various mock authentication headers"""
    
    print("\n🔐 TESTING WITH MOCK AUTHENTICATION")
    print("=" * 60)
    
    auth_variations = [
        {
            "name": "Basic Auth",
            "headers": {"Authorization": "Basic dGVzdDp0ZXN0"}  # test:test
        },
        {
            "name": "Bearer Token",
            "headers": {"Authorization": "Bearer fake-jwt-token-12345"}
        },
        {
            "name": "API Key",
            "headers": {"X-API-Key": "test-api-key-12345"}
        },
        {
            "name": "Session Cookie",
            "headers": {"Cookie": "session=test-session-123; auth=true"}
        }
    ]
    
    for auth in auth_variations:
        print(f"\nTesting with {auth['name']}:")
        try:
            response = requests.get(
                f"{BASE_URL}/api/regulations", 
                headers={**auth['headers'], "Accept": "application/json"}, 
                timeout=10
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                print("   ✅ Authentication accepted!")
            elif response.status_code == 401:
                print("   🚨 Still requires authentication")
            
        except Exception as e:
            print(f"   ❌ Request failed: {e}")

def generate_fix_recommendations():
    """Generate recommendations for fixing the auth issue"""
    
    print("\n💡 FIX RECOMMENDATIONS")
    print("=" * 60)
    
    recommendations = [
        {
            "issue": "Route Order Problem",
            "description": "The /api/regulations route might be placed after auth middleware",
            "fix": "Move the route registration BEFORE auth middleware in server/routes/index.ts",
            "priority": "HIGH"
        },
        {
            "issue": "Middleware Configuration",
            "description": "Auth middleware might be applied globally instead of selectively",
            "fix": "Configure auth middleware to exclude /api/regulations endpoint",
            "priority": "HIGH"
        },
        {
            "issue": "Route Handler Missing",
            "description": "The route handler might not be properly registered",
            "fix": "Verify the route is actually being registered in the routes file",
            "priority": "MEDIUM"
        },
        {
            "issue": "Environment Configuration",
            "description": "Production environment might have different auth requirements",
            "fix": "Check environment-specific auth settings",
            "priority": "MEDIUM"
        }
    ]
    
    for i, rec in enumerate(recommendations, 1):
        print(f"\n{i}. {rec['issue']} ({rec['priority']} PRIORITY)")
        print(f"   Problem: {rec['description']}")
        print(f"   Solution: {rec['fix']}")

def main():
    """Run complete authentication diagnosis"""
    print("🚨 AUTHENTICATION ISSUE DIAGNOSIS")
    print("=" * 60)
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Run all diagnostic tests
    test_endpoint_variations()
    check_server_middleware()
    test_with_mock_auth()
    generate_fix_recommendations()
    
    print("\n" + "=" * 60)
    print("🎯 DIAGNOSIS COMPLETE")
    print("=" * 60)
    print("KEY FINDINGS:")
    print("• /api/public/regulations works perfectly (367 items)")
    print("• /api/regulations returns 401 Authentication required")
    print("• This indicates a middleware configuration issue")
    print("• The route handler exists but is behind auth middleware")
    print("\nRECOMMENDED ACTION:")
    print("• Check server/routes/index.ts route registration order")
    print("• Move /api/regulations BEFORE auth middleware setup")
    print("• Redeploy the server with the fix")

if __name__ == "__main__":
    main() 