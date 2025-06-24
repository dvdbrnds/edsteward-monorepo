#!/usr/bin/env python3
import boto3
import json
from datetime import datetime

def move_ecs_to_default_vpc():
    print("📦 MOVING ECS SERVICE TO DEFAULT VPC")
    print("This will place ECS in the same VPC as RDS for direct connectivity")
    print("=" * 60)
    
    ec2 = boto3.client('ec2', region_name='us-east-1')
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Default VPC info (where RDS is)
    default_vpc = "vpc-05bb4979c040b7b83"
    
    print(f"🎯 Target VPC: {default_vpc} (default VPC where RDS exists)")
    
    # Get default VPC subnets
    subnets_response = ec2.describe_subnets(
        Filters=[
            {'Name': 'vpc-id', 'Values': [default_vpc]},
            {'Name': 'default-for-az', 'Values': ['true']}
        ]
    )
    
    default_subnets = [subnet['SubnetId'] for subnet in subnets_response['Subnets']]
    print(f"📍 Default VPC subnets: {default_subnets}")
    
    # Create or update security group for ECS in default VPC
    print("\n🔒 Creating ECS security group in default VPC...")
    
    try:
        sg_response = ec2.create_security_group(
            GroupName='edsteward-ecs-sg',
            Description='Security group for EdSteward ECS tasks',
            VpcId=default_vpc,
            TagSpecifications=[
                {
                    'ResourceType': 'security-group',
                    'Tags': [
                        {'Key': 'Name', 'Value': 'edsteward-ecs-sg'},
                        {'Key': 'Purpose', 'Value': 'ECS task security group'}
                    ]
                }
            ]
        )
        ecs_sg_id = sg_response['GroupId']
        print(f"✅ Created ECS security group: {ecs_sg_id}")
        
        # Add outbound rules for database access
        ec2.authorize_security_group_egress(
            GroupId=ecs_sg_id,
            IpPermissions=[
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 5432,
                    'ToPort': 5432,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'PostgreSQL access'}]
                },
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 443,
                    'ToPort': 443,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'HTTPS access'}]
                },
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 80,
                    'ToPort': 80,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'HTTP access'}]
                }
            ]
        )
        
        # Add inbound rule for load balancer
        ec2.authorize_security_group_ingress(
            GroupId=ecs_sg_id,
            IpPermissions=[
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 3000,
                    'ToPort': 3000,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'Application access'}]
                }
            ]
        )
        
        print("✅ Configured security group rules")
        
    except Exception as e:
        if "already exists" in str(e):
            # Get existing security group
            sgs = ec2.describe_security_groups(
                Filters=[
                    {'Name': 'group-name', 'Values': ['edsteward-ecs-sg']},
                    {'Name': 'vpc-id', 'Values': [default_vpc]}
                ]
            )
            if sgs['SecurityGroups']:
                ecs_sg_id = sgs['SecurityGroups'][0]['GroupId']
                print(f"⚠️ Using existing security group: {ecs_sg_id}")
            else:
                print(f"❌ Failed to create security group: {e}")
                return
        else:
            print(f"❌ Failed to create security group: {e}")
            return
    
    # Get current task definition
    print("\n📋 Getting current task definition...")
    current_task_def = ecs.describe_task_definition(taskDefinition='edsteward')['taskDefinition']
    
    # Create new task definition with default VPC network configuration
    new_task_def = {
        'family': current_task_def['family'],
        'executionRoleArn': current_task_def['executionRoleArn'],
        'networkMode': 'awsvpc',
        'requiresCompatibilities': ['FARGATE'],
        'cpu': current_task_def['cpu'],
        'memory': current_task_def['memory'],
        'containerDefinitions': current_task_def['containerDefinitions']
    }
    
    print("📋 Registering new task definition...")
    response = ecs.register_task_definition(**new_task_def)
    new_revision = response['taskDefinition']['revision']
    
    print(f"✅ Created task definition: {new_task_def['family']}:{new_revision}")
    
    # Update ECS service with new network configuration
    print("\n🔄 Updating ECS service network configuration...")
    
    try:
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=f"{new_task_def['family']}:{new_revision}",
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': default_subnets,
                    'securityGroups': [ecs_sg_id],
                    'assignPublicIp': 'ENABLED'  # Needed for internet access in default VPC
                }
            },
            forceNewDeployment=True
        )
        
        print("✅ Service updated with new network configuration")
        
        print("\n⏳ Waiting for deployment...")
        
        # Monitor deployment
        import time
        for i in range(18):  # 18 * 10 = 3 minutes
            time.sleep(10)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            
            print(f"   Status check {i+1}/18: Running={running_count}")
            
            if running_count > 0:
                print("🎉 Task is running in default VPC!")
                break
        
        if running_count > 0:
            print("\n🧪 Testing database connectivity...")
            time.sleep(30)  # Wait for app to start
            
            # Test login endpoint
            import subprocess
            result = subprocess.run([
                'curl', '-X', 'POST', 'https://edsteward.ai/api/login',
                '-H', 'Content-Type: application/json',
                '-d', '{"username":"test","password":"test"}',
                '--silent'
            ], capture_output=True, text=True)
            
            if 'Connection terminated due to connection timeout' not in result.stdout:
                print("🎉 DATABASE CONNECTION FIXED!")
                print("✅ No more timeout errors!")
                print("🎯 Login functionality should now work!")
                
                if '401' in result.stdout:
                    print("✅ Getting proper 401 (Unauthorized) - authentication system working!")
                elif '500' not in result.stdout:
                    print("✅ No 500 errors - server is responding normally!")
                
            else:
                print("❌ Still getting database timeouts")
                print("May need additional troubleshooting")
        else:
            print("❌ Task failed to start - check logs")
            
    except Exception as e:
        print(f"❌ Failed to update service: {e}")

if __name__ == "__main__":
    move_ecs_to_default_vpc() 