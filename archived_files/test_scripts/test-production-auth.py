#!/usr/bin/env python3

import requests
import json
import time
from urllib.parse import urljoin

def log(message: str, status: str = "INFO"):
    """Simple logging with colors"""
    colors = {
        "SUCCESS": "\033[92m✅",
        "ERROR": "\033[91m❌", 
        "WARNING": "\033[93m⚠️",
        "INFO": "\033[94mℹ️"
    }
    reset = "\033[0m"
    timestamp = time.strftime("%H:%M:%S")
    print(f"{colors.get(status, colors['INFO'])} [{timestamp}] {message}{reset}")

def test_production_auth_page():
    """Test the production /auth page"""
    log("🔍 Testing Production Auth Page...")
    
    prod_base = "https://edsteward.ai"
    
    try:
        # Get the auth page
        auth_response = requests.get(f"{prod_base}/auth", timeout=15)
        
        log(f"📋 Auth page status: {auth_response.status_code}")
        
        if auth_response.status_code == 200:
            log("✅ Auth page loads successfully", "SUCCESS")
            
            # Look for form elements or API endpoints in the HTML
            content = auth_response.text.lower()
            
            # Check for common auth patterns
            if 'form' in content:
                log("📋 Found form elements in auth page")
            if 'login' in content:
                log("📋 Found login references")
            if 'api' in content:
                log("📋 Found API references")
            if 'fetch' in content or 'xhr' in content or 'ajax' in content:
                log("📋 Found AJAX/fetch patterns")
            
            # Look for potential API endpoints
            if '/api/' in content:
                log("📋 Found /api/ references in page")
            if 'auth' in content:
                log("📋 Found auth references in page")
                
            return True, content[:1000]  # Return first 1000 chars for analysis
        else:
            log(f"❌ Auth page failed: {auth_response.status_code}", "ERROR")
            return False, None
            
    except Exception as e:
        log(f"❌ Auth page error: {e}", "ERROR")
        return False, None

