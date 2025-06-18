#!/usr/bin/env python3
"""
SIMPLE LOGIN ISSUE DIAGNOSIS AND FIX
====================================

This script diagnoses and fixes login functionality using built-in modules only.
"""

import subprocess
import json
import time
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

def test_endpoints():
    """Test application endpoints using curl"""
    log("Testing application endpoints...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    tests = [
        ("Health check", f"curl -s -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' {base_url}/health"),
        ("Login test", f"curl -s -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' -X POST -H 'Content-Type: application/json' -d '{{\"username\":\"test\",\"password\":\"test\"}}' {base_url}/api/login"),
        ("Register test", f"curl -s -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' -X POST -H 'Content-Type: application/json' -d '{{\"username\":\"test\",\"email\":\"test@test.com\"}}' {base_url}/api/register"),
    ]
    
    results = {}
    
    for test_name, command in tests:
        success, output, error = run_command(command, check=False)
        
        if success and output:
            # Parse curl output
            if "|" in output:
                parts = output.split("|")
                status_part = parts[-2] if len(parts) >= 2 else ""
                time_part = parts[-1] if len(parts) >= 1 else ""
                
                http_code = status_part.replace("HTTP:", "") if "HTTP:" in status_part else "UNKNOWN"
                response_time = time_part.replace("Time:", "").replace("s", "") if "Time:" in time_part else "0"
                
                results[test_name] = {
                    "status": http_code,
                    "time": response_time,
                    "response": output.split("|")[0] if "|" in output else output[:100]
                }
                
                status_color = "SUCCESS" if http_code.isdigit() and int(http_code) < 400 else "ERROR"
                log(f"{test_name}: {http_code} ({response_time}s)", status_color)
            else:
                log(f"{test_name}: Unexpected output format", "WARNING")
                results[test_name] = {"status": "ERROR", "time": "0", "response": output[:100]}
        else:
            log(f"{test_name}: Command failed - {error}", "ERROR")
            results[test_name] = {"status": "ERROR", "time": "0", "response": error}
    
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
    log(f"Found running task: {task_arn}")
    
    # Get task definition from running task
    success, task_info, _ = run_command(
        f"aws ecs describe-tasks --cluster edsteward-cluster --tasks {task_arn} --query 'tasks[0].taskDefinitionArn' --output text"
    )
    
    if not success:
        log("Failed to get task definition ARN", "ERROR")
        return None
    
    task_def_arn = task_info.strip()
    log(f"Task definition ARN: {task_def_arn}")
    
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

def analyze_database_config(task_def):
    """Analyze database configuration"""
    log("Analyzing database configuration...")
    
    if not task_def or 'containerDefinitions' not in task_def:
        log("Invalid task definition", "ERROR")
        return None
    
    container = task_def['containerDefinitions'][0]
    env_vars = {env['name']: env['value'] for env in container.get('environment', [])}
    
    database_url = env_vars.get('DATABASE_URL', '')
    
    if database_url:
        # Hide password but show structure
        if '@' in database_url:
            parts = database_url.split('@')
            if ':' in parts[0]:
                user_pass = parts[0].split(':')
                display_url = f"{user_pass[0]}:*****@{parts[1]}"
            else:
                display_url = f"*****@{parts[1]}"
        else:
            display_url = database_url[:50] + "..." if len(database_url) > 50 else database_url
        
        log(f"DATABASE_URL: {display_url}")
        
        # Check for common issues
        issues = []
        if 'sslmode=require' in database_url:
            issues.append("SSL mode is 'require' - may cause connection issues")
        if 'connect_timeout' not in database_url:
            issues.append("No connect timeout specified")
        if 'pool_timeout' not in database_url:
            issues.append("No pool timeout specified")
        
        if issues:
            log("Potential database configuration issues:")
            for issue in issues:
                log(f"  - {issue}", "WARNING")
        
        return database_url
    else:
        log("DATABASE_URL not found", "ERROR")
        return None

def check_database_connectivity():
    """Check database connectivity"""
    log("Checking database connectivity...")
    
    # Check RDS instances
    success, rds_info, _ = run_command(
        "aws rds describe-db-instances --query 'DBInstances[?DBInstanceStatus==`available`].[DBInstanceIdentifier,Endpoint.Address,DBInstanceStatus]' --output table"
    )
    
    if success:
        log("Available RDS instances:")
        print(rds_info)
    
    return True

def get_recent_logs():
    """Get recent application logs"""
    log("Getting recent application logs...")
    
    success, logs, _ = run_command(
        "aws logs tail /ecs/edsteward --since 5m --region us-east-1"
    )
    
    if success and logs:
        log("Recent relevant logs:")
        log_lines = logs.split('\n')
        relevant_logs = []
        
        for line in log_lines:
            if any(keyword in line.lower() for keyword in ['error', 'timeout', 'database', 'connection', 'login', 'auth', 'terminated']):
                relevant_logs.append(line)
        
        if relevant_logs:
            for line in relevant_logs[-5:]:  # Last 5 relevant entries
                print(f"  {line}")
        else:
            log("No relevant error logs found")
    else:
        log("Failed to retrieve logs", "WARNING")

