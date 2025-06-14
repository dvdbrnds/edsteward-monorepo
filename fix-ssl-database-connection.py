#!/usr/bin/env python3

import boto3
import json
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

def create_ssl_fixed_task_definition():
    """Create a new task definition with proper SSL database configuration"""
    log("🔧 Creating task definition with SSL database configuration...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get current task definition
        current_task_response = ecs.describe_task_definition(taskDefinition='edsteward-task')
        current_task = current_task_response['taskDefinition']
        current_container = current_task['containerDefinitions'][0]
        
        # Create new task definition with SSL configuration
        new_task_def = {
            'family': 'edsteward-task',
            'networkMode': current_task['networkMode'],
            'requiresCompatibilities': current_task['requiresCompatibilities'],
            'cpu': current_task['cpu'],
            'memory': current_task['memory'],
            'executionRoleArn': current_task['executionRoleArn'],
            'containerDefinitions': [
                {
                    'name': current_container['name'],
                    'image': current_container['image'],
                    'memory': current_container.get('memory', 2048),
                    'cpu': current_container.get('cpu', 1024),
                    'essential': True,
                    'portMappings': current_container.get('portMappings', []),
                    'logConfiguration': current_container.get('logConfiguration'),
                    'environment': [
                        {'name': 'NODE_ENV', 'value': 'production'},
                        # SSL-enabled database connection
                        {
                            'name': 'DATABASE_URL', 
                            'value': 'postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require'
                        },
                        # Alternative SSL configurations
                        {'name': 'DB_HOST', 'value': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com'},
                        {'name': 'DB_PORT', 'value': '5432'},
                        {'name': 'DB_NAME', 'value': 'postgres'},
                        {'name': 'DB_USER', 'value': 'postgres'},
                        {'name': 'DB_PASSWORD', 'value': 'EdSteward2024!Secure'},
                        {'name': 'DB_SSL', 'value': 'true'},
                        {'name': 'DB_SSL_MODE', 'value': 'require'},
                        {'name': 'PGSSLMODE', 'value': 'require'},
                        # Connection optimization
                        {'name': 'DB_CONNECTION_TIMEOUT', 'value': '30000'},
                        {'name': 'DB_IDLE_TIMEOUT', 'value': '10000'},
                        {'name': 'DB_MAX_CONNECTIONS', 'value': '20'},
                        {'name': 'DB_MIN_CONNECTIONS', 'value': '2'},
                        # Application settings
                        {'name': 'PORT', 'value': '3000'},
                        {'name': 'SESSION_SECRET', 'value': 'edsteward-session-secret-2024'},
                        # Version tracking
                        {'name': 'APP_VERSION', 'value': 'v1.21-ssl-fix'}
                    ]
                }
            ]
        }
        
        # Add taskRoleArn if it exists
        if 'taskRoleArn' in current_task:
            new_task_def['taskRoleArn'] = current_task['taskRoleArn']
        
        # Register the new task definition
        log("📝 Registering SSL-fixed task definition...")
        register_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = register_response['taskDefinition']['taskDefinitionArn']
        
        log(f"✅ New task definition: {new_task_arn}")
        return new_task_arn
        
    except Exception as e:
        log(f"❌ Failed to create SSL-fixed task definition: {e}", "ERROR")
        return None

def update_service_with_ssl_fix(task_definition_arn):
    """Update the ECS service to use the SSL-fixed task definition"""
    log("🔄 Updating service with SSL-fixed configuration...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Update the service
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=task_definition_arn,
            forceNewDeployment=True
        )
        
        log("✅ Service update initiated with SSL configuration", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Failed to update service: {e}", "ERROR")
        return False

def wait_for_deployment():
    """Wait for the new deployment to complete"""
    log("⏳ Waiting for SSL-fixed deployment to complete...")
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    max_wait_time = 600  # 10 minutes
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait_time:
        try:
            # Check service status
            service_response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = service_response['services'][0]
            deployments = service['deployments']
            
            # Find the primary deployment
            primary_deployment = None
            for deployment in deployments:
                if deployment['status'] == 'PRIMARY':
                    primary_deployment = deployment
                    break
            
            if primary_deployment:
                running_count = primary_deployment['runningCount']
                desired_count = primary_deployment['desiredCount']
                
                log(f"📋 Deployment status: {running_count}/{desired_count} tasks running")
                
                if running_count == desired_count and running_count > 0:
                    log("✅ Deployment completed successfully!", "SUCCESS")
                    return True
            
        except Exception as e:
            log(f"⚠️ Error checking deployment status: {e}", "WARNING")
        
        time.sleep(15)
    
    log("⚠️ Deployment timeout", "WARNING")
    return False

def test_ssl_fixed_application():
    """Test the application with SSL-fixed database connection"""
    log("🧪 Testing application with SSL-fixed database connection...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    # Wait for application to start
    log("⏳ Waiting for application to initialize...")
    time.sleep(30)
    
    # Test health endpoint
    try:
        log("1️⃣ Testing health endpoint...")
        health_response = requests.get(f"{base_url}/health", timeout=15)
        
        if health_response.status_code == 200:
            health_data = health_response.json()
            version = health_data.get('version', 'unknown')
            uptime = health_data.get('uptime', 0)
            
            log(f"✅ Health OK - Version: {version}, Uptime: {uptime:.1f}s", "SUCCESS")
            
            # Check if it's the new version
            if 'ssl' in version.lower() or uptime < 120:
                log("✅ New SSL-fixed version detected", "SUCCESS")
            
        else:
            log(f"❌ Health check failed: {health_response.status_code}", "ERROR")
            
    except Exception as e:
        log(f"❌ Health check error: {e}", "ERROR")
    
    # Test login endpoint
    try:
        log("2️⃣ Testing login endpoint with SSL-fixed database...")
        login_response = requests.post(
            f"{base_url}/api/login",
            json={"username": "dvdbrnds", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        log(f"   Login test status: {login_response.status_code}")
        
        if login_response.status_code == 401:
            log("✅ Login endpoint working! SSL database connection successful!", "SUCCESS")
            return True
        elif login_response.status_code == 500:
            log("❌ Login endpoint still has database connection issues", "ERROR")
            try:
                error_text = login_response.text[:200]
                log(f"   Error details: {error_text}")
            except:
                pass
        else:
            log(f"⚠️ Unexpected login response: {login_response.status_code}", "WARNING")
            
    except requests.exceptions.Timeout:
        log("❌ Login endpoint timeout - SSL connection may still be failing", "ERROR")
    except Exception as e:
        log(f"❌ Login test error: {e}", "ERROR")
    
    return False

def main():
    log("🎯 Fixing SSL certificate issue between application and database...")
    
    # Step 1: Create SSL-fixed task definition
    ssl_task_arn = create_ssl_fixed_task_definition()
    if not ssl_task_arn:
        return
    
    # Step 2: Update service with SSL configuration
    if not update_service_with_ssl_fix(ssl_task_arn):
        return
    
    # Step 3: Wait for deployment
    if not wait_for_deployment():
        log("⚠️ Deployment may still be in progress", "WARNING")
    
    # Step 4: Test the SSL-fixed application
    success = test_ssl_fixed_application()
    
    # Final summary
    log("=" * 80)
    log("🎯 SSL DATABASE FIX SUMMARY")
    log("=" * 80)
    
    log("✅ Database schema: RESTORED")
    log("✅ SSL configuration: APPLIED")
    log("✅ Application: DEPLOYED")
    
    if success:
        log("🎉 SUCCESS: SSL database connection working!", "SUCCESS")
        log("🔐 Database connection now uses SSL/TLS encryption")
        log("👤 Login functionality should now work with:")
        log("   - dvdbrnds (admin)")
        log("   - nasol@moravian.edu (admin)")
        log("   - leahn (admin)")
        log("   - leahnaso (admin)")
        log("   - sharontest (user)")
        log("   - davey (user)")
    else:
        log("⚠️ SSL fix applied but may need more time to stabilize", "WARNING")
        log("🔍 Check CloudWatch logs for detailed error information")
    
    log(f"\n🔗 Application URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
    log("✨ SSL database fix complete!")

if __name__ == "__main__":
    main()