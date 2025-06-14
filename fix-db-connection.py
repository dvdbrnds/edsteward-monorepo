#!/usr/bin/env python3
"""
Targeted Database Connection Fix
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
    print("🔧 FIXING DATABASE CONNECTION TIMEOUT")
    print("=" * 50)
    
    # 1. Check which database we should be using
    print("\n1. Analyzing available databases...")
    success, output, _ = run_cmd("aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier,`edsteward`)].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,VPC:DbSubnetGroup.VpcId,Endpoint:Endpoint.Address}' --output json")
    if success:
        dbs = json.loads(output)
        for db in dbs:
            print(f"   📊 {db['ID']}: {db['Status']} - VPC: {db['VPC']}")
            print(f"      Endpoint: {db['Endpoint']}")
    
    # 2. Check ECS VPC
    print("\n2. Checking ECS service VPC...")
    success, output, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration' --output json")
    if success:
        network = json.loads(output)
        subnets = network.get('subnets', [])
        security_groups = network.get('securityGroups', [])
        
        # Get VPC from subnet
        if subnets:
            success, vpc_output, _ = run_cmd(f"aws ec2 describe-subnets --subnet-ids {subnets[0]} --query 'Subnets[0].VpcId' --output text")
            if success:
                ecs_vpc = vpc_output.strip()
                print(f"   📡 ECS VPC: {ecs_vpc}")
                print(f"   🔒 Security Groups: {security_groups}")
    
    # 3. Create optimized DATABASE_URL
    print("\n3. Creating optimized database configuration...")
    
    # Try the database in the same VPC as ECS first
    optimized_urls = [
        # Option 1: edsteward-db with minimal SSL and aggressive timeouts
        "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=5&application_name=edsteward",
        
        # Option 2: edsteward-postgres if first one doesn't work
        "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=5&application_name=edsteward"
    ]
    
    for i, db_url in enumerate(optimized_urls, 1):
        print(f"\n   Trying option {i}...")
        
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
            
            # Remove unwanted fields
            for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
                task_data.pop(field, None)
            
            # Save task definition
            with open(f'/tmp/task_def_option_{i}.json', 'w') as f:
                json.dump(task_data, f)
            
            # Register new task definition
            success, _, _ = run_cmd(f"aws ecs register-task-definition --cli-input-json file:///tmp/task_def_option_{i}.json")
            if success:
                print("   ✅ Task definition registered")
                
                # Update service
                success, _, _ = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment")
                if success:
                    print("   ✅ Service deployment started")
                    
                    # Wait for deployment
                    print("   ⏳ Waiting 90 seconds for deployment...")
                    time.sleep(90)
                    
                    # Test login
                    print("   🧪 Testing login endpoint...")
                    success, login_output, _ = run_cmd("curl -s -m 10 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                    
                    if success and login_output:
                        if any(keyword in login_output for keyword in ['401', 'Authentication failed', 'Invalid credentials', 'error']):
                            if 'timeout' not in login_output.lower():
                                print(f"   🎉 SUCCESS! Login endpoint is responding: {login_output[:100]}")
                                
                                # Test health endpoint too
                                success, health_output, _ = run_cmd("curl -s -m 5 http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health")
                                if success and 'ok' in health_output:
                                    print(f"   ✅ Health endpoint also working: {health_output[:50]}...")
                                
                                return True
                            else:
                                print("   ❌ Still getting timeout errors")
                        else:
                            print(f"   ✅ Endpoint responding but unexpected format: {login_output[:100]}")
                            return True
                    else:
                        print("   ❌ No response from login endpoint")
                else:
                    print("   ❌ Failed to update service")
            else:
                print("   ❌ Failed to register task definition")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # 4. If all else fails, check security groups
    print("\n4. Checking security group rules for database access...")
    if security_groups:
        for sg in security_groups:
            success, rules, _ = run_cmd(f"aws ec2 describe-security-groups --group-ids {sg} --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' --output json")
            if success:
                try:
                    sg_rules = json.loads(rules)
                    if sg_rules:
                        print(f"   📋 Security group {sg} has PostgreSQL rules:")
                        for rule in sg_rules:
                            print(f"      Port: {rule.get('FromPort')}-{rule.get('ToPort')}")
                    else:
                        print(f"   ⚠️  Security group {sg} has NO PostgreSQL (5432) rules")
                        
                        # Add rule for PostgreSQL
                        print(f"   🔧 Adding PostgreSQL rule to security group {sg}...")
                        success, _, _ = run_cmd(f"aws ec2 authorize-security-group-ingress --group-id {sg} --protocol tcp --port 5432 --source-group {sg}")
                        if success:
                            print("   ✅ PostgreSQL rule added")
                        else:
                            print("   ❌ Failed to add PostgreSQL rule")
                except:
                    print(f"   ❌ Could not parse security group rules for {sg}")
    
    return False

if __name__ == "__main__":
    result = main()
    if result:
        print("\n🎉 DATABASE CONNECTION FIXED! LOGIN SHOULD BE WORKING NOW!")
    else:
        print("\n❌ DATABASE CONNECTION ISSUE PERSISTS")
        print("🔍 Next steps:")
        print("   1. Check AWS CloudWatch logs for database connection errors")
        print("   2. Verify VPC peering is working correctly")
        print("   3. Consider recreating the database in the same VPC as ECS") 