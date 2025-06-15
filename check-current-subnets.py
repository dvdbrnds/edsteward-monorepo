#!/usr/bin/env python3

import subprocess
import json

def run_cmd(command):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    print("🔍 CHECKING CURRENT RDS SUBNET CONFIGURATION")
    print("=" * 60)
    
    # Get RDS subnet details
    success, output, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if success:
        rds_data = json.loads(output)
        db_instance = rds_data['DBInstances'][0]
        
        current_subnets = [subnet['SubnetIdentifier'] for subnet in db_instance['DBSubnetGroup']['Subnets']]
        vpc_id = db_instance['DBSubnetGroup']['VpcId']
        
        print(f"RDS VPC: {vpc_id}")
        print(f"Current subnets: {current_subnets}")
        
        # Check each subnet
        for subnet_id in current_subnets:
            success, subnet_output, _ = run_cmd(f'aws ec2 describe-subnets --subnet-ids {subnet_id} --output json')
            
            if success:
                subnet_data = json.loads(subnet_output)
                subnet = subnet_data['Subnets'][0]
                
                print(f"\n📍 Subnet: {subnet_id}")
                print(f"   AZ: {subnet['AvailabilityZone']}")
                print(f"   CIDR: {subnet['CidrBlock']}")
                print(f"   MapPublicIpOnLaunch: {subnet.get('MapPublicIpOnLaunch', False)}")
                
                # Check route table
                success, rt_output, _ = run_cmd('aws ec2 describe-route-tables --output json')
                
                if success:
                    rt_data = json.loads(rt_output)
                    
                    for rt in rt_data['RouteTables']:
                        if rt['VpcId'] == vpc_id:
                            # Check if this subnet is associated with this route table
                            subnet_in_rt = False
                            
                            for assoc in rt.get('Associations', []):
                                if assoc.get('SubnetId') == subnet_id:
                                    subnet_in_rt = True
                                    break
                            
                            # If no explicit association, check if it's the main route table
                            if not subnet_in_rt:
                                for assoc in rt.get('Associations', []):
                                    if assoc.get('Main', False):
                                        subnet_in_rt = True
                                        break
                            
                            if subnet_in_rt:
                                print(f"   Route Table: {rt['RouteTableId']}")
                                
                                # Check routes
                                has_igw = False
                                for route in rt.get('Routes', []):
                                    dest = route.get('DestinationCidrBlock', '')
                                    gateway = route.get('GatewayId', '')
                                    
                                    if dest == '0.0.0.0/0':
                                        if gateway.startswith('igw-'):
                                            has_igw = True
                                            print(f"   ✅ Has internet gateway route: {gateway}")
                                        elif gateway.startswith('nat-'):
                                            print(f"   🔄 Has NAT gateway route: {gateway}")
                                        else:
                                            print(f"   📋 Default route to: {gateway}")
                                
                                if not has_igw:
                                    print(f"   ❌ No internet gateway route found")
                                
                                break
        
        # Check if we can modify the route tables instead
        print(f"\n🔧 SOLUTION OPTIONS:")
        print(f"1. Modify route tables to add internet gateway routes")
        print(f"2. Create new RDS in different VPC")
        print(f"3. Use EC2 jump host in public subnet")
        
        # Let's try option 1 - modify route tables
        print(f"\n🚀 ATTEMPTING TO ADD INTERNET GATEWAY ROUTES...")
        
        # Find the internet gateway for this VPC
        success, igw_output, _ = run_cmd(f'aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values={vpc_id}" --output json')
        
        if success:
            igw_data = json.loads(igw_output)
            if igw_data['InternetGateways']:
                igw_id = igw_data['InternetGateways'][0]['InternetGatewayId']
                print(f"✅ Found internet gateway: {igw_id}")
                
                # Now find route tables for our subnets and add IGW routes
                for subnet_id in current_subnets:
                    print(f"\nModifying routes for subnet {subnet_id}...")
                    
                    # Find the route table for this subnet
                    success, rt_output, _ = run_cmd('aws ec2 describe-route-tables --output json')
                    
                    if success:
                        rt_data = json.loads(rt_output)
                        
                        for rt in rt_data['RouteTables']:
                            if rt['VpcId'] == vpc_id:
                                # Check if this subnet is associated
                                subnet_in_rt = False
                                rt_id = rt['RouteTableId']
                                
                                for assoc in rt.get('Associations', []):
                                    if assoc.get('SubnetId') == subnet_id:
                                        subnet_in_rt = True
                                        break
                                
                                # Check if it's main route table
                                if not subnet_in_rt:
                                    for assoc in rt.get('Associations', []):
                                        if assoc.get('Main', False):
                                            subnet_in_rt = True
                                            break
                                
                                if subnet_in_rt:
                                    print(f"   Route table: {rt_id}")
                                    
                                    # Try to add internet gateway route
                                    success, _, error = run_cmd(f'aws ec2 create-route --route-table-id {rt_id} --destination-cidr-block 0.0.0.0/0 --gateway-id {igw_id}')
                                    
                                    if success:
                                        print(f"   ✅ Added internet gateway route")
                                    else:
                                        if "already exists" in error.lower():
                                            print(f"   ✅ Internet gateway route already exists")
                                        else:
                                            print(f"   ❌ Failed to add route: {error}")
                                    
                                    break
            else:
                print(f"❌ No internet gateway found for VPC {vpc_id}")
        
        print(f"\n🧪 TESTING CONNECTION AFTER ROUTE MODIFICATIONS...")
        
        # Test connection
        try:
            import psycopg2
            
            endpoint = db_instance['Endpoint']['Address']
            
            conn = psycopg2.connect(
                host=endpoint,
                port=5432,
                database='postgres',
                user='postgres',
                password='EdSteward2024!Secure',
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            cursor.execute('SELECT version();')
            version = cursor.fetchone()[0]
            
            print("🎉 CONNECTION SUCCESSFUL!")
            print(f"PostgreSQL version: {version}")
            
            cursor.close()
            conn.close()
            
            return True
            
        except Exception as e:
            print(f"❌ Connection still failed: {e}")
            print("The subnets may still be considered private or routes need time to propagate.")
            return False

if __name__ == "__main__":
    main() 