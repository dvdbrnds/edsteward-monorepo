#!/usr/bin/env python3
"""
Create EC2 Jump Host for Database Restoration
============================================

This script will:
1. Launch a small EC2 instance in a public subnet
2. Install PostgreSQL client on it
3. Copy the backup file to it
4. Run the database restoration from there
"""

import subprocess
import json
import time
import os
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
    log("🚀 CREATING EC2 JUMP HOST FOR DATABASE RESTORATION")
    log("=" * 60)
    
    # Step 1: Find a public subnet
    log("📍 STEP 1: Finding public subnet...")
    
    # Get the VPC from RDS
    success, rds_output, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if not success:
        log("❌ Failed to get RDS details")
        return False
    
    rds_data = json.loads(rds_output)
    vpc_id = rds_data['DBInstances'][0]['DBSubnetGroup']['VpcId']
    
    log(f"✅ RDS VPC: {vpc_id}")
    
    # Find public subnets
    success, subnet_output, _ = run_cmd(f'aws ec2 describe-subnets --filters "Name=vpc-id,Values={vpc_id}" "Name=map-public-ip-on-launch,Values=true" --output json')
    
    if success:
        subnet_data = json.loads(subnet_output)
        public_subnets = subnet_data['Subnets']
        
        if public_subnets:
            public_subnet_id = public_subnets[0]['SubnetId']
            log(f"✅ Found public subnet: {public_subnet_id}")
        else:
            log("❌ No public subnets found")
            return False
    else:
        log("❌ Failed to get subnets")
        return False
    
    # Step 2: Create or find security group for EC2
    log("\n📍 STEP 2: Setting up security group...")
    
    sg_name = "edsteward-jumphost-sg"
    
    # Try to create security group
    success, sg_output, error = run_cmd(f'aws ec2 create-security-group --group-name {sg_name} --description "Jump host for database restoration" --vpc-id {vpc_id} --output json')
    
    if success:
        sg_data = json.loads(sg_output)
        sg_id = sg_data['GroupId']
        log(f"✅ Created security group: {sg_id}")
        
        # Add SSH rule
        run_cmd(f'aws ec2 authorize-security-group-ingress --group-id {sg_id} --protocol tcp --port 22 --cidr 0.0.0.0/0')
        log("✅ Added SSH access rule")
        
    else:
        if "already exists" in error:
            # Get existing security group
            success, existing_sg, _ = run_cmd(f'aws ec2 describe-security-groups --filters "Name=group-name,Values={sg_name}" "Name=vpc-id,Values={vpc_id}" --query "SecurityGroups[0].GroupId" --output text')
            
            if success:
                sg_id = existing_sg
                log(f"✅ Using existing security group: {sg_id}")
            else:
                log("❌ Failed to find existing security group")
                return False
        else:
            log(f"❌ Failed to create security group: {error}")
            return False
    
    # Step 3: Launch EC2 instance
    log("\n📍 STEP 3: Launching EC2 instance...")
    
    # Use Amazon Linux 2 AMI (this should work in us-east-1)
    ami_id = "ami-0c02fb55956c7d316"  # Amazon Linux 2 in us-east-1
    
    user_data_script = '''#!/bin/bash
yum update -y
yum install -y postgresql15
echo "PostgreSQL client installed" > /tmp/setup-complete.txt
'''
    
    success, instance_output, error = run_cmd(f'''aws ec2 run-instances \
        --image-id {ami_id} \
        --instance-type t3.micro \
        --subnet-id {public_subnet_id} \
        --security-group-ids {sg_id} \
        --associate-public-ip-address \
        --user-data "{user_data_script}" \
        --tag-specifications 'ResourceType=instance,Tags=[{{Key=Name,Value=edsteward-db-jumphost}}]' \
        --output json''')
    
    if success:
        instance_data = json.loads(instance_output)
        instance_id = instance_data['Instances'][0]['InstanceId']
        log(f"✅ Launched EC2 instance: {instance_id}")
        
        # Wait for instance to be running
        log("⏳ Waiting for instance to be running...")
        success, _, _ = run_cmd(f'aws ec2 wait instance-running --instance-ids {instance_id}')
        
        if success:
            log("✅ Instance is running")
            
            # Get public IP
            success, ip_output, _ = run_cmd(f'aws ec2 describe-instances --instance-ids {instance_id} --query "Reservations[0].Instances[0].PublicIpAddress" --output text')
            
            if success:
                public_ip = ip_output
                log(f"✅ Public IP: {public_ip}")
                
                # Wait a bit more for the instance to fully initialize
                log("⏳ Waiting for instance to initialize...")
                time.sleep(60)
                
                # Step 4: Create restoration script
                log("\n📍 STEP 4: Creating restoration script...")
                
                restoration_script = f'''#!/bin/bash
echo "Starting database restoration..."

# Test connection first
echo "Testing RDS connection..."
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT version();"

if [ $? -eq 0 ]; then
    echo "✅ Connection successful! Starting restoration..."
    
    # Download backup file (you'll need to upload this)
    echo "Backup file should be uploaded to this instance"
    echo "Run: psql 'postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres' < nosync_backup.sql"
else
    echo "❌ Connection failed"
fi
'''
                
                with open('jumphost-restore.sh', 'w') as f:
                    f.write(restoration_script)
                
                log("✅ Created restoration script")
                
                # Step 5: Provide instructions
                log("\n📍 STEP 5: NEXT STEPS")
                log("=" * 40)
                log(f"🎯 EC2 Jump Host Ready!")
                log(f"   Instance ID: {instance_id}")
                log(f"   Public IP: {public_ip}")
                log(f"   Security Group: {sg_id}")
                
                log(f"\n📋 TO COMPLETE THE RESTORATION:")
                log(f"1. Upload your backup file to the EC2 instance:")
                log(f"   scp -i your-key.pem nosync_backup.sql ec2-user@{public_ip}:~/")
                
                log(f"\n2. SSH to the instance:")
                log(f"   ssh -i your-key.pem ec2-user@{public_ip}")
                
                log(f"\n3. Run the restoration:")
                log(f"   psql 'postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres' < nosync_backup.sql")
                
                log(f"\n4. Clean up when done:")
                log(f"   aws ec2 terminate-instances --instance-ids {instance_id}")
                log(f"   aws ec2 delete-security-group --group-id {sg_id}")
                
                log(f"\n⚠️  NOTE: You'll need an EC2 key pair to SSH to the instance.")
                log(f"   If you don't have one, create it in the AWS Console first.")
                
                return True
                
            else:
                log("❌ Failed to get instance public IP")
                return False
        else:
            log("❌ Instance failed to start")
            return False
    else:
        log(f"❌ Failed to launch instance: {error}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 EC2 Jump Host is ready for database restoration!")
    else:
        print("\n❌ Failed to set up jump host.") 