#!/usr/bin/env python3
"""
Fix ECS network access by moving to public subnets
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

def fix_network_access():
    """Fix network access by using public subnets"""
    print("🌐 FIXING NETWORK ACCESS FOR ECS TASKS")
    print("=" * 50)
    
    # Find public subnets in the VPC
    print("\n📋 1. Finding public subnets in VPC vpc-05bb4979c040b7b83...")
    
    vpc_id = "vpc-05bb4979c040b7b83"
    
    # Get all subnets in the VPC
    subnets_cmd = ['ec2', 'describe-subnets', '--filters', f'Name=vpc-id,Values={vpc_id}', '--output', 'json']
    result = run_aws_command(subnets_cmd)
    
    public_subnets = []
    private_subnets = []
    
    if result:
        try:
            data = json.loads(result)
            
            for subnet in data['subnets']:
                subnet_id = subnet['subnetId']
                az = subnet['availabilityZone']
                
                # Check if subnet has internet gateway route
                route_tables_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
                route_result = run_aws_command(route_tables_cmd)
                
                has_igw = False
                if route_result:
                    route_data = json.loads(route_result)
                    for rt in route_data['routeTables']:
                        for route in rt.get('routes', []):
                            if route.get('gatewayId', '').startswith('igw-'):
                                has_igw = True
                                break
                
                if has_igw:
                    public_subnets.append((subnet_id, az))
                    print(f"   ✅ Public subnet: {subnet_id} ({az})")
                else:
                    private_subnets.append((subnet_id, az))
                    print(f"   ❌ Private subnet: {subnet_id} ({az})")
                    
        except Exception as e:
            print(f"   Error: {e}")
            return
    
    if not public_subnets:
        print("❌ No public subnets found! Creating one...")
        
        # Create a public subnet
        create_subnet_cmd = ['ec2', 'create-subnet', '--vpc-id', vpc_id, '--cidr-block', '10.0.100.0/24', '--availability-zone', 'us-east-1a', '--output', 'json']
        result = run_aws_command(create_subnet_cmd)
        
        if result:
            data = json.loads(result)
            new_subnet_id = data['subnet']['subnetId']
            print(f"   ✅ Created public subnet: {new_subnet_id}")
            
            # Get internet gateway
            igw_cmd = ['ec2', 'describe-internet-gateways', '--filters', f'Name=attachment.vpc-id,Values={vpc_id}', '--output', 'json']
            igw_result = run_aws_command(igw_cmd)
            
            if igw_result:
                igw_data = json.loads(igw_result)
                if igw_data['internetGateways']:
                    igw_id = igw_data['internetGateways'][0]['internetGatewayId']
                    
                    # Create route table for public subnet
                    rt_cmd = ['ec2', 'create-route-table', '--vpc-id', vpc_id, '--output', 'json']
                    rt_result = run_aws_command(rt_cmd)
                    
                    if rt_result:
                        rt_data = json.loads(rt_result)
                        rt_id = rt_data['routeTable']['routeTableId']
                        
                        # Add route to internet gateway
                        route_cmd = ['ec2', 'create-route', '--route-table-id', rt_id, '--destination-cidr-block', '0.0.0.0/0', '--gateway-id', igw_id]
                        run_aws_command(route_cmd)
                        
                        # Associate with subnet
                        assoc_cmd = ['ec2', 'associate-route-table', '--route-table-id', rt_id, '--subnet-id', new_subnet_id]
                        run_aws_command(assoc_cmd)
                        
                        # Enable auto-assign public IP
                        auto_ip_cmd = ['ec2', 'modify-subnet-attribute', '--subnet-id', new_subnet_id, '--map-public-ip-on-launch']
                        run_aws_command(auto_ip_cmd)
                        
                        public_subnets = [(new_subnet_id, 'us-east-1a')]
                        print(f"   ✅ Public subnet configured with internet access")
        
        if not public_subnets:
            print("❌ Failed to create public subnet")
            return
    
    # Use first two public subnets (or create second if needed)
    selected_subnets = [public_subnets[0][0]]
    if len(public_subnets) > 1:
        selected_subnets.append(public_subnets[1][0])
    else:
        selected_subnets.append(public_subnets[0][0])  # Use same subnet twice if only one
    
    print(f"\n📋 2. Will use public subnets: {selected_subnets}")
    
    # Update ECS service with public subnets and enable public IP
    print(f"\n📋 3. Updating ECS service with public subnets...")
    
    update_cmd = [
        'ecs', 'update-service',
        '--cluster', 'edsteward-cluster',
        '--service', 'edsteward-service',
        '--network-configuration', json.dumps({
            'awsvpcConfiguration': {
                'subnets': selected_subnets,
                'securityGroups': ['sg-06abaf675286527bb'],
                'assignPublicIp': 'ENABLED'
            }
        }),
        '--desired-count', '1'
    ]
    
    result = run_aws_command(update_cmd)
    
    if result:
        print("✅ ECS service updated with public subnets and public IP enabled!")
        print("⏳ Waiting 120 seconds for new task to start...")
        time.sleep(120)
        
        # Check if task is now running
        print("\n📋 4. Checking new task status...")
        status_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--query', 'services[0].runningCount', '--output', 'text']
        result = run_aws_command(status_cmd)
        
        if result and result.strip() == '1':
            print("🎉 SUCCESS! ECS task is now running!")
            
            # Test the API
            print("\n📋 5. Testing API endpoint...")
            try:
                test_result = subprocess.run(
                    ['curl', '-X', 'POST', 'https://edsteward.ai/api/health', '--max-time', '10'],
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                print(f"API Response: {test_result.stdout}")
                
                if '200' in test_result.stdout or 'healthy' in test_result.stdout.lower():
                    print("🎉 API is responding! You should now be able to log in!")
                else:
                    print("⏳ API may still be starting up. Try logging in in a few minutes.")
                    
            except Exception as e:
                print(f"Could not test API: {e}")
                print("Try logging in at https://edsteward.ai/ in a few minutes.")
        else:
            print("⚠️ Task may still be starting. Check again in a few minutes.")
    else:
        print("❌ Failed to update ECS service")

if __name__ == "__main__":
    fix_network_access() 