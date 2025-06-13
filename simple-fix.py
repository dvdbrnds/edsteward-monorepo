#!/usr/bin/env python3
"""
Simple fix - move ECS to public subnets with internet access
"""
import subprocess
import json
import time

def run_aws_command(cmd_args):
    """Run AWS CLI command directly"""
    try:
        full_cmd = ['/opt/homebrew/bin/aws'] + cmd_args
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"Exception: {e}")
        return None

def simple_fix():
    """Simple fix - use default public subnets"""
    print("🌐 FIXING ECS NETWORK ACCESS")
    print("=" * 40)
    
    print("\n📋 Step 1: Getting default VPC public subnets...")
    
    # Get default VPC
    vpc_cmd = ['ec2', 'describe-vpcs', '--filters', 'Name=is-default,Values=true', '--output', 'json']
    result = run_aws_command(vpc_cmd)
    
    default_vpc_id = None
    if result:
        try:
            data = json.loads(result)
            if data['Vpcs']:
                default_vpc_id = data['Vpcs'][0]['VpcId']
                print(f"   Default VPC: {default_vpc_id}")
        except Exception as e:
            print(f"   Error: {e}")
    
    if not default_vpc_id:
        print("❌ No default VPC found. Using known public subnets...")
        # Use known AWS default public subnets (these usually exist)
        public_subnets = ['subnet-12345678', 'subnet-87654321']  # Placeholder - AWS will use available ones
    else:
        # Get public subnets from default VPC
        subnets_cmd = ['ec2', 'describe-subnets', '--filters', f'Name=vpc-id,Values={default_vpc_id}', f'Name=default-for-az,Values=true', '--output', 'json']
        result = run_aws_command(subnets_cmd)
        
        public_subnets = []
        if result:
            try:
                data = json.loads(result)
                for subnet in data['Subnets']:
                    public_subnets.append(subnet['SubnetId'])
                    print(f"   Found public subnet: {subnet['SubnetId']} ({subnet['AvailabilityZone']})")
            except Exception as e:
                print(f"   Error: {e}")
        
        if not public_subnets:
            print("❌ No public subnets found in default VPC")
            return
    
    print(f"\n📋 Step 2: Moving ECS service to public subnets...")
    print(f"   Using subnets: {public_subnets[:2]}")  # Use first 2
    
    # Create the network configuration JSON file
    network_config = {
        "awsvpcConfiguration": {
            "subnets": public_subnets[:2],
            "securityGroups": ["sg-06abaf675286527bb"],
            "assignPublicIp": "ENABLED"
        }
    }
    
    # Write to temp file
    with open('/tmp/network-config.json', 'w') as f:
        json.dump(network_config, f)
    
    # Update ECS service
    update_cmd = [
        'ecs', 'update-service',
        '--cluster', 'edsteward-cluster',
        '--service', 'edsteward-service',
        '--network-configuration', f'file:///tmp/network-config.json',
        '--desired-count', '1'
    ]
    
    result = run_aws_command(update_cmd)
    
    if result:
        print("✅ ECS service updated!")
        print("⏳ Waiting 90 seconds for task to start...")
        time.sleep(90)
        
        # Check status
        print("\n📋 Step 3: Checking task status...")
        status_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
        result = run_aws_command(status_cmd)
        
        if result:
            try:
                data = json.loads(result)
                service = data['services'][0]
                running_count = service['runningCount']
                
                print(f"   Running tasks: {running_count}")
                
                if running_count > 0:
                    print("🎉 SUCCESS! Task is running!")
                    
                    # Test API
                    print("\n📋 Step 4: Testing API...")
                    try:
                        test_result = subprocess.run(
                            ['curl', '-s', '-w', '%{http_code}', 'https://edsteward.ai/api/health', '--max-time', '8'],
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        
                        http_code = test_result.stdout[-3:]
                        print(f"   API Health Check: HTTP {http_code}")
                        
                        if http_code == '200':
                            print("🎉 API is working! You should now be able to log in!")
                        elif http_code == '503':
                            print("⏳ API still starting up. Try again in 2-3 minutes.")
                        else:
                            print("⚠️ API responding but may still be initializing.")
                        
                    except Exception as e:
                        print(f"   Could not test API: {e}")
                        
                    print(f"\n🔗 Try logging in at: https://edsteward.ai/")
                        
                else:
                    print("⚠️ Task not running yet. Check again in a few minutes.")
                    
            except Exception as e:
                print(f"   Error checking status: {e}")
    else:
        print("❌ Failed to update ECS service")

if __name__ == "__main__":
    simple_fix() 