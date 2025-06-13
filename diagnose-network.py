#!/usr/bin/env python3
"""
Comprehensive network diagnostic for ECS to RDS connectivity
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

def diagnose_network():
    """Comprehensive network diagnosis"""
    print("🌐 COMPREHENSIVE NETWORK DIAGNOSIS")
    print("=" * 50)
    
    # ================================
    # 1. VERIFY SUBNET CONFIGURATIONS
    # ================================
    print("\n📋 1. VERIFYING SUBNET CONFIGURATIONS")
    print("-" * 40)
    
    # Get ECS task subnet info
    print("\n🔍 ECS Task Subnet Analysis:")
    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
    result = run_aws_command(tasks_cmd)
    
    ecs_subnets = []
    if result:
        data = json.loads(result)
        task_arns = data.get('taskArns', [])
        
        if task_arns:
            task_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks'] + task_arns + ['--output', 'json']
            result = run_aws_command(task_cmd)
            
            if result:
                data = json.loads(result)
                for task in data['tasks']:
                    for attachment in task.get('attachments', []):
                        if attachment['type'] == 'ElasticNetworkInterface':
                            for detail in attachment['details']:
                                if detail['name'] == 'subnetId':
                                    subnet_id = detail['value']
                                    ecs_subnets.append(subnet_id)
                                    print(f"   📦 ECS Task Subnet: {subnet_id}")
    
    # Get detailed subnet info for ECS subnets
    for subnet_id in set(ecs_subnets):
        subnet_cmd = ['ec2', 'describe-subnets', '--subnet-ids', subnet_id, '--output', 'json']
        result = run_aws_command(subnet_cmd)
        
        if result:
            data = json.loads(result)
            subnet = data['Subnets'][0]
            
            vpc_id = subnet['VpcId']
            az = subnet['AvailabilityZone']
            cidr = subnet['CidrBlock']
            is_public = any(tag.get('Value') == 'public' for tag in subnet.get('Tags', []) if tag.get('Key') == 'Type')
            
            print(f"      VPC: {vpc_id}")
            print(f"      AZ: {az}")
            print(f"      CIDR: {cidr}")
            print(f"      Type: {'PUBLIC' if is_public else 'PRIVATE'}")
            
            # Check route table
            route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
            result = run_aws_command(route_cmd)
            
            if result:
                data = json.loads(result)
                if data['RouteTables']:
                    route_table = data['RouteTables'][0]
                    route_table_id = route_table['RouteTableId']
                    print(f"      Route Table: {route_table_id}")
                    
                    # Check for internet gateway route
                    has_igw = any('igw-' in route.get('GatewayId', '') for route in route_table['Routes'])
                    has_nat = any('nat-' in route.get('NatGatewayId', '') for route in route_table['Routes'])
                    print(f"      Internet Access: {'IGW' if has_igw else 'NAT' if has_nat else 'NONE'}")
    
    # Get RDS subnet info
    print("\n🔍 RDS Subnet Analysis:")
    rds_cmd = ['rds', 'describe-db-instances', '--db-instance-identifier', 'edsteward-postgres', '--output', 'json']
    result = run_aws_command(rds_cmd)
    
    rds_subnets = []
    rds_vpc = None
    if result:
        data = json.loads(result)
        db = data['DBInstances'][0]
        
        rds_vpc = db['DBSubnetGroup']['VpcId']
        rds_subnets = [subnet['SubnetIdentifier'] for subnet in db['DBSubnetGroup']['Subnets']]
        
        print(f"   🗄️ RDS VPC: {rds_vpc}")
        print(f"   🗄️ RDS Subnets: {rds_subnets}")
        
        for subnet_id in rds_subnets:
            subnet_cmd = ['ec2', 'describe-subnets', '--subnet-ids', subnet_id, '--output', 'json']
            result = run_aws_command(subnet_cmd)
            
            if result:
                data = json.loads(result)
                subnet = data['Subnets'][0]
                
                az = subnet['AvailabilityZone']
                cidr = subnet['CidrBlock']
                print(f"      {subnet_id}: {az} - {cidr}")
    
    # ===============================
    # 2. CHECK ROUTE TABLES AND NACLS
    # ===============================
    print("\n📋 2. CHECKING ROUTE TABLES AND NETWORK ACLS")
    print("-" * 40)
    
    # Check route tables for ECS subnets
    print("\n🛣️ ECS Subnet Route Tables:")
    for subnet_id in set(ecs_subnets):
        print(f"\n   📍 Routes for {subnet_id}:")
        
        route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
        result = run_aws_command(route_cmd)
        
        if result:
            data = json.loads(result)
            if data['RouteTables']:
                route_table = data['RouteTables'][0]
                
                for route in route_table['Routes']:
                    dest = route.get('DestinationCidrBlock', 'N/A')
                    target = route.get('GatewayId') or route.get('NatGatewayId') or route.get('NetworkInterfaceId') or 'local'
                    state = route.get('State', 'active')
                    print(f"      {dest} → {target} ({state})")
    
    # Check NACLs for ECS subnets
    print("\n🛡️ Network ACLs for ECS Subnets:")
    for subnet_id in set(ecs_subnets):
        nacl_cmd = ['ec2', 'describe-network-acls', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
        result = run_aws_command(nacl_cmd)
        
        if result:
            data = json.loads(result)
            if data['NetworkAcls']:
                nacl = data['NetworkAcls'][0]
                nacl_id = nacl['NetworkAclId']
                
                print(f"\n   🛡️ NACL {nacl_id} for {subnet_id}:")
                
                # Check outbound rules for PostgreSQL
                for entry in nacl['Entries']:
                    if not entry['Egress']:  # Inbound rules
                        continue
                        
                    rule_num = entry['RuleNumber']
                    action = entry['RuleAction']
                    protocol = entry.get('Protocol', '')
                    port_range = entry.get('PortRange', {})
                    cidr = entry.get('CidrBlock', 'N/A')
                    
                    # Check for PostgreSQL port 5432
                    if (protocol == '6' and port_range and 
                        port_range.get('From', 0) <= 5432 <= port_range.get('To', 65535)):
                        print(f"      Rule {rule_num}: {action} TCP {port_range.get('From')}-{port_range.get('To')} to {cidr}")
                    elif protocol == '-1':  # All traffic
                        print(f"      Rule {rule_num}: {action} ALL traffic to {cidr}")
    
    # Check RDS subnet route tables
    print("\n🛣️ RDS Subnet Route Tables:")
    for subnet_id in rds_subnets[:2]:  # Check first 2 RDS subnets
        print(f"\n   📍 Routes for RDS subnet {subnet_id}:")
        
        route_cmd = ['ec2', 'describe-route-tables', '--filters', f'Name=association.subnet-id,Values={subnet_id}', '--output', 'json']
        result = run_aws_command(route_cmd)
        
        if result:
            data = json.loads(result)
            if data['RouteTables']:
                route_table = data['RouteTables'][0]
                
                for route in route_table['Routes']:
                    dest = route.get('DestinationCidrBlock', 'N/A')
                    target = route.get('GatewayId') or route.get('NatGatewayId') or route.get('NetworkInterfaceId') or 'local'
                    state = route.get('State', 'active')
                    print(f"      {dest} → {target} ({state})")
    
    # ====================================
    # 3. TEST DNS RESOLUTION FROM ECS ENV
    # ====================================
    print("\n📋 3. TESTING DNS RESOLUTION FROM ECS ENVIRONMENT")
    print("-" * 40)
    
    # First, test DNS from current environment (as proxy)
    print("\n🧪 Testing DNS resolution locally:")
    try:
        import socket
        hostname = "edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
        ip = socket.gethostbyname(hostname)
        print(f"   ✅ {hostname} resolves to {ip}")
        
        # Test if this IP is reachable
        test_cmd = ['nc', '-z', '-v', '-w', '3', ip, '5432']
        result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"   ✅ Port 5432 is reachable on {ip}")
        else:
            print(f"   ❌ Port 5432 is NOT reachable on {ip}")
            print(f"      Error: {result.stderr}")
            
    except Exception as e:
        print(f"   ❌ DNS resolution failed: {e}")
    
    # Create an ECS task to test DNS from within the VPC
    print("\n🧪 Testing DNS resolution from ECS task:")
    
    # Check if we can run a debug task in the same subnet
    print("   📦 Attempting to run debug task in ECS subnet...")
    
    # Use a simple busybox container to test connectivity
    task_def = {
        "family": "edsteward-debug",
        "networkMode": "awsvpc",
        "requiresCompatibilities": ["FARGATE"],
        "cpu": "256",
        "memory": "512",
        "executionRoleArn": "arn:aws:iam::259661441422:role/ecsTaskExecutionRole",
        "containerDefinitions": [
            {
                "name": "debug",
                "image": "busybox:latest",
                "command": [
                    "sh", "-c",
                    "echo 'Testing DNS resolution:' && "
                    "nslookup edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com && "
                    "echo 'Testing connectivity:' && "
                    "nc -z -v edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com 5432 && "
                    "sleep 30"
                ],
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group": "/aws/ecs/edsteward",
                        "awslogs-region": "us-east-1",
                        "awslogs-stream-prefix": "debug"
                    }
                }
            }
        ]
    }
    
    # Register debug task definition
    with open('/tmp/debug-task-def.json', 'w') as f:
        json.dump(task_def, f, indent=2)
    
    register_cmd = [
        'ecs', 'register-task-definition',
        '--cli-input-json', 'file:///tmp/debug-task-def.json',
        '--output', 'json'
    ]
    
    result = run_aws_command(register_cmd)
    if result:
        data = json.loads(result)
        debug_task_arn = data['taskDefinition']['taskDefinitionArn']
        
        print(f"   ✅ Registered debug task: {debug_task_arn}")
        
        # Run the debug task in the same subnet as our ECS service
        if ecs_subnets:
            run_cmd = [
                'ecs', 'run-task',
                '--cluster', 'edsteward-cluster',
                '--task-definition', 'edsteward-debug',
                '--launch-type', 'FARGATE',
                '--network-configuration', f'awsvpcConfiguration={{subnets=[{ecs_subnets[0]}],securityGroups=[sg-06abaf675286527bb],assignPublicIp=DISABLED}}',
                '--output', 'json'
            ]
            
            result = run_aws_command(run_cmd)
            if result:
                data = json.loads(result)
                debug_task_arn = data['tasks'][0]['taskArn']
                
                print(f"   🚀 Started debug task: {debug_task_arn.split('/')[-1]}")
                print("   ⏳ Waiting 30 seconds for debug task to complete...")
                
                time.sleep(30)
                
                # Check debug task logs
                print("   📄 Debug task logs:")
                time.sleep(5)  # Wait a bit more for logs
                
                logs_cmd = [
                    'logs', 'filter-log-events',
                    '--log-group-name', '/aws/ecs/edsteward',
                    '--start-time', str(int((time.time() - 300) * 1000)),
                    '--filter-pattern', 'debug',
                    '--output', 'text'
                ]
                
                result = run_aws_command(logs_cmd)
                if result:
                    lines = result.split('\n')
                    for line in lines[-20:]:  # Show last 20 lines
                        if 'debug' in line and line.strip():
                            event_part = line.split('\t')[-1] if '\t' in line else line
                            print(f"      {event_part}")
                else:
                    print("      ⚠️ No debug logs found yet")
                
                # Clean up debug task
                stop_cmd = ['ecs', 'stop-task', '--cluster', 'edsteward-cluster', '--task', debug_task_arn]
                run_aws_command(stop_cmd)
                
            else:
                print("   ❌ Failed to start debug task")
        else:
            print("   ❌ No ECS subnets found to run debug task")
    else:
        print("   ❌ Failed to register debug task definition")
    
    # SUMMARY
    print("\n🎯 NETWORK DIAGNOSIS SUMMARY:")
    print("=" * 40)
    print("Key things to check in the results above:")
    print("1. Are ECS and RDS in the same VPC?")
    print("2. Do ECS subnets have routes to RDS subnets?")
    print("3. Do NACLs allow outbound traffic on port 5432?")
    print("4. Does DNS resolution work from within the ECS environment?")
    print("5. Is there network connectivity from ECS subnet to RDS IP?")

if __name__ == "__main__":
    diagnose_network() 