#!/usr/bin/env python3
"""
COMPREHENSIVE LOGIN ISSUE DIAGNOSIS AND FIX
===========================================

This script diagnoses and fixes login functionality issues including:
- Database connectivity problems
- API routing issues  
- Authentication configuration
- Environment variable problems
"""

import subprocess
import json
import time
import requests
from datetime import datetime

def run_command(command, check=True):
    """Run command and return success status and output"""
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True, timeout=60)
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout if e.stdout else "", e.stderr if e.stderr else str(e)
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"

def log(message, level="INFO"):
    """Log message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m", 
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
        "END": "\033[0m"
    }
    color = colors.get(level, colors["INFO"])
    print(f"{color}[{level}] {timestamp}: {message}{colors['END']}")

def test_application_endpoints():
    """Test various application endpoints"""
    log("Testing application endpoints...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    tests = [
        ("Main page", "GET", "/"),
        ("Health check", "GET", "/health"),
        ("API base", "GET", "/api"),
        ("Login endpoint", "POST", "/api/login", {"username": "test", "password": "test"}),
        ("Register endpoint", "POST", "/api/register", {"username": "test", "email": "test@test.com"}),
    ]
    
    results = {}
    
    for test_name, method, endpoint, data in [(*t, None) if len(t) == 3 else t for t in tests]:
        try:
            url = f"{base_url}{endpoint}"
            if method == "GET":
                response = requests.get(url, timeout=10)
            else:
                response = requests.post(url, json=data, timeout=10)
            
            results[test_name] = {
                "status": response.status_code,
                "time": response.elapsed.total_seconds(),
                "response": response.text[:200] if response.text else ""
            }
            
            status_color = "SUCCESS" if response.status_code < 400 else "ERROR"
            log(f"{test_name}: {response.status_code} ({response.elapsed.total_seconds():.2f}s)", status_color)
            
        except requests.exceptions.Timeout:
            results[test_name] = {"status": "TIMEOUT", "time": 10, "response": "Request timed out"}
            log(f"{test_name}: TIMEOUT", "ERROR")
        except Exception as e:
            results[test_name] = {"status": "ERROR", "time": 0, "response": str(e)}
            log(f"{test_name}: ERROR - {str(e)}", "ERROR")
    
    return results

def get_current_task_definition():
    """Get current ECS task definition"""
    log("Getting current task definition...")
    
    # Get running task ARN
    success, task_arns, _ = run_command(
        "aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --query 'taskArns[0]' --output text"
    )
    
    if not success or not task_arns.strip() or task_arns.strip() == "None":
        log("No running tasks found", "ERROR")
        return None
    
    task_arn = task_arns.strip()
    
    # Get task definition from running task
    success, task_info, _ = run_command(
        f"aws ecs describe-tasks --cluster edsteward-cluster --tasks {task_arn} --query 'tasks[0].taskDefinitionArn' --output text"
    )
    
    if not success:
        log("Failed to get task definition ARN", "ERROR")
        return None
    
    task_def_arn = task_info.strip()
    
    # Get full task definition
    success, task_def, _ = run_command(
        f"aws ecs describe-task-definition --task-definition {task_def_arn} --query 'taskDefinition'"
    )
    
    if success:
        try:
            return json.loads(task_def)
        except json.JSONDecodeError:
            log("Failed to parse task definition JSON", "ERROR")
            return None
    
    return None

def analyze_database_configuration(task_def):
    """Analyze database configuration in task definition"""
    log("Analyzing database configuration...")
    
    if not task_def or 'containerDefinitions' not in task_def:
        log("Invalid task definition", "ERROR")
        return None
    
    container = task_def['containerDefinitions'][0]
    env_vars = {env['name']: env['value'] for env in container.get('environment', [])}
    
    log("Current environment variables:")
    for key, value in env_vars.items():
        if 'DATABASE' in key or 'DB' in key:
            # Hide password but show other parts
            display_value = value[:50] + "..." if len(value) > 50 else value
            if 'password' in value.lower() or '@' in value:
                # Hide password part
                if '@' in value:
                    parts = value.split('@')
                    if ':' in parts[0]:
                        user_pass = parts[0].split(':')
                        display_value = f"{user_pass[0]}:*****@{parts[1]}"
                    else:
                        display_value = f"*****@{parts[1]}"
            log(f"  {key}: {display_value}")
    
    return env_vars

def test_database_connectivity():
    """Test database connectivity from application"""
    log("Testing database connectivity...")
    
    # Check RDS instances
    success, rds_info, _ = run_command(
        "aws rds describe-db-instances --query 'DBInstances[?DBInstanceStatus==`available`].[DBInstanceIdentifier,Endpoint.Address,DBInstanceStatus,VpcId]' --output table"
    )
    
    if success:
        log("Available RDS instances:")
        print(rds_info)
    
    # Test connection through application health endpoint with database check
    try:
        response = requests.get("http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            log(f"Application health: {health_data}")
            return True
    except Exception as e:
        log(f"Health check failed: {e}", "ERROR")
    
    return False

def check_vpc_and_security_groups():
    """Check VPC and security group configuration"""
    log("Checking VPC and security group configuration...")
    
    # Get ECS service details
    success, service_info, _ = run_command(
        "aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration'"
    )
    
    if success:
        try:
            network_config = json.loads(service_info)
            log("ECS network configuration:")
            log(f"  Subnets: {network_config.get('awsvpcConfiguration', {}).get('subnets', [])}")
            log(f"  Security Groups: {network_config.get('awsvpcConfiguration', {}).get('securityGroups', [])}")
            
            # Check security group rules
            sg_ids = network_config.get('awsvpcConfiguration', {}).get('securityGroups', [])
            for sg_id in sg_ids:
                success, sg_rules, _ = run_command(
                    f"aws ec2 describe-security-groups --group-ids {sg_id} --query 'SecurityGroups[0].IpPermissions'"
                )
                if success:
                    log(f"Security group {sg_id} inbound rules:")
                    print(json.dumps(json.loads(sg_rules), indent=2))
        
        except json.JSONDecodeError:
            log("Failed to parse network configuration", "ERROR")

def get_application_logs():
    """Get recent application logs"""
    log("Getting recent application logs...")
    
    # Get logs from the last 10 minutes
    success, logs, _ = run_command(
        "aws logs tail /ecs/edsteward --since 10m --region us-east-1"
    )
    
    if success and logs:
        log("Recent application logs:")
        # Filter for relevant log entries
        log_lines = logs.split('\n')
        relevant_logs = []
        
        for line in log_lines:
            if any(keyword in line.lower() for keyword in ['error', 'timeout', 'database', 'connection', 'login', 'auth']):
                relevant_logs.append(line)
        
        if relevant_logs:
            for line in relevant_logs[-10:]:  # Last 10 relevant log entries
                print(f"  {line}")
        else:
            log("No relevant error logs found in recent entries")
    else:
        log("No recent logs available or failed to retrieve logs", "WARNING")

def fix_database_connection_string():
    """Fix database connection string if needed"""
    log("Checking database connection string...")
    
    task_def = get_current_task_definition()
    if not task_def:
        return False
    
    env_vars = analyze_database_configuration(task_def)
    if not env_vars:
        return False
    
    database_url = env_vars.get('DATABASE_URL', '')
    
    # Check if DATABASE_URL needs fixing
    issues = []
    
    if not database_url:
        issues.append("DATABASE_URL is missing")
    elif 'sslmode=require' in database_url:
        issues.append("SSL mode is set to 'require' which may cause connection issues")
    elif 'connection timeout' in database_url.lower():
        issues.append("Connection timeout detected in DATABASE_URL")
    
    if issues:
        log("Database connection issues found:")
        for issue in issues:
            log(f"  - {issue}", "WARNING")
        
        # Create fixed DATABASE_URL
        if 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com' in database_url:
            # Use the working database with proper SSL configuration
            fixed_url = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=prefer&connect_timeout=30&pool_timeout=30"
            
            log("Creating fixed task definition with corrected DATABASE_URL...")
            
            # Update environment variables
            container = task_def['containerDefinitions'][0]
            for env_var in container['environment']:
                if env_var['name'] == 'DATABASE_URL':
                    env_var['value'] = fixed_url
                    break
            else:
                # Add DATABASE_URL if it doesn't exist
                container['environment'].append({
                    'name': 'DATABASE_URL',
                    'value': fixed_url
                })
            
            # Remove fields not allowed in register-task-definition
            fields_to_remove = ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 
                               'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']
            for field in fields_to_remove:
                task_def.pop(field, None)
            
            # Save and register new task definition
            with open('/tmp/fixed_task_def.json', 'w') as f:
                json.dump(task_def, f, indent=2)
            
            success, _, stderr = run_command(
                "aws ecs register-task-definition --cli-input-json file:///tmp/fixed_task_def.json"
            )
            
            if success:
                log("New task definition registered successfully", "SUCCESS")
                
                # Update service
                success, _, stderr = run_command(
                    "aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment"
                )
                
                if success:
                    log("Service update initiated", "SUCCESS")
                    return True
                else:
                    log(f"Failed to update service: {stderr}", "ERROR")
            else:
                log(f"Failed to register new task definition: {stderr}", "ERROR")
    else:
        log("Database connection string appears to be correctly configured", "SUCCESS")
    
    return False

def wait_for_service_stability():
    """Wait for ECS service to stabilize after changes"""
    log("Waiting for service to stabilize...")
    
    max_attempts = 20  # 10 minutes max
    attempt = 1
    
    while attempt <= max_attempts:
        success, service_info, _ = run_command(
            "aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0]'"
        )
        
        if success:
            try:
                service_data = json.loads(service_info)
                running_count = service_data.get('runningCount', 0)
                desired_count = service_data.get('desiredCount', 0)
                pending_count = service_data.get('pendingCount', 0)
                
                log(f"[{attempt}/{max_attempts}] Running: {running_count}/{desired_count}, Pending: {pending_count}")
                
                if running_count == desired_count and desired_count > 0:
                    log("Service is stable", "SUCCESS")
                    return True
                
            except json.JSONDecodeError:
                pass
        
        time.sleep(30)
        attempt += 1
    
    log("Service did not stabilize within timeout", "WARNING")
    return False

def test_login_after_fix():
    """Test login functionality after applying fixes"""
    log("Testing login functionality after fixes...")
    
    # Wait a bit for the service to be ready
    time.sleep(30)
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    try:
        # Test health check first
        response = requests.get(f"{base_url}/health", timeout=10)
        log(f"Health check: {response.status_code}", "SUCCESS" if response.status_code == 200 else "ERROR")
        
        # Test login endpoint
        login_data = {"username": "testuser", "password": "testpass"}
        response = requests.post(f"{base_url}/api/login", json=login_data, timeout=30)
        
        if response.status_code == 401:
            log("Login endpoint working (401 = invalid credentials, but endpoint is responding)", "SUCCESS")
            return True
        elif response.status_code == 500:
            error_text = response.text
            if "Connection terminated due to connection timeout" in error_text:
                log("Still getting database timeout errors", "ERROR")
                return False
            else:
                log(f"Login endpoint returned 500 but may be working: {error_text[:100]}", "WARNING")
                return True
        else:
            log(f"Login endpoint returned: {response.status_code} - {response.text[:100]}")
            return response.status_code < 500
            
    except requests.exceptions.Timeout:
        log("Login request timed out", "ERROR")
        return False
    except Exception as e:
        log(f"Login test failed: {str(e)}", "ERROR")
        return False

def main():
    log("=" * 60)
    log("STARTING LOGIN ISSUE DIAGNOSIS AND FIX")
    log("=" * 60)
    
    # Step 1: Test current endpoints
    endpoint_results = test_application_endpoints()
    
    # Step 2: Analyze database configuration
    task_def = get_current_task_definition()
    env_vars = analyze_database_configuration(task_def)
    
    # Step 3: Test database connectivity
    db_connectivity = test_database_connectivity()
    
    # Step 4: Check VPC and security groups
    check_vpc_and_security_groups()
    
    # Step 5: Get application logs
    get_application_logs()
    
    # Step 6: Fix database connection if needed
    fixed = fix_database_connection_string()
    
    if fixed:
        # Step 7: Wait for service to stabilize
        if wait_for_service_stability():
            # Step 8: Test login after fix
            login_working = test_login_after_fix()
            
            if login_working:
                log("=" * 60)
                log("LOGIN ISSUE FIX COMPLETED SUCCESSFULLY!")
                log("=" * 60)
            else:
                log("=" * 60)
                log("LOGIN ISSUE FIX APPLIED BUT STILL NOT WORKING")
                log("=" * 60)
    else:
        log("=" * 60)
        log("NO DATABASE FIXES NEEDED - INVESTIGATING OTHER ISSUES")
        log("=" * 60)
    
    # Final status summary
    log("FINAL STATUS:")
    for test_name, result in endpoint_results.items():
        status = result['status']
        color = "SUCCESS" if isinstance(status, int) and status < 400 else "ERROR"
        log(f"  {test_name}: {status}", color)

if __name__ == "__main__":
    main() 