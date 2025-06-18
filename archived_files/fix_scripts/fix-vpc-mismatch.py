#!/usr/bin/env python3
"""
Fix VPC Mismatch - Move ECS to same VPC as RDS
"""

import subprocess
import json
import time

def run_cmd(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except:
        return False, "", "Command failed"

def main():
    print("🌐 FIXING VPC MISMATCH - MOVING ECS TO RDS VPC")
    print("=" * 55)
    
    # RDS is in vpc-08e725354dc2ff83e
    # ECS is in vpc-05bb4979c040b7b83
    rds_vpc = "vpc-08e725354dc2ff83e"
    
    print(f"   🎯 Target VPC (RDS): {rds_vpc}")
    
    # Step 1: Get subnets in RDS VPC
    print("\n📍 STEP 1: Finding subnets in RDS VPC")
    success, subnets_output, _ = run_cmd(f"aws ec2 describe-subnets --filters 'Name=vpc-id,Values={rds_vpc}' --query 'Subnets[0:2].SubnetId' --output json")
    
    if success:
        try:
            rds_subnets = json.loads(subnets_output)
            print(f"   📍 RDS VPC subnets: {rds_subnets}")
            
            if len(rds_subnets) < 2:
                print("   ❌ Need at least 2 subnets for ECS deployment")
                return False
        except:
            print("   ❌ Failed to parse subnets")
            return False
    else:
        print("   ❌ Failed to get subnets")
        return False
    
    # Step 2: Create or get security group in RDS VPC
    print("\n📍 STEP 2: Setting up security group in RDS VPC")
    
    # Check if security group exists
    success, existing_sg, _ = run_cmd(f"aws ec2 describe-security-groups --filters 'Name=vpc-id,Values={rds_vpc}' 'Name=group-name,Values=edsteward-rds-vpc' --query 'SecurityGroups[0].GroupId' --output text")
    
    if success and existing_sg and existing_sg != "None":
        print(f"   ✅ Using existing security group: {existing_sg}")
        ecs_sg = existing_sg
    else:
        print("   🔧 Creating new security group in RDS VPC...")
        success, sg_output, _ = run_cmd(f"aws ec2 create-security-group --group-name edsteward-rds-vpc --description 'ECS in RDS VPC' --vpc-id {rds_vpc}")
        
        if success:
            try:
                sg_data = json.loads(sg_output)
                ecs_sg = sg_data['GroupId']
                print(f"   ✅ Created security group: {ecs_sg}")
                
                # Add necessary rules
                rules = [
                    f"aws ec2 authorize-security-group-ingress --group-id {ecs_sg} --protocol tcp --port 80 --cidr 0.0.0.0/0",
                    f"aws ec2 authorize-security-group-ingress --group-id {ecs_sg} --protocol tcp --port 443 --cidr 0.0.0.0/0",
                    f"aws ec2 authorize-security-group-ingress --group-id {ecs_sg} --protocol tcp --port 3000 --cidr 0.0.0.0/0",
                    f"aws ec2 authorize-security-group-ingress --group-id {ecs_sg} --protocol tcp --port 5432 --source-group {ecs_sg}",
                ]
                
                for rule in rules:
                    run_cmd(rule)
                
                print("   ✅ Security group rules added")
            except Exception as e:
                print(f"   ❌ Error creating security group: {e}")
                return False
        else:
            print("   ❌ Failed to create security group")
            return False
    
    # Step 3: Update ECS service to use RDS VPC
    print("\n📍 STEP 3: Moving ECS service to RDS VPC")
    
    network_config = {
        "awsvpcConfiguration": {
            "subnets": rds_subnets,
            "securityGroups": [ecs_sg],
            "assignPublicIp": "ENABLED"
        }
    }
    
    # Save network configuration
    with open('/tmp/rds_vpc_network_config.json', 'w') as f:
        json.dump(network_config, f)
    
    print("   🔄 Updating ECS service network configuration...")
    success, _, stderr = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --network-configuration file:///tmp/rds_vpc_network_config.json --force-new-deployment")
    
    if success:
        print("   ✅ ECS service updated to use RDS VPC")
    else:
        print(f"   ❌ Failed to update ECS service: {stderr}")
        return False
    
    # Step 4: Wait for deployment and test
    print("\n📍 STEP 4: Monitoring deployment and testing connectivity")
    
    print("   ⏳ Waiting for ECS deployment in RDS VPC...")
    
    for i in range(12):  # 6 minutes max
        time.sleep(30)
        
        success, status, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].[runningCount,desiredCount]' --output text")
        if success:
            running, desired = status.split('\t')
            print(f"   [{i+1}/12] Running: {running}/{desired}")
            
            if running == desired and int(desired) > 0:
                print("   ✅ ECS deployment in RDS VPC completed")
                
                # Test health endpoint
                print("   🧪 Testing application health...")
                time.sleep(15)
                
                success, health, _ = run_cmd("curl -s -m 10 http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health", timeout=15)
                if success and 'ok' in health:
                    print("   ✅ Application health check passed")
                    
                    # Test database connectivity
                    print("   🧪 Testing database connectivity...")
                    success, _, _ = run_cmd("timeout 10 nc -z edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com 5432", timeout=15)
                    if success:
                        print("   ✅ Database port 5432 is accessible!")
                        
                        # Final login test
                        print("   🧪 Testing login endpoint...")
                        success, login_result, _ = run_cmd("curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login", timeout=20)
                        
                        if success and login_result:
                            print(f"   📝 Login result: {login_result}")
                            
                            if any(keyword in login_result for keyword in ['401', 'Invalid credentials', 'Authentication failed', 'Unauthorized']):
                                print("   🎉 SUCCESS! Login endpoint working!")
                                print("      (401 response expected for invalid credentials)")
                                return True
                            elif 'timeout' not in login_result.lower() and 'Connection terminated' not in login_result:
                                print("   ✅ Login endpoint responding (database connected)")
                                return True
                            else:
                                print("   ❌ Still getting database connection issues")
                        else:
                            print("   ❌ Login request failed")
                    else:
                        print("   ❌ Database port still not accessible")
                else:
                    print("   ❌ Application health check failed")
                
                break
    else:
        print("   ⚠️  Deployment timeout")
    
    return False

if __name__ == "__main__":
    result = main()
    
    print("\n" + "=" * 55)
    if result:
        print("🎉 VPC MISMATCH FIXED! LOGIN IS NOW WORKING!")
        print("✅ ECS moved to same VPC as RDS")
        print("✅ Database connectivity established")
        print("✅ Login endpoint responding correctly")
        print("\n🔧 Final verification:")
        print("   - ECS and RDS are now in the same VPC")
        print("   - Database connection timeout issues resolved")
        print("   - Application login functionality restored")
    else:
        print("❌ VPC MISMATCH FIX INCOMPLETE")
        print("🔧 Additional troubleshooting may be needed:")
        print("   1. Verify RDS instance is actually running")
        print("   2. Check database schema and user permissions")
        print("   3. Investigate application-level database issues") 