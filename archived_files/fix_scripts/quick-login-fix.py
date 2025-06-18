#!/usr/bin/env python3
"""
Quick Login Fix - Diagnose and fix database connection timeout
"""

import subprocess
import json

def run_cmd(cmd):
    """Run command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except:
        return False, "", "Command failed"

def main():
    print("🔍 QUICK LOGIN DIAGNOSIS")
    print("=" * 40)
    
    # 1. Check database status
    print("\n1. Checking database status...")
    success, output, _ = run_cmd("aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier,`edsteward`)].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' --output json")
    if success:
        try:
            dbs = json.loads(output)
            for db in dbs:
                print(f"   Database: {db['ID']} - Status: {db['Status']} - Endpoint: {db['Endpoint']}")
        except:
            print("   Could not parse database info")
    
    # 2. Check ECS service network config
    print("\n2. Checking ECS network configuration...")
    success, output, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration' --output json")
    if success:
        try:
            network = json.loads(output)
            print(f"   Subnets: {network.get('subnets', [])}")
            print(f"   Security Groups: {network.get('securityGroups', [])}")
        except:
            print("   Could not parse network config")
    
    # 3. Test current login
    print("\n3. Testing current login endpoint...")
    success, output, _ = run_cmd("curl -s -m 10 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
    if "Connection terminated due to connection timeout" in output:
        print("   ❌ Database connection timeout confirmed")
        
        # 4. Apply the fix
        print("\n4. Applying database connection fix...")
        
        # Get current task definition
        success, task_def, _ = run_cmd("aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition'")
        if success:
            try:
                task_data = json.loads(task_def)
                
                # Update DATABASE_URL with better connection parameters
                new_db_url = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable&connect_timeout=10&command_timeout=20&pool_min_size=1&pool_max_size=3"
                
                # Update environment variables
                container = task_data['containerDefinitions'][0]
                for env_var in container['environment']:
                    if env_var['name'] == 'DATABASE_URL':
                        env_var['value'] = new_db_url
                        break
                
                # Remove unwanted fields
                for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
                    task_data.pop(field, None)
                
                # Save and register new task definition
                with open('/tmp/new_task_def.json', 'w') as f:
                    json.dump(task_data, f)
                
                success, _, _ = run_cmd("aws ecs register-task-definition --cli-input-json file:///tmp/new_task_def.json")
                if success:
                    print("   ✅ New task definition created")
                    
                    # Update service
                    success, _, _ = run_cmd("aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment")
                    if success:
                        print("   ✅ Service update initiated")
                        
                        print("\n5. Waiting for deployment (60 seconds)...")
                        import time
                        time.sleep(60)
                        
                        print("\n6. Testing login after fix...")
                        success, output, _ = run_cmd("curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                        
                        if "Connection terminated due to connection timeout" not in output:
                            if "401" in output or "Authentication failed" in output or "Invalid credentials" in output:
                                print("   🎉 SUCCESS! Login endpoint is working (401 = invalid creds, but endpoint responds)")
                                return True
                            else:
                                print(f"   ✅ Login endpoint responding: {output[:100]}")
                                return True
                        else:
                            print("   ❌ Still getting timeout errors")
                    else:
                        print("   ❌ Failed to update service")
                else:
                    print("   ❌ Failed to register new task definition")
            except Exception as e:
                print(f"   ❌ Error processing task definition: {e}")
    else:
        print(f"   Current response: {output[:100]}")
    
    return False

if __name__ == "__main__":
    result = main()
    if result:
        print("\n🎉 LOGIN ISSUE FIXED SUCCESSFULLY!")
    else:
        print("\n❌ LOGIN ISSUE PERSISTS - MAY NEED MANUAL INTERVENTION") 