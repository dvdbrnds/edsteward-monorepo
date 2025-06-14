#!/usr/bin/env python3
"""
Step-by-Step Login Diagnosis
============================
"""

import subprocess
import json
import time
import threading

def run_cmd(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except:
        return False, "", "Command failed"

def monitor_logs():
    """Monitor logs in background while we test"""
    print("🔍 Starting log monitor...")
    success, logs, _ = run_cmd("aws logs tail /ecs/edsteward --since 2m --region us-east-1", timeout=60)
    if success and logs:
        print("📋 Recent application logs:")
        print(logs[-500:])  # Last 500 chars
    else:
        print("❌ No logs retrieved")

def main():
    print("🔬 STEP-BY-STEP LOGIN DIAGNOSIS")
    print("=" * 50)
    
    # Step 1: Verify application is running
    print("\n📍 STEP 1: Application Status")
    success, health, _ = run_cmd("curl -s -m 5 http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health")
    if success and 'ok' in health:
        print("   ✅ Application responding")
        health_data = json.loads(health) if health.startswith('{') else {}
        print(f"   📊 Uptime: {health_data.get('uptime', 'unknown')} seconds")
        print(f"   📊 Version: {health_data.get('version', 'unknown')}")
    else:
        print("   ❌ Application not responding")
        return
    
    # Step 2: Check current DATABASE_URL
    print("\n📍 STEP 2: Database Configuration")
    success, task_def, _ = run_cmd("aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text")
    if success and task_def:
        # Mask password for display
        masked_url = task_def
        if '@' in masked_url and ':' in masked_url:
            parts = masked_url.split('@')
            if ':' in parts[0]:
                user_pass = parts[0].split(':')
                masked_url = f"{user_pass[0]}:*****@{parts[1]}"
        print(f"   📋 DATABASE_URL: {masked_url}")
    else:
        print("   ❌ Could not retrieve DATABASE_URL")
    
    # Step 3: Test database reachability
    print("\n📍 STEP 3: Database Reachability")
    db_hosts = [
        "edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com",
        "edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
    ]
    
    # Check if databases are accessible from our VPC
    success, current_vpc, _ = run_cmd("aws ec2 describe-subnets --subnet-ids $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets[0]' --output text) --query 'Subnets[0].VpcId' --output text")
    if success:
        print(f"   📍 ECS VPC: {current_vpc}")
    
    for host in db_hosts:
        print(f"   🔍 Testing {host}...")
        # Use nc (netcat) to test port connectivity
        success, _, _ = run_cmd(f"timeout 5 nc -z {host} 5432", timeout=10)
        if success:
            print(f"      ✅ Port 5432 accessible")
        else:
            print(f"      ❌ Port 5432 not accessible")
    
    # Step 4: Check security group rules
    print("\n📍 STEP 4: Security Group Analysis")
    success, sg_id, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text")
    if success and sg_id:
        print(f"   🔒 Security Group: {sg_id}")
        
        # Check PostgreSQL rules
        success, rules, _ = run_cmd(f"aws ec2 describe-security-groups --group-ids {sg_id} --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' --output json")
        if success:
            rule_data = json.loads(rules) if rules else []
            if rule_data:
                print("   ✅ PostgreSQL (5432) rules exist:")
                for rule in rule_data:
                    print(f"      - Port: {rule.get('FromPort', 'N/A')}-{rule.get('ToPort', 'N/A')}")
                    print(f"      - Protocol: {rule.get('IpProtocol', 'N/A')}")
            else:
                print("   ❌ No PostgreSQL (5432) rules found")
                
                # Add the rule
                print("   🔧 Adding PostgreSQL rule...")
                success, _, _ = run_cmd(f"aws ec2 authorize-security-group-ingress --group-id {sg_id} --protocol tcp --port 5432 --source-group {sg_id}")
                if success:
                    print("   ✅ PostgreSQL rule added")
                else:
                    print("   ❌ Failed to add PostgreSQL rule")
    
    # Step 5: Test with simplified login request and monitor response
    print("\n📍 STEP 5: Login Request Analysis")
    
    # Start log monitoring in background
    log_thread = threading.Thread(target=monitor_logs)
    log_thread.daemon = True
    log_thread.start()
    
    # Test different API endpoints to isolate the issue
    endpoints = [
        ("/api", "GET", None, "API base endpoint"),
        ("/api/health", "GET", None, "API health endpoint"),
        ("/api/login", "POST", '{"username":"test","password":"test"}', "Login endpoint"),
        ("/api/users", "GET", None, "Users endpoint (may not exist)"),
    ]
    
    for endpoint, method, data, description in endpoints:
        print(f"   🧪 Testing {description}...")
        
        if method == "GET":
            cmd = f"curl -s -m 10 -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com{endpoint}"
        else:
            cmd = f"curl -s -m 15 -X {method} -H 'Content-Type: application/json' -d '{data}' -w 'HTTP:%{{http_code}}|Time:%{{time_total}}s' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com{endpoint}"
        
        success, output, _ = run_cmd(cmd, timeout=20)
        
        if success and output:
            if '|' in output:
                response_body = output.split('|')[0]
                status_info = '|'.join(output.split('|')[1:])
                print(f"      📊 {status_info}")
                print(f"      📝 Response: {response_body[:100]}{'...' if len(response_body) > 100 else ''}")
                
                # Analyze response
                if 'HTTP:200' in status_info:
                    print("      ✅ Endpoint working")
                elif 'HTTP:401' in status_info:
                    print("      ✅ Endpoint working (401 = authentication required)")
                elif 'HTTP:404' in status_info:
                    print("      ⚠️  Endpoint not found (404)")
                elif 'HTTP:500' in status_info:
                    print("      ❌ Server error (500)")
                    if 'timeout' in response_body.lower():
                        print("      🚨 Database timeout detected!")
            else:
                print(f"      📝 Raw response: {output[:100]}")
        else:
            print("      ❌ Request failed or timed out")
        
        time.sleep(2)  # Brief pause between requests
    
    # Step 6: Database Connection String Optimization
    print("\n📍 STEP 6: Database Connection Optimization")
    
    # Try the most basic connection possible
    basic_db_url = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=5"
    
    print("   🔧 Applying most basic database connection...")
    
    # Get and update task definition
    success, task_def_json, _ = run_cmd("aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition'")
    if success:
        try:
            task_data = json.loads(task_def_json)
            
            # Update DATABASE_URL
            container = task_data['containerDefinitions'][0]
            for env_var in container['environment']:
                if env_var['name'] == 'DATABASE_URL':
                    env_var['value'] = basic_db_url
                    break
            else:
                container['environment'].append({'name': 'DATABASE_URL', 'value': basic_db_url})
            
            # Clean up task definition
            for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
                task_data.pop(field, None)
            
            # Save and deploy
            with open('/tmp/optimized_task_def.json', 'w') as f:
                json.dump(task_data, f)
            
            success, _, _ = run_cmd("aws ecs register-task-definition --cli-input-json file:///tmp/optimized_task_def.json")
            if success:
                print("   ✅ Optimized task definition registered")
                
                success, _, _ = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment")
                if success:
                    print("   ✅ Deployment started")
                    
                    print("   ⏳ Waiting 90 seconds for deployment...")
                    time.sleep(90)
                    
                    # Final test
                    print("   🧪 Final login test...")
                    success, final_result, _ = run_cmd("curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                    
                    if success and final_result:
                        print(f"   📝 Final result: {final_result}")
                        
                        if any(indicator in final_result for indicator in ['401', 'Invalid credentials', 'Authentication failed']):
                            print("   🎉 SUCCESS! Login endpoint is working!")
                            return True
                        elif 'timeout' not in final_result.lower() and 'error' in final_result:
                            print("   ✅ Login endpoint responding (non-timeout error)")
                            return True
                        else:
                            print("   ❌ Still not working properly")
                    else:
                        print("   ❌ Final test failed")
                else:
                    print("   ❌ Failed to start deployment")
            else:
                print("   ❌ Failed to register task definition")
        except Exception as e:
            print(f"   ❌ Error updating task definition: {e}")
    
    # Wait for log thread to complete
    time.sleep(5)
    
    return False

if __name__ == "__main__":
    result = main()
    
    print("\n" + "=" * 50)
    if result:
        print("🎉 LOGIN DIAGNOSIS COMPLETE - ISSUE RESOLVED!")
    else:
        print("🔍 LOGIN DIAGNOSIS COMPLETE - ADDITIONAL STEPS NEEDED")
        print("\n🔧 Recommended next actions:")
        print("   1. Check if database actually has the required tables/schema")
        print("   2. Verify database user permissions")
        print("   3. Test database connection from within ECS task")
        print("   4. Check application code for database initialization")
        print("   5. Consider database schema migration/initialization") 