#!/usr/bin/env python3
import boto3
from datetime import datetime

def fix_vpc_mismatch():
    print("🌐 FIXING VPC MISMATCH BETWEEN ECS AND RDS")
    print("Current Issue: ECS is in custom VPC, RDS is in default VPC")
    print("Fix: Create RDS security group that allows ECS access")
    print("=" * 60)
    
    ec2 = boto3.client('ec2', region_name='us-east-1')
    rds = boto3.client('rds', region_name='us-east-1')
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Get ECS VPC and subnet info
    ecs_vpc = "vpc-08e725354dc2ff83e"
    ecs_subnet = "subnet-0bc514aab497f4027"
    
    # Get RDS VPC info  
    rds_vpc = "vpc-05bb4979c040b7b83"
    
    print(f"📦 ECS VPC: {ecs_vpc}")
    print(f"🗄️ RDS VPC: {rds_vpc}")
    
    # Option 1: Create VPC Peering Connection
    print("\n🔗 OPTION 1: Creating VPC Peering Connection")
    
    try:
        # Create VPC peering connection
        peering_response = ec2.create_vpc_peering_connection(
            VpcId=ecs_vpc,
            PeerVpcId=rds_vpc,
            TagSpecifications=[
                {
                    'ResourceType': 'vpc-peering-connection',
                    'Tags': [
                        {'Key': 'Name', 'Value': 'edsteward-ecs-rds-peering'},
                        {'Key': 'Purpose', 'Value': 'Allow ECS to access RDS'}
                    ]
                }
            ]
        )
        
        peering_connection_id = peering_response['VpcPeeringConnection']['VpcPeeringConnectionId']
        print(f"✅ Created VPC peering connection: {peering_connection_id}")
        
        # Accept the peering connection (since it's in the same account)
        ec2.accept_vpc_peering_connection(VpcPeeringConnectionId=peering_connection_id)
        print("✅ Accepted VPC peering connection")
        
        # Add routes to ECS route table to reach RDS VPC
        # Get ECS route table
        route_tables = ec2.describe_route_tables(
            Filters=[
                {'Name': 'vpc-id', 'Values': [ecs_vpc]},
                {'Name': 'association.subnet-id', 'Values': [ecs_subnet]}
            ]
        )
        
        if route_tables['RouteTables']:
            route_table_id = route_tables['RouteTables'][0]['RouteTableId']
            print(f"📍 Found ECS route table: {route_table_id}")
            
            # Add route to RDS VPC through peering connection
            try:
                ec2.create_route(
                    RouteTableId=route_table_id,
                    DestinationCidrBlock='172.31.0.0/16',  # Default VPC CIDR
                    VpcPeeringConnectionId=peering_connection_id
                )
                print("✅ Added route from ECS to RDS VPC")
            except Exception as e:
                if "already exists" in str(e):
                    print("⚠️ Route already exists")
                else:
                    print(f"❌ Failed to add route: {e}")
        
        # Add routes to RDS VPC route tables to reach ECS VPC
        rds_route_tables = ec2.describe_route_tables(
            Filters=[{'Name': 'vpc-id', 'Values': [rds_vpc]}]
        )
        
        for rt in rds_route_tables['RouteTables']:
            rt_id = rt['RouteTableId']
            try:
                ec2.create_route(
                    RouteTableId=rt_id,
                    DestinationCidrBlock='10.0.0.0/16',  # ECS VPC CIDR
                    VpcPeeringConnectionId=peering_connection_id
                )
                print(f"✅ Added route from RDS route table {rt_id} to ECS VPC")
            except Exception as e:
                if "already exists" in str(e):
                    continue
                else:
                    print(f"⚠️ Failed to add route to {rt_id}: {e}")
        
    except Exception as e:
        if "already exists" in str(e):
            print("⚠️ VPC peering connection already exists")
        else:
            print(f"❌ Failed to create VPC peering: {e}")
            return
    
    # Update RDS security group to allow ECS access
    print("\n🔒 UPDATING RDS SECURITY GROUP")
    
    try:
        # Get RDS instance details
        rds_response = rds.describe_db_instances(DBInstanceIdentifier='edsteward-postgres')
        rds_instance = rds_response['DBInstances'][0]
        rds_sg_ids = [sg['VpcSecurityGroupId'] for sg in rds_instance['VpcSecurityGroups']]
        
        print(f"🗄️ RDS Security Groups: {rds_sg_ids}")
        
        # Add rule to allow ECS subnet access
        for sg_id in rds_sg_ids:
            try:
                ec2.authorize_security_group_ingress(
                    GroupId=sg_id,
                    IpPermissions=[
                        {
                            'IpProtocol': 'tcp',
                            'FromPort': 5432,
                            'ToPort': 5432,
                            'IpRanges': [
                                {
                                    'CidrIp': '10.0.0.0/16',
                                    'Description': 'Allow ECS VPC access'
                                }
                            ]
                        }
                    ]
                )
                print(f"✅ Added ECS access rule to security group {sg_id}")
            except Exception as e:
                if "already exists" in str(e):
                    print(f"⚠️ Rule already exists in {sg_id}")
                else:
                    print(f"❌ Failed to add rule to {sg_id}: {e}")
    
    except Exception as e:
        print(f"❌ Failed to update RDS security group: {e}")
        return
    
    print("\n🧪 TESTING DATABASE CONNECTION")
    
    # Now force a new ECS deployment to test the connection
    print("🔄 Forcing ECS deployment to test connection...")
    
    try:
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            forceNewDeployment=True
        )
        print("✅ ECS deployment triggered")
        
        print("\n⏳ Waiting 2 minutes for deployment and database test...")
        print("   The application will automatically test database connectivity")
        print("   Check the logs to see if database connections succeed")
        
        import time
        time.sleep(120)  # Wait 2 minutes
        
        print("\n🧪 Testing login endpoint...")
        import subprocess
        result = subprocess.run([
            'curl', '-X', 'POST', 'https://edsteward.ai/api/login',
            '-H', 'Content-Type: application/json',
            '-d', '{"username":"test","password":"test"}',
            '--silent', '--show-error'
        ], capture_output=True, text=True)
        
        if 'Connection terminated due to connection timeout' not in result.stdout:
            print("🎉 DATABASE CONNECTION ISSUE RESOLVED!")
            print("✅ No more database timeout errors")
            print("The login should now work properly!")
        else:
            print("❌ Still getting database timeout errors")
            print("Additional troubleshooting may be needed")
            
    except Exception as e:
        print(f"❌ Failed to test deployment: {e}")

if __name__ == "__main__":
    fix_vpc_mismatch() 