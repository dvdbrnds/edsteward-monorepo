#!/usr/bin/env python3
"""
Find and Fix RDS Security Group
===============================

This script will:
1. Find the exact security group(s) your RDS is using
2. Show current rules on those security groups
3. Add the missing PostgreSQL access rule
4. Test the connection
"""

import subprocess
import json
import psycopg2
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
    log("🔍 FINDING RDS SECURITY GROUPS")
    log("=" * 50)
    
    # Step 1: Get RDS instance details
    log("📍 STEP 1: Getting RDS instance details...")
    
    success, output, error = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if not success:
        log(f"❌ Failed to get RDS details: {error}")
        return
    
    try:
        rds_data = json.loads(output)
        db_instance = rds_data['DBInstances'][0]
        
        # Get security groups
        security_groups = db_instance['VpcSecurityGroups']
        endpoint = db_instance['Endpoint']['Address']
        publicly_accessible = db_instance['PubliclyAccessible']
        
        log(f"✅ RDS Endpoint: {endpoint}")
        log(f"✅ Publicly Accessible: {publicly_accessible}")
        log(f"✅ Security Groups: {len(security_groups)}")
        
        for sg in security_groups:
            log(f"   🔒 {sg['VpcSecurityGroupId']} - Status: {sg['Status']}")
        
    except json.JSONDecodeError:
        log("❌ Failed to parse RDS data")
        return
    
    # Step 2: Examine each security group's rules
    log("\n📍 STEP 2: Examining security group rules...")
    
    rds_sg_ids = [sg['VpcSecurityGroupId'] for sg in security_groups]
    
    for sg_id in rds_sg_ids:
        log(f"\n🔍 Security Group: {sg_id}")
        
        # Get security group details
        success, sg_output, _ = run_cmd(f'aws ec2 describe-security-groups --group-ids {sg_id} --output json')
        
        if success:
            try:
                sg_data = json.loads(sg_output)
                sg_info = sg_data['SecurityGroups'][0]
                
                log(f"   Name: {sg_info['GroupName']}")
                log(f"   Description: {sg_info['Description']}")
                log(f"   VPC: {sg_info['VpcId']}")
                
                # Check inbound rules
                inbound_rules = sg_info['IpPermissions']
                log(f"   Inbound Rules: {len(inbound_rules)}")
                
                has_postgres_rule = False
                has_public_access = False
                
                for rule in inbound_rules:
                    if rule.get('FromPort') == 5432 and rule.get('ToPort') == 5432:
                        has_postgres_rule = True
                        log(f"   ✅ Has PostgreSQL rule (port 5432)")
                        
                        # Check if it allows public access
                        for ip_range in rule.get('IpRanges', []):
                            if ip_range.get('CidrIp') == '0.0.0.0/0':
                                has_public_access = True
                                log(f"   ✅ Allows public access (0.0.0.0/0)")
                                break
                        
                        # Check source security groups
                        for source_sg in rule.get('UserIdGroupPairs', []):
                            log(f"   🔒 Allows access from SG: {source_sg.get('GroupId')}")
                    else:
                        protocol = rule.get('IpProtocol', 'unknown')
                        from_port = rule.get('FromPort', 'N/A')
                        to_port = rule.get('ToPort', 'N/A')
                        log(f"   📋 Rule: {protocol} {from_port}-{to_port}")
                
                if not has_postgres_rule:
                    log(f"   ❌ NO PostgreSQL rule found!")
                elif not has_public_access:
                    log(f"   ⚠️  Has PostgreSQL rule but no public access")
                
            except json.JSONDecodeError:
                log(f"   ❌ Failed to parse security group data")
    
    # Step 3: Add missing rules
    log("\n📍 STEP 3: Adding missing PostgreSQL access rules...")
    
    for sg_id in rds_sg_ids:
        log(f"Adding public PostgreSQL access to {sg_id}...")
        
        success, _, error = run_cmd(f'aws ec2 authorize-security-group-ingress --group-id {sg_id} --protocol tcp --port 5432 --cidr 0.0.0.0/0')
        
        if success:
            log(f"✅ Added rule to {sg_id}")
        else:
            if "already exists" in error.lower() or "duplicate" in error.lower():
                log(f"✅ Rule already exists on {sg_id}")
            else:
                log(f"❌ Failed to add rule to {sg_id}: {error}")
    
    # Step 4: Test connection
    log("\n📍 STEP 4: Testing database connection...")
    
    try:
        log("Attempting connection...")
        conn = psycopg2.connect(
            host=endpoint,
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
        
        log("\n✅ Your RDS is now accessible!")
        log("You can now run your database restoration script.")
        
        return True
        
    except Exception as e:
        log(f"❌ Connection failed: {e}")
        
        log("\n🔧 TROUBLESHOOTING:")
        log("1. Security group rules may take a few minutes to apply")
        log("2. RDS might be in private subnets (check VPC configuration)")
        log("3. Try waiting 2-3 minutes and test again")
        
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 SUCCESS! RDS connection is working!")
    else:
        print("\n⚠️  Connection not working yet - check troubleshooting steps above.") 