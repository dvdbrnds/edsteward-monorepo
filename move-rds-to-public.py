#!/usr/bin/env python3
"""
Move RDS to Public Subnets
==========================

This script will:
1. Find your public subnets
2. Create a new DB subnet group with public subnets
3. Move your RDS to the public subnet group
4. Test the connection
"""

import subprocess
import json
import time
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_cmd(command):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    log("🌐 MOVING RDS TO PUBLIC SUBNETS")
    log("=" * 50)
    
    # Step 1: Find public subnets in the same VPC as RDS
    log("📍 STEP 1: Finding public subnets...")
    
    # Get RDS VPC
    success, rds_output, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if not success:
        log("❌ Failed to get RDS details")
        return False
    
    try:
        rds_data = json.loads(rds_output)
        rds_vpc = rds_data['DBInstances'][0]['DBSubnetGroup']['VpcId']
        current_subnets = [subnet['SubnetIdentifier'] for subnet in rds_data['DBInstances'][0]['DBSubnetGroup']['Subnets']]
        
        log(f"✅ RDS VPC: {rds_vpc}")
        log(f"✅ Current subnets: {current_subnets}")
        
    except json.JSONDecodeError:
        log("❌ Failed to parse RDS data")
        return False
    
    # Find public subnets in the same VPC
    success, subnet_output, _ = run_cmd(f'aws ec2 describe-subnets --filters "Name=vpc-id,Values={rds_vpc}" --output json')
    
    if not success:
        log("❌ Failed to get subnets")
        return False
    
    try:
        subnet_data = json.loads(subnet_output)
        all_subnets = subnet_data['Subnets']
        
        # Find public subnets (ones with MapPublicIpOnLaunch=true or with internet gateway routes)
        public_subnets = []
        
        for subnet in all_subnets:
            subnet_id = subnet['SubnetId']
            is_public = subnet.get('MapPublicIpOnLaunch', False)
            
            if is_public:
                public_subnets.append(subnet_id)
                log(f"   🌐 Found public subnet: {subnet_id} (AZ: {subnet['AvailabilityZone']})")
        
        if len(public_subnets) < 2:
            log("❌ Need at least 2 public subnets for RDS. Checking route tables...")
            
            # Check route tables to find subnets with internet gateway routes
            success, rt_output, _ = run_cmd('aws ec2 describe-route-tables --output json')
            
            if success:
                rt_data = json.loads(rt_output)
                
                for subnet in all_subnets:
                    subnet_id = subnet['SubnetId']
                    
                    # Find route table for this subnet
                    for rt in rt_data['RouteTables']:
                        if rt['VpcId'] == rds_vpc:
                            # Check if subnet is explicitly associated
                            for assoc in rt.get('Associations', []):
                                if assoc.get('SubnetId') == subnet_id:
                                    # Check if route table has internet gateway route
                                    for route in rt.get('Routes', []):
                                        if route.get('DestinationCidrBlock') == '0.0.0.0/0' and 'GatewayId' in route and route['GatewayId'].startswith('igw-'):
                                            if subnet_id not in public_subnets:
                                                public_subnets.append(subnet_id)
                                                log(f"   🌐 Found public subnet via route table: {subnet_id}")
        
        if len(public_subnets) < 2:
            log("❌ Not enough public subnets found. Need at least 2 for RDS.")
            log("Available subnets:")
            for subnet in all_subnets:
                log(f"   {subnet['SubnetId']} - AZ: {subnet['AvailabilityZone']} - Public: {subnet.get('MapPublicIpOnLaunch', False)}")
            return False
        
        log(f"✅ Found {len(public_subnets)} public subnets")
        
    except json.JSONDecodeError:
        log("❌ Failed to parse subnet data")
        return False
    
    # Step 2: Create new DB subnet group with public subnets
    log("\n📍 STEP 2: Creating public DB subnet group...")
    
    public_subnet_group_name = "edsteward-public-subnets"
    
    # Delete existing public subnet group if it exists
    run_cmd(f'aws rds delete-db-subnet-group --db-subnet-group-name {public_subnet_group_name}')
    time.sleep(2)
    
    # Create new subnet group
    subnet_list = ' '.join(public_subnets[:2])  # Use first 2 public subnets
    success, _, error = run_cmd(f'aws rds create-db-subnet-group --db-subnet-group-name {public_subnet_group_name} --db-subnet-group-description "Public subnets for RDS access" --subnet-ids {subnet_list}')
    
    if success:
        log(f"✅ Created public subnet group: {public_subnet_group_name}")
    else:
        log(f"❌ Failed to create subnet group: {error}")
        return False
    
    # Step 3: Move RDS to public subnet group
    log("\n📍 STEP 3: Moving RDS to public subnets...")
    
    success, _, error = run_cmd(f'aws rds modify-db-instance --db-instance-identifier edsteward-db --db-subnet-group-name {public_subnet_group_name} --apply-immediately')
    
    if success:
        log("✅ Started RDS modification to use public subnets")
        log("⏳ Waiting for modification to complete (this may take 5-10 minutes)...")
        
        # Wait for modification to complete
        success, _, _ = run_cmd('aws rds wait db-instance-available --db-instance-identifier edsteward-db')
        
        if success:
            log("✅ RDS modification complete!")
        else:
            log("⚠️  RDS modification may still be in progress")
        
    else:
        log(f"❌ Failed to modify RDS: {error}")
        return False
    
    # Step 4: Test connection
    log("\n📍 STEP 4: Testing connection...")
    
    # Get new endpoint (might have changed)
    success, new_rds_output, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if success:
        try:
            new_rds_data = json.loads(new_rds_output)
            new_endpoint = new_rds_data['DBInstances'][0]['Endpoint']['Address']
            log(f"✅ New RDS endpoint: {new_endpoint}")
            
            # Test with psycopg2
            import psycopg2
            
            log("Attempting database connection...")
            conn = psycopg2.connect(
                host=new_endpoint,
                port=5432,
                database='postgres',
                user='postgres',
                password='EdSteward2024!Secure',
                connect_timeout=15
            )
            
            cursor = conn.cursor()
            cursor.execute('SELECT version();')
            version = cursor.fetchone()[0]
            
            log("🎉 CONNECTION SUCCESSFUL!")
            log(f"PostgreSQL version: {version}")
            
            cursor.close()
            conn.close()
            
            log("\n✅ Your RDS is now accessible from the internet!")
            log("You can now run your database restoration script.")
            
            return True
            
        except Exception as e:
            log(f"❌ Connection test failed: {e}")
            log("The RDS might still be starting up. Try again in a few minutes.")
            return False
    
    return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 SUCCESS! RDS is now in public subnets and accessible!")
    else:
        print("\n⚠️  Process incomplete - check the steps above.") 