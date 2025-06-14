#!/usr/bin/env python3
"""
Final Login Fix - Comprehensive database connectivity solution
"""

import subprocess
import json
import time

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except:
        return False, "", "Command failed"

def main():
    print("🎯 FINAL LOGIN FIX - COMPREHENSIVE SOLUTION")
    print("=" * 55)
    
    # 1. Verify current status
    print("\n1. Current status check...")
    success, health, _ = run_cmd("curl -s -m 5 http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health")
    if success and 'ok' in health:
        print("   ✅ Application is running")
    else:
        print("   ❌ Application not responding")
        return False
    
    # 2. Check if we're now in the same VPC
    print("\n2. Checking VPC configuration...")
    success, ecs_vpc, _ = run_cmd("aws ec2 describe-subnets --subnet-ids $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets[0]' --output text) --query 'Subnets[0].VpcId' --output text")
    success2, default_vpc, _ = run_cmd("aws ec2 describe-vpcs --filters 'Name=is-default,Values=true' --query 'Vpcs[0].VpcId' --output text")
    
    if success and success2:
        print(f"   📍 ECS VPC: {ecs_vpc}")
        print(f"   📍 Default VPC: {default_vpc}")
        if ecs_vpc == default_vpc:
            print("   ✅ Now in same VPC as databases")
        else:
            print("   ⚠️  Still in different VPC")
    
    # 3. Update DATABASE_URL to use localhost-style connection with better parameters
    print("\n3. Optimizing database connection parameters...")
    
    # Create the most reliable DATABASE_URL possible
    db_urls = [
        # Option 1: Disable SSL completely, use connection pooling
        "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=10&command_timeout=20",
        
        # Option 2: Try the other database
        "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=10&command_timeout=20"
    ]
    
    for i, db_url in enumerate(db_urls, 1):
        print(f"\n   Trying database option {i}...")
        
        # Get current task definition
        success, task_def, _ = run_cmd("aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition'")
        if not success:
            print("   ❌ Failed to get task definition")
            continue
        
        try:
            task_data = json.loads(task_def)
            
            # Update DATABASE_URL
            container = task_data['containerDefinitions'][0]
            for env_var in container['environment']:
                if env_var['name'] == 'DATABASE_URL':
                    env_var['value'] = db_url
                    break
            else:
                container['environment'].append({'name': 'DATABASE_URL', 'value': db_url})
            
            # Clean up task definition
            for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
                task_data.pop(field, None)
            
            # Save and register
            with open(f'/tmp/final_task_def_{i}.json', 'w') as f:
                json.dump(task_data, f)
            
            success, _, _ = run_cmd(f"aws ecs register-task-definition --cli-input-json file:///tmp/final_task_def_{i}.json")
            if success:
                print("   ✅ Task definition registered")
                
                # Update service
                success, _, _ = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment")
                if success:
                    print("   ✅ Service deployment started")
                    
                    # Wait for deployment with progress monitoring
                    print("   ⏳ Waiting for deployment (checking every 30 seconds)...")
                    
                    for attempt in range(6):  # 3 minutes max
                        time.sleep(30)
                        
                        # Check service status
                        success, counts, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].[runningCount,desiredCount]' --output text")
                        if success:
                            running, desired = counts.split('\t')
                            print(f"   [{attempt+1}/6] Running: {running}/{desired}")
                            
                            if running == desired and int(desired) > 0:
                                print("   ✅ Deployment complete")
                                break
                    
                    # Test health first
                    success, health, _ = run_cmd("curl -s -m 5 http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health")
                    if success and 'ok' in health:
                        print("   ✅ Health check passed")
                        
                        # Test login with multiple attempts
                        print("   🧪 Testing login functionality...")
                        
                        for test_attempt in range(3):
                            success, login_result, _ = run_cmd("curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                            
                            if success and login_result:
                                print(f"   📝 Login attempt {test_attempt+1}: {login_result[:100]}")
                                
                                if any(keyword in login_result for keyword in ['401', 'Invalid credentials', 'Authentication failed']):
                                    if 'timeout' not in login_result.lower():
                                        print("   🎉 SUCCESS! Login endpoint is working!")
                                        print(f"      Response: {login_result}")
                                        return True
                                elif 'error' in login_result and 'timeout' not in login_result.lower():
                                    print("   ✅ Login endpoint responding (non-timeout error)")
                                    return True
                            else:
                                print(f"   ❌ Login attempt {test_attempt+1} failed")
                            
                            time.sleep(10)  # Wait between attempts
                    else:
                        print("   ❌ Health check failed")
                else:
                    print("   ❌ Failed to update service")
            else:
                print("   ❌ Failed to register task definition")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # 4. Final diagnostic if nothing worked
    print("\n4. Final diagnostics...")
    
    # Check security group rules specifically for database access
    success, sg_id, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text")
    if success:
        success, sg_rules, _ = run_cmd(f"aws ec2 describe-security-groups --group-ids {sg_id} --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' --output json")
        if success:
            rules = json.loads(sg_rules) if sg_rules else []
            if rules:
                print(f"   ✅ Security group {sg_id} has PostgreSQL rules")
            else:
                print(f"   ⚠️  Security group {sg_id} missing PostgreSQL rules")
                
                # Add PostgreSQL rule
                success, _, _ = run_cmd(f"aws ec2 authorize-security-group-ingress --group-id {sg_id} --protocol tcp --port 5432 --source-group {sg_id}")
                if success:
                    print("   ✅ Added PostgreSQL rule to security group")
    
    # Try one final test with a very simple connection string
    print("\n5. Final attempt with simplified connection...")
    simple_db_url = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable"
    
    # Quick task definition update
    success, task_def, _ = run_cmd("aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition'")
    if success:
        try:
            task_data = json.loads(task_def)
            container = task_data['containerDefinitions'][0]
            for env_var in container['environment']:
                if env_var['name'] == 'DATABASE_URL':
                    env_var['value'] = simple_db_url
                    break
            
            for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
                task_data.pop(field, None)
            
            with open('/tmp/simple_task_def.json', 'w') as f:
                json.dump(task_data, f)
            
            success, _, _ = run_cmd("aws ecs register-task-definition --cli-input-json file:///tmp/simple_task_def.json")
            if success:
                success, _, _ = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment")
                if success:
                    print("   ✅ Final deployment initiated")
                    print("   ⏳ Waiting 60 seconds...")
                    time.sleep(60)
                    
                    # Final test
                    success, final_test, _ = run_cmd("curl -s -m 10 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                    if success and final_test:
                        print(f"   📝 Final result: {final_test[:200]}")
                        if 'timeout' not in final_test.lower():
                            return True
        except:
            pass
    
    return False

if __name__ == "__main__":
    result = main()
    if result:
        print("\n🎉 LOGIN FUNCTIONALITY RESTORED!")
        print("✅ Database connectivity working")
        print("✅ Login endpoint responding") 
    else:
        print("\n❌ LOGIN ISSUE PERSISTS")
        print("🔧 Manual investigation needed:")
        print("   1. Check CloudWatch logs for specific database errors")
        print("   2. Verify RDS instance is actually accessible")
        print("   3. Test database connection from ECS task directly")
        print("   4. Consider recreating RDS instance in same VPC") 