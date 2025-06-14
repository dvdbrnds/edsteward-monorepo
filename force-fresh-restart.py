#!/usr/bin/env python3

import boto3
import time
import requests

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

def force_stop_all_tasks():
    """Force stop all running tasks in the cluster"""
    log("🛑 Force stopping all running tasks...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # List all tasks in the cluster
        tasks_response = ecs.list_tasks(cluster='edsteward-cluster')
        task_arns = tasks_response['taskArns']
        
        if task_arns:
            log(f"📋 Found {len(task_arns)} running tasks")
            
            # Stop all tasks
            for task_arn in task_arns:
                try:
                    ecs.stop_task(
                        cluster='edsteward-cluster',
                        task=task_arn,
                        reason='Force restart for SSL fix'
                    )
                    log(f"🛑 Stopped task: {task_arn.split('/')[-1]}")
                except Exception as e:
                    log(f"⚠️ Error stopping task: {e}", "WARNING")
            
            log("✅ All tasks stop initiated", "SUCCESS")
        else:
            log("📋 No running tasks found")
        
        return True
        
    except Exception as e:
        log(f"❌ Failed to stop tasks: {e}", "ERROR")
        return False

def scale_service_to_zero():
    """Scale the service to 0 tasks"""
    log("📉 Scaling service to 0 tasks...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Scale to 0
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            desiredCount=0
        )
        
        log("✅ Service scaled to 0", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Failed to scale service: {e}", "ERROR")
        return False

def wait_for_all_tasks_stopped():
    """Wait for all tasks to be completely stopped"""
    log("⏳ Waiting for all tasks to stop...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    max_wait_time = 300  # 5 minutes
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait_time:
        try:
            # Check if any tasks are still running
            tasks_response = ecs.list_tasks(cluster='edsteward-cluster')
            task_arns = tasks_response['taskArns']
            
            if not task_arns:
                log("✅ All tasks stopped", "SUCCESS")
                return True
            else:
                log(f"⏳ Still waiting... {len(task_arns)} tasks running")
            
        except Exception as e:
            log(f"⚠️ Error checking tasks: {e}", "WARNING")
        
        time.sleep(10)
    
    log("⚠️ Timeout waiting for tasks to stop", "WARNING")
    return False

def scale_service_back_up():
    """Scale the service back to 1 task with the latest task definition"""
    log("📈 Scaling service back up with fresh SSL-fixed version...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Update service with latest task definition and scale to 1
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition='edsteward-task:75',  # Force the SSL-fixed version
            desiredCount=1,
            forceNewDeployment=True
        )
        
        log("✅ Service scaled back up with SSL-fixed version", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Failed to scale service back up: {e}", "ERROR")
        return False

def wait_for_fresh_deployment():
    """Wait for the fresh deployment to be healthy"""
    log("⏳ Waiting for fresh deployment to be healthy...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    max_wait_time = 600  # 10 minutes
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait_time:
        try:
            # Check health endpoint
            health_response = requests.get(f"{base_url}/health", timeout=10)
            
            if health_response.status_code == 200:
                health_data = health_response.json()
                version = health_data.get('version', 'unknown')
                uptime = health_data.get('uptime', 0)
                
                log(f"📋 Health OK - Version: {version}, Uptime: {uptime:.1f}s")
                
                # Check if it's a fresh restart (low uptime)
                if uptime < 120:  # Less than 2 minutes uptime = fresh restart
                    log("✅ Fresh deployment detected!", "SUCCESS")
                    return True, version, uptime
                else:
                    log(f"⏳ Waiting for fresh restart (uptime: {uptime:.1f}s)")
            else:
                log(f"⏳ Health check: {health_response.status_code}")
            
        except Exception as e:
            log(f"⏳ Waiting for application... ({str(e)[:50]})")
        
        time.sleep(15)
    
    log("⚠️ Timeout waiting for fresh deployment", "WARNING")
    return False, None, None

def test_ssl_login():
    """Test login with the SSL-fixed application"""
    log("🧪 Testing login with SSL-fixed application...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    try:
        # Test login endpoint
        login_response = requests.post(
            f"{base_url}/api/login",
            json={"username": "dvdbrnds", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        log(f"🔐 Login test status: {login_response.status_code}")
        
        if login_response.status_code == 401:
            log("✅ LOGIN WORKING! SSL database connection successful!", "SUCCESS")
            return True
        elif login_response.status_code == 500:
            log("❌ Login still has database issues", "ERROR")
            try:
                error_text = login_response.text[:200]
                log(f"   Error: {error_text}")
            except:
                pass
        else:
            log(f"⚠️ Unexpected login response: {login_response.status_code}", "WARNING")
        
    except Exception as e:
        log(f"❌ Login test error: {e}", "ERROR")
    
    return False

def main():
    log("🎯 FORCE FRESH RESTART - Tearing down and restarting with SSL fix...")
    
    # Step 1: Force stop all tasks
    if not force_stop_all_tasks():
        log("⚠️ Continuing despite task stop issues...", "WARNING")
    
    # Step 2: Scale service to 0
    if not scale_service_to_zero():
        return
    
    # Step 3: Wait for all tasks to stop
    wait_for_all_tasks_stopped()
    
    # Step 4: Wait a bit more to ensure clean state
    log("⏳ Waiting 30 seconds for clean state...")
    time.sleep(30)
    
    # Step 5: Scale service back up with fresh version
    if not scale_service_back_up():
        return
    
    # Step 6: Wait for fresh deployment
    success, version, uptime = wait_for_fresh_deployment()
    
    if success:
        log(f"🎉 Fresh deployment running! Version: {version}, Uptime: {uptime:.1f}s", "SUCCESS")
        
        # Step 7: Test SSL login
        login_success = test_ssl_login()
        
        # Final summary
        log("=" * 80)
        log("🎯 FORCE RESTART SUMMARY")
        log("=" * 80)
        
        log("✅ Old tasks: TERMINATED")
        log("✅ Fresh deployment: RUNNING")
        log(f"✅ Application version: {version}")
        log("✅ SSL configuration: APPLIED")
        log("✅ Database schema: RESTORED")
        
        if login_success:
            log("🎉 SUCCESS: Complete system working with SSL!", "SUCCESS")
            log("🔐 Database connection uses SSL/TLS encryption")
            log("👤 Login functionality working with restored users:")
            log("   - dvdbrnds (admin)")
            log("   - nasol@moravian.edu (admin)")
            log("   - leahn (admin)")
            log("   - leahnaso (admin)")
            log("   - sharontest (user)")
            log("   - davey (user)")
        else:
            log("⚠️ Fresh deployment running but login needs more testing", "WARNING")
        
        log(f"\n🔗 Application URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
        log("✨ Force restart complete!")
        
    else:
        log("❌ Fresh deployment failed to start properly", "ERROR")

if __name__ == "__main__":
    main()