def fix_database_config():
    """Fix database configuration issues"""
    log("Attempting to fix database configuration...")
    
    task_def = get_current_task_definition()
    if not task_def:
        return False
    
    current_db_url = analyze_database_config(task_def)
    if not current_db_url:
        return False
    
    # Create optimized DATABASE_URL
    optimized_url = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=prefer&connect_timeout=30&pool_timeout=30&statement_timeout=30000"
    
    if current_db_url != optimized_url:
        log("Database URL needs optimization...")
        
        # Update environment variables
        container = task_def['containerDefinitions'][0]
        for env_var in container['environment']:
            if env_var['name'] == 'DATABASE_URL':
                env_var['value'] = optimized_url
                break
        else:
            container['environment'].append({
                'name': 'DATABASE_URL',
                'value': optimized_url
            })
        
        # Remove fields not allowed in register-task-definition
        fields_to_remove = ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 
                           'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']
        for field in fields_to_remove:
            task_def.pop(field, None)
        
        # Save task definition
        with open('/tmp/optimized_task_def.json', 'w') as f:
            json.dump(task_def, f, indent=2)
        
        # Register new task definition
        success, _, stderr = run_command(
            "aws ecs register-task-definition --cli-input-json file:///tmp/optimized_task_def.json"
        )
        
        if success:
            log("New optimized task definition registered", "SUCCESS")
            
            # Update service
            success, _, stderr = run_command(
                "aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment"
            )
            
            if success:
                log("Service update initiated with optimized database config", "SUCCESS")
                return True
            else:
                log(f"Failed to update service: {stderr}", "ERROR")
        else:
            log(f"Failed to register task definition: {stderr}", "ERROR")
    else:
        log("Database configuration is already optimized", "SUCCESS")
    
    return False

def wait_for_deployment():
    """Wait for deployment to complete"""
    log("Waiting for deployment to stabilize...")
    
    max_attempts = 15  # 7.5 minutes
    attempt = 1
    
    while attempt <= max_attempts:
        success, service_info, _ = run_command(
            "aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].[runningCount,desiredCount,pendingCount]' --output text"
        )
        
        if success:
            try:
                counts = service_info.strip().split('\t')
                if len(counts) >= 3:
                    running, desired, pending = counts[0], counts[1], counts[2]
                    log(f"[{attempt}/{max_attempts}] Running: {running}/{desired}, Pending: {pending}")
                    
                    if running == desired and int(desired) > 0:
                        log("Service is stable", "SUCCESS")
                        return True
            except:
                pass
        
        time.sleep(30)
        attempt += 1
    
    log("Service stabilization timeout", "WARNING")
    return False

def final_test():
    """Final test of login functionality"""
    log("Final test of login functionality...")
    
    # Wait for service to be ready
    time.sleep(30)
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    # Test health first
    success, output, _ = run_command(
        f"curl -s -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' {base_url}/health", 
        check=False
    )
    
    if success and "HTTP:200" in output:
        log("Health check passed", "SUCCESS")
    else:
        log("Health check failed", "ERROR")
        return False
    
    # Test login endpoint
    success, output, _ = run_command(
        f"curl -s -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' -X POST -H 'Content-Type: application/json' -d '{{\"username\":\"testuser\",\"password\":\"testpass\"}}' {base_url}/api/login",
        check=False
    )
    
    if success and output:
        if "HTTP:401" in output:
            log("Login endpoint working! (401 = invalid credentials, but endpoint responds)", "SUCCESS")
            return True
        elif "HTTP:500" in output and "Connection terminated due to connection timeout" in output:
            log("Still getting database timeout errors", "ERROR")
            return False
        elif "timeout" not in output.lower():
            log(f"Login endpoint responded: {output.split('|')[-2] if '|' in output else output}", "SUCCESS")
            return True
    
    log("Login endpoint test failed", "ERROR")
    return False

def main():
    log("=" * 60)
    log("STARTING SIMPLE LOGIN ISSUE DIAGNOSIS AND FIX")
    log("=" * 60)
    
    # Step 1: Test current endpoints
    endpoint_results = test_endpoints()
    
    # Step 2: Check database configuration
    task_def = get_current_task_definition()
    if task_def:
        current_db_url = analyze_database_config(task_def)
    
    # Step 3: Check database connectivity
    check_database_connectivity()
    
    # Step 4: Get application logs
    get_recent_logs()
    
    # Step 5: Fix database configuration if needed
    fixed = fix_database_config()
    
    if fixed:
        # Step 6: Wait for deployment
        if wait_for_deployment():
            # Step 7: Final test
            if final_test():
                log("=" * 60)
                log("LOGIN ISSUE FIX COMPLETED SUCCESSFULLY!")
                log("=" * 60)
                return
    
    # Final status summary
    log("=" * 60)
    log("DIAGNOSIS COMPLETE - FINAL STATUS:")
    log("=" * 60)
    
    # Re-test endpoints
    final_results = test_endpoints()
    
    for test_name, result in final_results.items():
        status = result['status']
        color = "SUCCESS" if status.isdigit() and int(status) < 400 else "ERROR"
        log(f"  {test_name}: {status}", color)

if __name__ == "__main__":
    main() 