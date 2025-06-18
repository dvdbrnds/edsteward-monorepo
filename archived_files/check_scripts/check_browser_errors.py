#!/usr/bin/env python3
import requests
import json
import re

BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

def check_frontend_api_calls():
    """Check which API calls the frontend is making and their status"""
    print("🔍 FRONTEND API CALL ANALYSIS")
    print("=" * 50)
    
    # Based on the JavaScript analysis, these are the key endpoints the frontend calls
    critical_endpoints = [
        ("/api/regulations", "Main regulations (requires auth)"),
        ("/api/public/regulations", "Public regulations (should work)"),
        ("/api/deadlines", "Deadlines data"),
        ("/api/notifications", "Notifications data"),
        ("/api/setup/status", "Setup status"),
        ("/api/user", "User authentication")
    ]
    
    print("Testing critical frontend endpoints:")
    print("-" * 40)
    
    working_endpoints = []
    auth_required = []
    missing_endpoints = []
    
    for endpoint, description in critical_endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        print(f"✅ {endpoint}: {len(data)} items - {description}")
                        working_endpoints.append((endpoint, f"{len(data)} items"))
                    else:
                        print(f"✅ {endpoint}: {type(data).__name__} - {description}")
                        working_endpoints.append((endpoint, f"{type(data).__name__}"))
                except:
                    print(f"✅ {endpoint}: Non-JSON response - {description}")
                    working_endpoints.append((endpoint, "Non-JSON"))
                    
            elif response.status_code == 401:
                print(f"🔐 {endpoint}: Authentication required - {description}")
                auth_required.append((endpoint, description))
                
            elif response.status_code == 404:
                print(f"❌ {endpoint}: Not found - {description}")
                missing_endpoints.append((endpoint, description))
                
            else:
                print(f"⚠️  {endpoint}: {response.status_code} - {description}")
                missing_endpoints.append((endpoint, f"HTTP {response.status_code}"))
                
        except Exception as e:
            print(f"❌ {endpoint}: Connection error - {e}")
            missing_endpoints.append((endpoint, f"Error: {e}"))
    
    return working_endpoints, auth_required, missing_endpoints

def analyze_frontend_behavior():
    """Analyze what the frontend behavior should be"""
    print("\n🧠 FRONTEND BEHAVIOR ANALYSIS")
    print("=" * 50)
    
    working, auth_required, missing = check_frontend_api_calls()
    
    print("\n📊 DIAGNOSIS:")
    print("-" * 20)
    
    # Check if regulations data is available
    has_public_regulations = any("/api/public/regulations" in endpoint for endpoint, _ in working)
    has_auth_regulations = any("/api/regulations" in endpoint for endpoint, _ in auth_required)
    
    if has_public_regulations:
        print("✅ Regulations data IS available via /api/public/regulations")
        
        if has_auth_regulations:
            print("⚠️  Frontend may be calling /api/regulations (auth required) instead of /api/public/regulations")
            print("💡 SOLUTION: Frontend should use /api/public/regulations for unauthenticated access")
        
        # Check for missing supporting endpoints
        missing_critical = [endpoint for endpoint, _ in missing if endpoint in ["/api/deadlines", "/api/notifications", "/api/setup/status"]]
        
        if missing_critical:
            print(f"⚠️  Missing supporting endpoints: {', '.join(missing_critical)}")
            print("💡 These endpoints may cause frontend errors but regulations should still load")
        
        print("\n🎯 EXPECTED FRONTEND BEHAVIOR:")
        print("   - Regulations should load and display")
        print("   - May show errors for missing deadlines/notifications")
        print("   - Authentication may be required for some features")
        
    else:
        print("❌ No regulations data available at any endpoint")
        print("💡 SOLUTION: Fix backend to serve regulations data")
    
    return has_public_regulations

def simulate_frontend_load():
    """Simulate what happens when frontend loads"""
    print("\n🎭 SIMULATING FRONTEND LOAD SEQUENCE")
    print("=" * 50)
    
    # Simulate the typical frontend loading sequence
    load_sequence = [
        ("/api/setup/status", "Check if app is set up"),
        ("/api/user", "Check user authentication"),
        ("/api/regulations", "Load regulations (auth required)"),
        ("/api/public/regulations", "Load regulations (public)"),
        ("/api/deadlines", "Load deadlines"),
        ("/api/notifications", "Load notifications")
    ]
    
    print("Simulating frontend API call sequence:")
    print("-" * 40)
    
    success_count = 0
    total_calls = len(load_sequence)
    
    for i, (endpoint, purpose) in enumerate(load_sequence, 1):
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            
            if response.status_code == 200:
                print(f"✅ Step {i}: {endpoint} - {purpose}")
                success_count += 1
            elif response.status_code == 401:
                print(f"🔐 Step {i}: {endpoint} - {purpose} (auth required)")
                # Auth required is not necessarily a failure for some endpoints
                if endpoint in ["/api/user", "/api/regulations"]:
                    print(f"   ℹ️  This is expected behavior for {endpoint}")
            else:
                print(f"❌ Step {i}: {endpoint} - {purpose} (HTTP {response.status_code})")
                
        except Exception as e:
            print(f"❌ Step {i}: {endpoint} - {purpose} (Error: {e})")
    
    print(f"\n📈 Success Rate: {success_count}/{total_calls} endpoints working")
    
    # Determine likely frontend state
    if success_count >= 1:  # At least one endpoint working
        has_public_regs = any(endpoint == "/api/public/regulations" for endpoint, _ in load_sequence)
        try:
            response = requests.get(f"{BASE_URL}/api/public/regulations", timeout=5)
            if response.status_code == 200:
                print("🎯 LIKELY FRONTEND STATE: Regulations should be visible")
                print("   Frontend should show regulation data from /api/public/regulations")
                return True
        except:
            pass
    
    print("🎯 LIKELY FRONTEND STATE: Frontend may show errors or loading states")
    return False

def main():
    print("🚀 FRONTEND REALITY CHECK - DETAILED ANALYSIS")
    print("=" * 60)
    
    # Check API endpoints
    has_regulations = analyze_frontend_behavior()
    
    # Simulate frontend loading
    should_work = simulate_frontend_load()
    
    print("\n" + "=" * 60)
    print("🏁 FINAL VERDICT")
    print("=" * 60)
    
    if has_regulations and should_work:
        print("✅ FRONTEND SHOULD BE WORKING")
        print("   - Regulations data is available")
        print("   - Frontend should display regulation list")
        print("   - Some features may require authentication")
        print("\n💡 If user still sees errors:")
        print("   1. Check browser console for JavaScript errors")
        print("   2. Clear browser cache and reload")
        print("   3. Check if frontend is calling wrong API endpoints")
    else:
        print("❌ FRONTEND LIKELY HAS ISSUES")
        print("   - Missing critical API endpoints")
        print("   - Frontend may show loading states or errors")
        print("\n💡 Next steps:")
        print("   1. Fix missing API endpoints")
        print("   2. Ensure frontend calls correct endpoints")
        print("   3. Check authentication flow")

if __name__ == "__main__":
    main() 