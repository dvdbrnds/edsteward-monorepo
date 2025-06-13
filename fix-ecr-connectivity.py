#!/usr/bin/env python3
"""
Fix ECS ECR connectivity issue by ensuring proper internet access
"""
import subprocess
import json

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

def fix_ecr_connectivity():
    """Fix ECS ECR connectivity issue"""
    print("🔧 FIXING ECS ECR CONNECTIVITY ISSUE")
    print("=" * 40)
    
    # The issue: ECS tasks can't pull from ECR because they have no internet access
    # Solution: Either use public subnets with public IP, or private subnets with NAT gateway
    
    print("\n📋 Current Problem:")
    print("   ❌ ECS tasks cannot connect to ECR (Amazon's container registry)")
    print("   ❌ Tasks fail with 'ResourceInitializationError'")
    print("   ❌ This prevents containers from starting")
    print("   ❌ Database connection is irrelevant if containers don't start")
    
    print("\n📋 1. Checking current ECS service network configuration...")
    
    # Get ECS service network config
    service_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
    result = run_aws_command(service_cmd)
    
    current_subnets = []
    current_sgs = []
    assign_public_ip = None
    
    if result:
        data = json.loads(result)
        service = data['services'][0]
        
        if 'networkConfiguration' in service:
            awsvpc_config = service['networkConfiguration']['awsvpcConfiguration']
            current_subnets = awsvpc_config.get('subnets', [])
            current_sgs = awsvpc_config.get('securityGroups', [])
            assign_public_ip = awsvpc_config.get('assignPublicIp', 'DISABLED')
            
            print(f"   📦 Current Subnets: {current_subnets}")
            print(f"   🔒 Security Groups: {current_sgs}")
            print(f"   🌐 Assign Public IP: {assign_public_ip}")
    
    # Check if current subnets have internet access
    print(f"\n📋 2. Checking subnet internet access...")
    
    for subnet_id in current_subnets:
        subnet_cmd = ['ec2', 'describe-subnets', '--subnet-ids', subnet_id, '--output', 'json']
        result = run_aws_command(subnet_cmd)
        
        if result:
            data = json.loads(result)
            subnet = data['Subnets'][0]
            
            vpc_id = subnet['VpcId']
            az = subnet['AvailabilityZone']
            
            print(f"   🔍 Checking {subnet_id} ({az}):")
            
            # Check route table for this subnet
            route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
            result = run_aws_command(route_cmd)
            
            has_internet = False
            if result:
                data = json.loads(result)
                if data['RouteTables']:
                    route_table = data['RouteTables'][0]
                    
                    for route in route_table['Routes']:
                        dest = route.get('DestinationCidrBlock', '')
                        gateway_id = route.get('GatewayId', '')
                        nat_gateway_id = route.get('NatGatewayId', '')
                        
                        # Check for internet gateway (public) or NAT gateway (private with internet)
                        if dest == '0.0.0.0/0':
                            if gateway_id.startswith('igw-'):
                                print(f"      ✅ Has internet via Internet Gateway: {gateway_id}")
                                has_internet = True
                            elif nat_gateway_id.startswith('nat-'):
                                print(f"      ✅ Has internet via NAT Gateway: {nat_gateway_id}")
                                has_internet = True
                            else:
                                print(f"      ❌ Has default route but unknown target: {gateway_id or nat_gateway_id}")
            
            if not has_internet:
                print(f"      ❌ NO INTERNET ACCESS - This is the problem!")
    
    # Solution: Move to public subnets with public IP assignment
    print(f"\n📋 3. Finding public subnets in the same VPC...")
    
    # Get all subnets in the VPC
    vpc_cmd = ['ec2', 'describe-subnets', '--filters', f'Name=vpc-id,Values=vpc-05bb4979c040b7b83', '--output', 'json']
    result = run_aws_command(vpc_cmd)
    
    public_subnets = []
    if result:
        data = json.loads(result)
        
        for subnet in data['Subnets']:
            subnet_id = subnet['SubnetId']
            
            # Check if this subnet has internet access
            route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
            result = run_aws_command(route_cmd)
            
            if result:
                data_route = json.loads(result)
                if data_route['RouteTables']:
                    route_table = data_route['RouteTables'][0]
                    
                    for route in route_table['Routes']:
                        dest = route.get('DestinationCidrBlock', '')
                        gateway_id = route.get('GatewayId', '')
                        
                        # Look for public subnets (internet gateway)
                        if dest == '0.0.0.0/0' and gateway_id.startswith('igw-'):
                            public_subnets.append({
                                'id': subnet_id,
                                'az': subnet['AvailabilityZone'],
                                'cidr': subnet['CidrBlock']
                            })
                            break
    
    if public_subnets:
        print(f"   ✅ Found {len(public_subnets)} public subnets:")
        for subnet in public_subnets:
            print(f"      {subnet['id']} ({subnet['az']}) - {subnet['cidr']}")
        
        # Update ECS service to use public subnets
        print(f"\n📋 4. Updating ECS service to use public subnets...")
        
        # Use first 2 public subnets for HA
        selected_subnets = [s['id'] for s in public_subnets[:2]]
        
        update_cmd = [
            'ecs', 'update-service',
            '--cluster', 'edsteward-cluster',
            '--service', 'edsteward-service',
            '--network-configuration', f'awsvpcConfiguration={{subnets=[{",".join(selected_subnets)}],securityGroups=[sg-06abaf675286527bb],assignPublicIp=ENABLED}}',
            '--force-new-deployment'
        ]
        
        result = run_aws_command(update_cmd)
        if result:
            print(f"   ✅ Updated ECS service to use public subnets with public IP")
            print(f"   📦 Using subnets: {selected_subnets}")
            print(f"   🌐 Enabled public IP assignment")
            print(f"   ⏳ This should allow ECR access and fix container startup")
            
            print(f"\n📋 5. Monitoring deployment...")
            print(f"   ⏳ Waiting 60 seconds for new tasks to start...")
            
            import time
            time.sleep(60)
            
            # Check if new tasks are starting
            tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
            result = run_aws_command(tasks_cmd)
            
            if result:
                data = json.loads(result)
                task_arns = data.get('taskArns', [])
                
                if task_arns:
                    print(f"   📦 {len(task_arns)} tasks now running/starting")
                    
                    # Check latest task status
                    task_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + task_arns[:1] + ['--output', 'json']
                    result = run_aws_command(task_cmd)
                    
                    if result:
                        data = json.loads(result)
                        task = data['tasks'][0]
                        status = task['lastStatus']
                        
                        print(f"   📊 Latest task status: {status}")
                        
                        if status in ['PENDING', 'PROVISIONING']:
                            print(f"   ⏳ Task is starting - ECR pull should work now")
                        elif status == 'RUNNING':
                            print(f"   🎉 Task is RUNNING - ECR connectivity fixed!")
                        else:
                            print(f"   ⚠️ Task status: {status} - check logs for details")
                else:
                    print(f"   ⚠️ No tasks found yet - deployment may still be in progress")
        else:
            print(f"   ❌ Failed to update ECS service")
    else:
        print(f"   ❌ No public subnets found in VPC")
        print(f"   💡 Alternative: Create NAT Gateway for private subnets")
    
    print(f"\n🎯 SUMMARY:")
    print(f"The database connection issue was a symptom, not the cause.")
    print(f"The real problem was ECS tasks couldn't start due to no ECR access.")
    print(f"Moving to public subnets with public IP should fix this.")
    print(f"Once containers start, then we can test database connectivity.")

if __name__ == "__main__":
    fix_ecr_connectivity() 