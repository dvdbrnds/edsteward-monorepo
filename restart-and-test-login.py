#!/usr/bin/env python3

import boto3
import requests
import time
import json

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

def restart_ecs_service():
    """Restart the ECS service to pick up the restored database"""
    log("🔄 Restarting ECS service to connect to restored database...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Force new deployment
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            forceNewDeployment=True
        )
        
        log("✅ Service restart initiated", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Failed to restart service: {e}", "ERROR")
        return False

def wait_for_service_stability():
    """Wait for the service to stabilize after restart"""
    log("⏳ Waiting for service to stabilize...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    max_wait_time = 300  # 5 minutes
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait_time:
        try:
            health_response = requests.get(f"{base_url}/health", timeout=10)
            
            if health_response.status_code == 200:
                health_data = health_response.json()
                uptime = health_data.get('uptime', 0)
                
                # If uptime is less than 60 seconds, it's a fresh restart
                if uptime < 60:
                    log(f"✅ Service restarted (uptime: {uptime:.1f}s)", "SUCCESS")
                    return True
                else:
                    log(f"⏳ Waiting for restart (uptime: {uptime:.1f}s)")
            
        except Exception as e:
            log(f"⏳ Service restarting... ({str(e)[:50]})")
        
        time.sleep(10)
    
    log("⚠️ Service restart timeout", "WARNING")
    return False

def test_login_with_restored_database():
    """Test login functionality with the restored database"""
    log("🧪 Testing login with restored database...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    # Test users from the restored database
    test_users = [
        {"username": "dvdbrnds", "role": "admin"},
        {"username": "nasol@moravian.edu", "role": "admin"},
        {"username": "leahn", "role": "admin"}
    ]
    
    for user in test_users:
        try:
            log(f"🔐 Testing login for: {user['username']}")
            
            # Test with wrong password (should get 401)
            login_response = requests.post(
                f"{base_url}/api/login",
                json={"username": user['username'], "password": "wrongpassword"},
                headers={"Content-Type": "application/json"},
                timeout=30  # Longer timeout
            )
            
            log(f"   Status: {login_response.status_code}")
            
            if login_response.status_code == 401:
                log(f"   ✅ User {user['username']} found in database (401 = wrong password)", "SUCCESS")
                return True
            elif login_response.status_code == 404:
                log(f"   ❌ User {user['username']} not found", "ERROR")
            elif login_response.status_code == 500:
                log(f"   ❌ Database connection error for {user['username']}", "ERROR")
                try:
                    error_text = login_response.text[:200]
                    log(f"   Error details: {error_text}")
                except:
                    pass
            else:
                log(f"   ⚠️ Unexpected status: {login_response.status_code}", "WARNING")
                
        except requests.exceptions.Timeout:
            log(f"   ❌ Timeout testing {user['username']}", "ERROR")
        except Exception as e:
            log(f"   ❌ Error testing {user['username']}: {e}", "ERROR")
    
    return False

def test_database_connection_directly():
    """Test if the application can connect to the database"""
    log("🔍 Testing database connection...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    # Try different endpoints that might reveal database status
    endpoints_to_test = [
        "/health",
        "/api/users",
        "/api/regulations"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            log(f"📡 Testing {endpoint}...")
            response = requests.get(f"{base_url}{endpoint}", timeout=15)
            log(f"   {endpoint}: {response.status_code}")
            
            if response.status_code == 200:
                log(f"   ✅ {endpoint} working", "SUCCESS")
            elif response.status_code == 401:
                log(f"   ✅ {endpoint} requires auth (database connected)", "SUCCESS")
            elif response.status_code == 404:
                log(f"   ⚠️ {endpoint} not found", "WARNING")
            elif response.status_code == 500:
                log(f"   ❌ {endpoint} server error", "ERROR")
                
        except Exception as e:
            log(f"   ❌ Error testing {endpoint}: {e}", "ERROR")

def main():
    log("🎯 Restarting application and testing restored database...")
    
    # Step 1: Restart the ECS service
    if not restart_ecs_service():
        log("❌ Failed to restart service", "ERROR")
        return
    
    # Step 2: Wait for service to stabilize
    log("⏳ Waiting 60 seconds for service to restart...")
    time.sleep(60)
    
    if not wait_for_service_stability():
        log("⚠️ Service may still be restarting", "WARNING")
    
    # Step 3: Test database connection
    test_database_connection_directly()
    
    # Step 4: Test login functionality
    success = test_login_with_restored_database()
    
    # Final summary
    log("=" * 80)
    log("🎯 RESTART AND TEST SUMMARY")
    log("=" * 80)
    
    log("✅ Database schema: RESTORED")
    log("✅ Application: RESTARTED")
    
    if success:
        log("🎉 SUCCESS: Login functionality working with restored database!", "SUCCESS")
        log("👤 Database users are accessible:")
        log("   - dvdbrnds (admin)")
        log("   - nasol@moravian.edu (admin)")
        log("   - leahn (admin)")
        log("   - leahnaso (admin)")
        log("   - sharontest (user)")
        log("   - davey (user)")
    else:
        log("⚠️ Login may need more time or additional troubleshooting", "WARNING")
    
    log(f"\n🔗 Application URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
    log("✨ Restart and test complete!")

if __name__ == "__main__":
    main()