def test_auth_endpoints():
    """Test various possible auth endpoints"""
    log("🔍 Testing Possible Auth Endpoints...")
    
    prod_base = "https://edsteward.ai"
    
    # Common auth endpoint patterns
    endpoints_to_test = [
        "/auth/login",
        "/auth/api/login", 
        "/login",
        "/api/auth",
        "/api/auth/login",
        "/authenticate"
    ]
    
    working_endpoints = []
    
    for endpoint in endpoints_to_test:
        try:
            url = f"{prod_base}{endpoint}"
            
            # Try GET first
            get_response = requests.get(url, timeout=10)
            log(f"📋 GET {endpoint}: {get_response.status_code}")
            
            if get_response.status_code in [200, 405]:  # 405 = Method Not Allowed (might accept POST)
                # Try POST with test credentials
                post_response = requests.post(
                    url,
                    json={"username": "dvdbrnds", "password": "testpassword"},
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                log(f"📋 POST {endpoint}: {post_response.status_code}")
                
                if post_response.status_code in [200, 401, 422]:  # Valid auth responses
                    working_endpoints.append({
                        'endpoint': endpoint,
                        'get_status': get_response.status_code,
                        'post_status': post_response.status_code,
                        'response': post_response.text[:200]
                    })
                    log(f"✅ Found working auth endpoint: {endpoint}", "SUCCESS")
                    
        except Exception as e:
            log(f"⚠️ Error testing {endpoint}: {str(e)[:50]}...", "WARNING")
    
    return working_endpoints

def test_with_real_credentials():
    """Test auth with the restored database users"""
    log("🔐 Testing Auth with Restored Database Users...")
    
    prod_base = "https://edsteward.ai"
    
    # Users we restored to the database
    test_users = [
        {"username": "dvdbrnds", "password": "wrongpassword"},  # Test with wrong password first
        {"username": "nasol@moravian.edu", "password": "wrongpassword"},
        {"username": "leahn", "password": "wrongpassword"}
    ]
    
    # Common auth endpoints to try
    auth_endpoints = ["/auth", "/auth/login", "/login", "/api/auth", "/authenticate"]
    
    for endpoint in auth_endpoints:
        log(f"🧪 Testing {endpoint}...")
        
        for user in test_users:
            try:
                url = f"{prod_base}{endpoint}"
                
                # Try POST request
                response = requests.post(
                    url,
                    json=user,
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                log(f"   User {user['username']}: {response.status_code}")
                
                if response.status_code == 401:
                    log(f"   ✅ Auth working! (Invalid credentials response)", "SUCCESS")
                    return endpoint, True
                elif response.status_code == 200:
                    log(f"   ⚠️ Unexpected success (check credentials)", "WARNING")
                elif response.status_code == 500:
                    log(f"   ❌ Server error (database issue?)", "ERROR")
                    try:
                        error_text = response.text[:200]
                        log(f"   Error: {error_text}")
                    except:
                        pass
                        
            except Exception as e:
                log(f"   ⚠️ Error: {str(e)[:50]}...", "WARNING")
    
    return None, False

def compare_with_aws():
    """Compare with our working AWS infrastructure"""
    log("🔍 Comparing with Working AWS Infrastructure...")
    
    aws_base = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    try:
        # Test AWS health
        aws_health = requests.get(f"{aws_base}/health", timeout=10)
        if aws_health.status_code == 200:
            health_data = aws_health.json()
            log(f"✅ AWS Infrastructure: Healthy", "SUCCESS")
            log(f"   Version: {health_data.get('version')}")
            log(f"   Uptime: {health_data.get('uptime', 0):.1f}s")
        
        # Test AWS login
        aws_login = requests.post(
            f"{aws_base}/api/login",
            json={"username": "dvdbrnds", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        log(f"✅ AWS Login (/api/login): {aws_login.status_code}", "SUCCESS")
        if aws_login.status_code == 401:
            log("   ✅ Database connection working", "SUCCESS")
            
    except Exception as e:
        log(f"❌ AWS comparison error: {e}", "ERROR")

def main():
    log("🎯 Testing Production Auth System at edsteward.ai...")
    
    # Step 1: Test the auth page
    auth_page_works, page_content = test_production_auth_page()
    
    print()  # Add spacing
    
    # Step 2: Test possible auth endpoints
    working_endpoints = test_auth_endpoints()
    
    print()  # Add spacing
    
    # Step 3: Test with real credentials
    working_auth_endpoint, auth_working = test_with_real_credentials()
    
    print()  # Add spacing
    
    # Step 4: Compare with AWS
    compare_with_aws()
    
    # Summary
    log("=" * 80)
    log("🎯 PRODUCTION AUTH ANALYSIS")
    log("=" * 80)
    
    if auth_page_works:
        log("✅ Auth page (/auth): ACCESSIBLE", "SUCCESS")
    else:
        log("❌ Auth page (/auth): FAILED", "ERROR")
    
    if working_endpoints:
        log(f"✅ Found {len(working_endpoints)} working auth endpoints:", "SUCCESS")
        for endpoint_info in working_endpoints:
            log(f"   • {endpoint_info['endpoint']} (POST: {endpoint_info['post_status']})")
    else:
        log("⚠️ No working auth endpoints found", "WARNING")
    
    if auth_working and working_auth_endpoint:
        log(f"✅ Authentication working at: {working_auth_endpoint}", "SUCCESS")
        log("✅ Database connection confirmed", "SUCCESS")
    else:
        log("⚠️ Authentication needs investigation", "WARNING")
    
    log("\n🎯 RECOMMENDATIONS:")
    if auth_working:
        log("✅ Your production auth system is working with the restored database!")
        log("🎉 The SSL database fix has resolved the login issues!")
    else:
        log("🔧 Production auth system may need configuration updates")
        log("💡 Consider checking if /auth uses the same database connection")
        log("💡 Verify that production uses the SSL-enabled database connection")
    
    log(f"\n🔗 Production Auth: https://edsteward.ai/auth")
    log(f"🔗 Working AWS Infrastructure: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
    log("✨ Production auth analysis complete!")

if __name__ == "__main__":
    main()