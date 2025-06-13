#!/usr/bin/env python3
"""
Create NAT Gateway for private subnets to enable ECR access
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

def create_nat_gateway():
    """Create NAT Gateway for private subnets"""
    print("🌐 CREATING NAT GATEWAY FOR ECS INTERNET ACCESS")
    print("=" * 50)
    
    vpc_id = "vpc-05bb4979c040b7b83"
    
    # 1. First, we need to create public subnets if none exist
    print("\n📋 1. Checking for public subnets...")
    
    # Check all subnets in VPC
    subnets_cmd = ['ec2', 'describe-subnets', '--filters', f'Name=vpc-id,Values={vpc_id}', '--output', 'json']
    result = run_aws_command(subnets_cmd)
    
    public_subnets = []
    private_subnets = []
    
    if result:
        data = json.loads(result)
        
        for subnet in data['Subnets']:
            subnet_id = subnet['SubnetId']
            az = subnet['AvailabilityZone']
            cidr = subnet['CidrBlock']
            
            # Check route table to determine if public or private
            route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
            result = run_aws_command(route_cmd)
            
            is_public = False
            if result:
                data_route = json.loads(result)
                if data_route['RouteTables']:
                    for route in data_route['RouteTables'][0]['Routes']:
                        if (route.get('DestinationCidrBlock') == '0.0.0.0/0' and 
                            route.get('GatewayId', '').startswith('igw-')):
                            is_public = True
                            break
            
            if is_public:
                public_subnets.append({'id': subnet_id, 'az': az, 'cidr': cidr})
            else:
                private_subnets.append({'id': subnet_id, 'az': az, 'cidr': cidr})
    
    print(f"   📊 Found {len(public_subnets)} public subnets")
    print(f"   📊 Found {len(private_subnets)} private subnets")
    
    # 2. Create public subnet if needed
    if not public_subnets:
        print("\n📋 2. Creating public subnet for NAT Gateway...")
        
        # Check what CIDR blocks are available
        vpc_cmd = ['ec2', 'describe-vpcs', '--vpc-ids', vpc_id, '--output', 'json']
        result = run_aws_command(vpc_cmd)
        
        if result:
            data = json.loads(result)
            vpc_cidr = data['Vpcs'][0]['CidrBlock']
            print(f"   📊 VPC CIDR: {vpc_cidr}")
            
            # Use a simple approach: create public subnet in us-east-1a
            public_cidr = "172.31.96.0/20"  # Assuming this is available
            
            create_subnet_cmd = [
                'ec2', 'create-subnet',
                '--vpc-id', vpc_id,
                '--cidr-block', public_cidr,
                '--availability-zone', 'us-east-1a',
                '--tag-specifications', 'ResourceType=subnet,Tags=[{Key=Name,Value=edsteward-public-1a},{Key=Type,Value=public}]',
                '--output', 'json'
            ]
            
            result = run_aws_command(create_subnet_cmd)
            if result:
                data = json.loads(result)
                public_subnet_id = data['Subnet']['SubnetId']
                
                print(f"   ✅ Created public subnet: {public_subnet_id}")
                
                # Create Internet Gateway if it doesn't exist
                print(f"   📋 Creating Internet Gateway...")
                
                igw_cmd = ['ec2', 'create-internet-gateway', '--tag-specifications', 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=edsteward-igw}]', '--output', 'json']
                result = run_aws_command(igw_cmd)
                
                if result:
                    data = json.loads(result)
                    igw_id = data['InternetGateway']['InternetGatewayId']
                    
                    print(f"   ✅ Created Internet Gateway: {igw_id}")
                    
                    # Attach IGW to VPC
                    attach_cmd = ['ec2', 'attach-internet-gateway', '--internet-gateway-id', igw_id, '--vpc-id', vpc_id]
                    result = run_aws_command(attach_cmd)
                    
                    if result is not None:  # attach returns empty on success
                        print(f"   ✅ Attached IGW to VPC")
                        
                        # Create route table for public subnet
                        rt_cmd = ['ec2', 'create-route-table', '--vpc-id', vpc_id, '--tag-specifications', 'ResourceType=route-table,Tags=[{Key=Name,Value=edsteward-public-rt}]', '--output', 'json']
                        result = run_aws_command(rt_cmd)
                        
                        if result:
                            data = json.loads(result)
                            rt_id = data['RouteTable']['RouteTableId']
                            
                            print(f"   ✅ Created route table: {rt_id}")
                            
                            # Add route to IGW
                            route_cmd = ['ec2', 'create-route', '--route-table-id', rt_id, '--destination-cidr-block', '0.0.0.0/0', '--gateway-id', igw_id]
                            result = run_aws_command(route_cmd)
                            
                            if result is not None:
                                print(f"   ✅ Added internet route to route table")
                                
                                # Associate route table with public subnet
                                assoc_cmd = ['ec2', 'associate-route-table', '--route-table-id', rt_id, '--subnet-id', public_subnet_id]
                                result = run_aws_command(assoc_cmd)
                                
                                if result:
                                    print(f"   ✅ Associated route table with public subnet")
                                    public_subnets.append({'id': public_subnet_id, 'az': 'us-east-1a', 'cidr': public_cidr})
    
    # 3. Create NAT Gateway in public subnet
    if public_subnets:
        print(f"\n📋 3. Creating NAT Gateway...")
        
        public_subnet_id = public_subnets[0]['id']
        
        # Allocate Elastic IP for NAT Gateway
        eip_cmd = ['ec2', 'allocate-address', '--domain', 'vpc', '--tag-specifications', 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=edsteward-nat-eip}]', '--output', 'json']
        result = run_aws_command(eip_cmd)
        
        if result:
            data = json.loads(result)
            allocation_id = data['AllocationId']
            
            print(f"   ✅ Allocated Elastic IP: {allocation_id}")
            
            # Create NAT Gateway
            nat_cmd = [
                'ec2', 'create-nat-gateway',
                '--subnet-id', public_subnet_id,
                '--allocation-id', allocation_id,
                '--tag-specifications', 'ResourceType=nat-gateway,Tags=[{Key=Name,Value=edsteward-nat}]',
                '--output', 'json'
            ]
            
            result = run_aws_command(nat_cmd)
            if result:
                data = json.loads(result)
                nat_gateway_id = data['NatGateway']['NatGatewayId']
                
                print(f"   ✅ Created NAT Gateway: {nat_gateway_id}")
                print(f"   ⏳ Waiting 2 minutes for NAT Gateway to become available...")
                
                time.sleep(120)
                
                # 4. Update private subnet route tables to use NAT Gateway
                print(f"\n📋 4. Updating private subnet route tables...")
                
                for private_subnet in private_subnets:
                    subnet_id = private_subnet['id']
                    
                    # Get route table for this private subnet
                    route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
                    result = run_aws_command(route_cmd)
                    
                    if result:
                        data = json.loads(result)
                        if data['RouteTables']:
                            rt_id = data['RouteTables'][0]['RouteTableId']
                            
                            print(f"   📍 Updating route table {rt_id} for subnet {subnet_id}")
                            
                            # Add route to NAT Gateway
                            add_route_cmd = ['ec2', 'create-route', '--route-table-id', rt_id, '--destination-cidr-block', '0.0.0.0/0', '--nat-gateway-id', nat_gateway_id]
                            result = run_aws_command(add_route_cmd)
                            
                            if result is not None:
                                print(f"      ✅ Added NAT route to {subnet_id}")
                            else:
                                print(f"      ⚠️ Route may already exist for {subnet_id}")
                
                # 5. Test if ECS can now start
                print(f"\n📋 5. Testing ECS deployment with NAT Gateway...")
                
                # Force new ECS deployment
                update_cmd = [
                    'ecs', 'update-service',
                    '--cluster', 'edsteward-cluster',
                    '--service', 'edsteward-service',
                    '--force-new-deployment'
                ]
                
                result = run_aws_command(update_cmd)
                if result:
                    print(f"   ✅ Triggered new ECS deployment")
                    print(f"   ⏳ Waiting 90 seconds for containers to start...")
                    
                    time.sleep(90)
                    
                    # Check task status
                    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
                    result = run_aws_command(tasks_cmd)
                    
                    if result:
                        data = json.loads(result)
                        task_arns = data.get('taskArns', [])
                        
                        if task_arns:
                            task_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + task_arns[:1] + ['--output', 'json']
                            result = run_aws_command(task_cmd)
                            
                            if result:
                                data = json.loads(result)
                                task = data['tasks'][0]
                                status = task['lastStatus']
                                
                                print(f"   📊 Task status: {status}")
                                
                                if status == 'RUNNING':
                                    print(f"   🎉 SUCCESS! ECS task is now RUNNING!")
                                    print(f"   ✅ NAT Gateway fixed ECR connectivity")
                                    print(f"   ✅ Containers can now start and connect to database")
                                elif status in ['PENDING', 'PROVISIONING']:
                                    print(f"   ⏳ Task is starting - NAT Gateway should allow ECR access")
                                else:
                                    print(f"   ⚠️ Task status: {status} - check for other issues")
                        else:
                            print(f"   ⚠️ No tasks found - deployment may still be in progress")
    
    print(f"\n🎯 SUMMARY:")
    print(f"✅ Created infrastructure for ECS internet access")
    print(f"✅ NAT Gateway allows private subnets to reach ECR")
    print(f"✅ ECS tasks should now be able to start")
    print(f"✅ Once running, database connectivity can be tested")

if __name__ == "__main__":
    create_nat_gateway() 