#!/usr/bin/env python3
import requests
import json
import re
from bs4 import BeautifulSoup

BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

def test_frontend_loading():
    """Test if the frontend loads and what it shows"""
    try:
        print("🔧 Testing frontend loading...")
        response = requests.get(BASE_URL, timeout=15)
        
        if response.status_code == 200:
            print("✅ Frontend loads successfully")
            
            # Parse HTML to see what's actually there
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Check for common error indicators
            if "Unable to Load Regulations" in response.text:
                print("❌ FOUND: 'Unable to Load Regulations' error message")
            
            if "503 Service" in response.text:
                print("❌ FOUND: 503 Service error")
            
            if "404" in response.text:
                print("❌ FOUND: 404 error")
            
            # Check for React app indicators
            if 'id="root"' in response.text:
                print("✅ React app container found")
            
            # Check for any JavaScript errors in console (if visible in HTML)
            script_tags = soup.find_all('script')
            print(f"📄 Found {len(script_tags)} script tags")
            
            # Look for any visible error messages
            error_indicators = [
                "error", "Error", "ERROR", 
                "failed", "Failed", "FAILED",
                "unable", "Unable", "UNABLE"
            ]
            
            visible_text = soup.get_text()
            for indicator in error_indicators:
                if indicator in visible_text:
                    # Find context around the error
                    lines = visible_text.split('\n')
                    for i, line in enumerate(lines):
                        if indicator in line:
                            print(f"⚠️  Found '{indicator}' in: {line.strip()}")
                            break
            
            return True, response.text
        else:
            print(f"❌ Frontend failed to load: {response.status_code}")
            return False, response.text
            
    except Exception as e:
        print(f"❌ Frontend test error: {e}")
        return False, str(e)

def test_api_calls_from_frontend():
    """Test the API calls that the frontend would make"""
    print("\n🔧 Testing API calls that frontend makes...")
    
    # Test the main endpoints the frontend calls
    endpoints = [
        "/api/regulations",
        "/api/public/regulations", 
        "/api/deadlines",
        "/api/notifications",
        "/api/setup/status"
    ]
    
    results = {}
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        print(f"✅ {endpoint}: {len(data)} items")
                        results[endpoint] = f"SUCCESS: {len(data)} items"
                    else:
                        print(f"✅ {endpoint}: {type(data).__name__}")
                        results[endpoint] = f"SUCCESS: {type(data).__name__}"
                except:
                    print(f"✅ {endpoint}: Non-JSON response")
                    results[endpoint] = "SUCCESS: Non-JSON"
            elif response.status_code == 401:
                print(f"🔐 {endpoint}: Authentication required")
                results[endpoint] = "AUTH_REQUIRED"
            elif response.status_code == 404:
                print(f"❌ {endpoint}: Not found")
                results[endpoint] = "NOT_FOUND"
            else:
                print(f"❌ {endpoint}: {response.status_code}")
                results[endpoint] = f"ERROR: {response.status_code}"
        except Exception as e:
            print(f"❌ {endpoint}: {e}")
            results[endpoint] = f"ERROR: {e}"
    
    return results

def check_network_requests():
    """Check what network requests the frontend might be making"""
    print("\n🔧 Checking for JavaScript fetch/API calls in frontend code...")
    
    try:
        response = requests.get(BASE_URL, timeout=10)
        if response.status_code == 200:
            # Look for fetch calls or API endpoints in the JavaScript
            js_patterns = [
                r'fetch\(["\']([^"\']+)["\']',
                r'axios\.get\(["\']([^"\']+)["\']',
                r'"/api/[^"]*"',
                r"'/api/[^']*'"
            ]
            
            found_apis = set()
            for pattern in js_patterns:
                matches = re.findall(pattern, response.text)
                for match in matches:
                    if '/api/' in match:
                        found_apis.add(match)
            
            if found_apis:
                print("📡 Found API endpoints in frontend code:")
                for api in sorted(found_apis):
                    print(f"   {api}")
            else:
                print("⚠️  No API endpoints found in frontend code")
                
            return found_apis
        
    except Exception as e:
        print(f"❌ Error checking network requests: {e}")
        return set()

def main():
    print("🚀 Frontend Reality Check")
    print("=" * 50)
    
    # Test frontend loading
    frontend_works, content = test_frontend_loading()
    
    # Test API endpoints
    api_results = test_api_calls_from_frontend()
    
    # Check for API calls in frontend code
    found_apis = check_network_requests()
    
    print("\n" + "=" * 50)
    print("📊 FRONTEND REALITY CHECK SUMMARY")
    print("=" * 50)
    
    if frontend_works:
        print("✅ Frontend loads successfully")
    else:
        print("❌ Frontend fails to load")
    
    # Check if regulations are actually accessible
    if api_results.get("/api/public/regulations", "").startswith("SUCCESS"):
        print("✅ Regulations data is accessible via /api/public/regulations")
    else:
        print("❌ Regulations data is NOT accessible")
    
    if api_results.get("/api/regulations") == "AUTH_REQUIRED":
        print("🔐 /api/regulations requires authentication (expected)")
    elif api_results.get("/api/regulations", "").startswith("SUCCESS"):
        print("✅ /api/regulations works without auth")
    else:
        print("❌ /api/regulations is broken")
    
    # Check if frontend is calling the right endpoints
    if "/api/regulations" in found_apis and "/api/public/regulations" not in found_apis:
        print("⚠️  PROBLEM: Frontend is calling /api/regulations (auth required) instead of /api/public/regulations")
        print("💡 SOLUTION: Frontend needs to be updated to call /api/public/regulations")
    elif "/api/public/regulations" in found_apis:
        print("✅ Frontend is calling /api/public/regulations (correct)")
    else:
        print("⚠️  Cannot determine which API endpoints frontend is calling")
    
    # Final diagnosis
    print("\n🔍 DIAGNOSIS:")
    if not frontend_works:
        print("❌ Frontend is completely broken")
    elif api_results.get("/api/public/regulations", "").startswith("SUCCESS"):
        if "/api/regulations" in found_apis and "/api/public/regulations" not in found_apis:
            print("❌ Frontend loads but calls wrong API endpoint")
            print("   Frontend is calling /api/regulations (needs auth)")
            print("   But data is available at /api/public/regulations")
        else:
            print("⚠️  Frontend loads and data is available, but something else is wrong")
            print("   Need to check browser console for JavaScript errors")
    else:
        print("❌ No regulations data available at any endpoint")

if __name__ == "__main__":
    main() 