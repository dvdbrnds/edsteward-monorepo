#!/usr/bin/env python3
import requests
import re
import json

BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

def get_frontend_js():
    """Get the frontend JavaScript to see what API calls it makes"""
    try:
        print("🔧 Getting frontend HTML...")
        response = requests.get(BASE_URL, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Failed to get frontend: {response.status_code}")
            return None
            
        html = response.text
        
        # Find script tags with src attributes
        script_pattern = r'<script[^>]*src=["\']([^"\']+)["\'][^>]*>'
        scripts = re.findall(script_pattern, html)
        
        print(f"📄 Found {len(scripts)} external scripts:")
        for script in scripts:
            print(f"   {script}")
        
        # Also check for inline scripts
        inline_pattern = r'<script[^>]*>(.*?)</script>'
        inline_scripts = re.findall(inline_pattern, html, re.DOTALL)
        print(f"📄 Found {len(inline_scripts)} inline scripts")
        
        # Get the main JS file (usually the largest one)
        js_files = []
        for script in scripts:
            if script.startswith('/'):
                js_url = BASE_URL + script
            elif script.startswith('http'):
                js_url = script
            else:
                js_url = BASE_URL + '/' + script
                
            try:
                print(f"🔧 Fetching {js_url}...")
                js_response = requests.get(js_url, timeout=10)
                if js_response.status_code == 200:
                    js_files.append((script, js_response.text))
                    print(f"✅ Got {len(js_response.text)} chars from {script}")
                else:
                    print(f"❌ Failed to get {script}: {js_response.status_code}")
            except Exception as e:
                print(f"❌ Error getting {script}: {e}")
        
        return js_files
        
    except Exception as e:
        print(f"❌ Error getting frontend: {e}")
        return None

def analyze_api_calls(js_files):
    """Analyze JavaScript files for API calls"""
    print("\n🔍 Analyzing API calls in JavaScript...")
    
    all_js = ""
    for filename, content in js_files:
        all_js += content + "\n"
    
    # Look for various API call patterns
    patterns = [
        (r'fetch\s*\(\s*["`\']([^"`\']+)["`\']', 'fetch calls'),
        (r'axios\.get\s*\(\s*["`\']([^"`\']+)["`\']', 'axios.get calls'),
        (r'axios\.post\s*\(\s*["`\']([^"`\']+)["`\']', 'axios.post calls'),
        (r'queryKey:\s*\[\s*["`\']([^"`\']+)["`\']', 'React Query keys'),
        (r'["`\']/api/[^"`\']*["`\']', 'API endpoint strings'),
        (r'useQuery[^{]*{[^}]*queryKey[^}]*}', 'useQuery blocks'),
    ]
    
    found_apis = set()
    
    for pattern, description in patterns:
        matches = re.findall(pattern, all_js, re.IGNORECASE)
        if matches:
            print(f"\n📡 {description}:")
            for match in matches:
                if '/api/' in match:
                    found_apis.add(match)
                    print(f"   {match}")
    
    # Look specifically for regulations-related calls
    print("\n🔍 Looking for regulations-specific patterns...")
    regulations_patterns = [
        r'regulations[^"\']*["\'][^"\']*["\']',
        r'["\'][^"\']*regulations[^"\']*["\']',
        r'queryKey.*regulations',
        r'fetch.*regulations',
    ]
    
    for pattern in regulations_patterns:
        matches = re.findall(pattern, all_js, re.IGNORECASE)
        if matches:
            print(f"📋 Regulations pattern matches:")
            for match in matches:
                print(f"   {match}")
    
    return found_apis

def test_specific_endpoints():
    """Test the specific endpoints we know about"""
    print("\n🔧 Testing specific endpoints...")
    
    endpoints = {
        "/api/regulations": "Main regulations endpoint (requires auth)",
        "/api/public/regulations": "Public regulations endpoint",
        "/api/deadlines": "Deadlines endpoint", 
        "/api/notifications": "Notifications endpoint",
        "/api/setup/status": "Setup status endpoint"
    }
    
    for endpoint, description in endpoints.items():
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        print(f"✅ {endpoint}: {len(data)} items - {description}")
                    else:
                        print(f"✅ {endpoint}: {type(data).__name__} - {description}")
                except:
                    print(f"✅ {endpoint}: Non-JSON response - {description}")
            elif response.status_code == 401:
                print(f"🔐 {endpoint}: Auth required - {description}")
            elif response.status_code == 404:
                print(f"❌ {endpoint}: Not found - {description}")
            else:
                print(f"⚠️  {endpoint}: {response.status_code} - {description}")
        except Exception as e:
            print(f"❌ {endpoint}: Error - {e}")

def main():
    print("🚀 Frontend API Call Debug")
    print("=" * 50)
    
    # Get frontend JavaScript
    js_files = get_frontend_js()
    
    if not js_files:
        print("❌ Could not get frontend JavaScript files")
        return
    
    # Analyze API calls
    found_apis = analyze_api_calls(js_files)
    
    # Test endpoints
    test_specific_endpoints()
    
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    if found_apis:
        print("📡 API endpoints found in frontend code:")
        for api in sorted(found_apis):
            print(f"   {api}")
    else:
        print("⚠️  No clear API endpoints found in frontend code")
    
    print("\n💡 RECOMMENDATIONS:")
    print("1. Check browser console for JavaScript errors")
    print("2. Check if frontend is calling /api/regulations vs /api/public/regulations")
    print("3. Verify authentication flow if needed")

if __name__ == "__main__":
    main() 