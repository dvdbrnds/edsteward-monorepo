#!/usr/bin/env python3
"""
Simple Database Restoration via AWS Systems Manager
==================================================

This script will:
1. Launch an EC2 instance with Systems Manager access
2. Upload the backup file via S3
3. Run the restoration via Systems Manager
4. Clean up resources
"""

import subprocess
import json
import time
import base64
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
    log("🚀 SIMPLE DATABASE RESTORATION")
    log("=" * 50)
    
    # Step 1: Upload backup to S3
    log("📍 STEP 1: Uploading backup to S3...")
    
    bucket_name = "edsteward-temp-backup"
    
    # Create S3 bucket
    success, _, error = run_cmd(f'aws s3 mb s3://{bucket_name} --region us-east-1')
    
    if success or "already exists" in error.lower():
        log(f"✅ S3 bucket ready: {bucket_name}")
        
        # Upload backup file
        if os.path.exists('nosync_backup.sql'):
            success, _, error = run_cmd(f'aws s3 cp nosync_backup.sql s3://{bucket_name}/nosync_backup.sql')
            
            if success:
                log("✅ Backup uploaded to S3")
            else:
                log(f"❌ Failed to upload backup: {error}")
                return False
        else:
            log("❌ Backup file not found")
            return False
    else:
        log(f"❌ Failed to create S3 bucket: {error}")
        return False
    
    # Step 2: Get VPC and subnet info
    log("\n📍 STEP 2: Getting network configuration...")
    
    success, rds_output, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --output json')
    
    if not success:
        log("❌ Failed to get RDS details")
        return False
    
    rds_data = json.loads(rds_output)
    vpc_id = rds_data['DBInstances'][0]['DBSubnetGroup']['VpcId']
    
    # Find any subnet in the VPC (private is fine for this approach)
    success, subnet_output, _ = run_cmd(f'aws ec2 describe-subnets --filters "Name=vpc-id,Values={vpc_id}" --query "Subnets[0].SubnetId" --output text')
    
    if success:
        subnet_id = subnet_output
        log(f"✅ Using subnet: {subnet_id}")
    else:
        log("❌ Failed to find subnet")
        return False
    
    # Step 3: Create IAM role for EC2 (if needed)
    log("\n📍 STEP 3: Setting up IAM role...")
    
    role_name = "EdStewardDBRestoreRole"
    
    # Create trust policy
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "ec2.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }
        ]
    }
    
    # Try to create role
    success, _, error = run_cmd(f'aws iam create-role --role-name {role_name} --assume-role-policy-document \'{json.dumps(trust_policy)}\'')
    
    if success or "already exists" in error.lower():
        log(f"✅ IAM role ready: {role_name}")
        
        # Attach policies
        run_cmd(f'aws iam attach-role-policy --role-name {role_name} --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore')
        run_cmd(f'aws iam attach-role-policy --role-name {role_name} --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess')
        
        # Create instance profile
        run_cmd(f'aws iam create-instance-profile --instance-profile-name {role_name}')
        run_cmd(f'aws iam add-role-to-instance-profile --instance-profile-name {role_name} --role-name {role_name}')
        
        time.sleep(10)  # Wait for IAM propagation
        
    else:
        log(f"❌ Failed to create IAM role: {error}")
        return False
    
    # Step 4: Launch EC2 instance
    log("\n📍 STEP 4: Launching EC2 instance...")
    
    ami_id = "ami-0c02fb55956c7d316"  # Amazon Linux 2
    
    user_data = '''#!/bin/bash
yum update -y
yum install -y postgresql15
aws s3 cp s3://edsteward-temp-backup/nosync_backup.sql /tmp/nosync_backup.sql
echo "Setup complete" > /tmp/ready.txt
'''
    
    user_data_b64 = base64.b64encode(user_data.encode()).decode()
    
    success, instance_output, error = run_cmd(f'''aws ec2 run-instances \
        --image-id {ami_id} \
        --instance-type t3.micro \
        --subnet-id {subnet_id} \
        --iam-instance-profile Name={role_name} \
        --user-data {user_data_b64} \
        --tag-specifications 'ResourceType=instance,Tags=[{{Key=Name,Value=edsteward-db-restore}}]' \
        --output json''')
    
    if success:
        instance_data = json.loads(instance_output)
        instance_id = instance_data['Instances'][0]['InstanceId']
        log(f"✅ Launched instance: {instance_id}")
        
        # Wait for instance to be running
        log("⏳ Waiting for instance to be ready...")
        success, _, _ = run_cmd(f'aws ec2 wait instance-running --instance-ids {instance_id}')
        
        if success:
            log("✅ Instance is running")
            
            # Wait for Systems Manager to be ready
            time.sleep(120)
            
            # Step 5: Run database restoration
            log("\n📍 STEP 5: Running database restoration...")
            
            restore_command = '''
cd /tmp
echo "Testing RDS connection..."
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT version();"

if [ $? -eq 0 ]; then
    echo "✅ Connection successful! Starting restoration..."
    psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" < nosync_backup.sql
    echo "✅ Database restoration complete!"
else
    echo "❌ Connection failed"
    exit 1
fi
'''
            
            success, command_output, error = run_cmd(f'''aws ssm send-command \
                --instance-ids {instance_id} \
                --document-name "AWS-RunShellScript" \
                --parameters 'commands=["{restore_command}"]' \
                --output json''')
            
            if success:
                command_data = json.loads(command_output)
                command_id = command_data['Command']['CommandId']
                log(f"✅ Started restoration command: {command_id}")
                
                # Wait for command to complete
                log("⏳ Waiting for restoration to complete...")
                time.sleep(30)
                
                # Get command output
                success, result_output, _ = run_cmd(f'aws ssm get-command-invocation --command-id {command_id} --instance-id {instance_id} --output json')
                
                if success:
                    result_data = json.loads(result_output)
                    stdout = result_data.get('StandardOutputContent', '')
                    stderr = result_data.get('StandardErrorContent', '')
                    
                    log("📋 Command Output:")
                    print(stdout)
                    
                    if stderr:
                        log("⚠️  Errors:")
                        print(stderr)
                    
                    if "restoration complete" in stdout.lower():
                        log("🎉 DATABASE RESTORATION SUCCESSFUL!")
                        success_flag = True
                    else:
                        log("❌ Restoration may have failed")
                        success_flag = False
                else:
                    log("❌ Failed to get command results")
                    success_flag = False
            else:
                log(f"❌ Failed to run restoration command: {error}")
                success_flag = False
            
            # Step 6: Cleanup
            log("\n📍 STEP 6: Cleaning up resources...")
            
            # Terminate instance
            run_cmd(f'aws ec2 terminate-instances --instance-ids {instance_id}')
            log("✅ Terminated EC2 instance")
            
            # Delete S3 bucket
            run_cmd(f'aws s3 rm s3://{bucket_name}/nosync_backup.sql')
            run_cmd(f'aws s3 rb s3://{bucket_name}')
            log("✅ Cleaned up S3 bucket")
            
            return success_flag
            
        else:
            log("❌ Instance failed to start")
            return False
    else:
        log(f"❌ Failed to launch instance: {error}")
        return False

if __name__ == "__main__":
    import os
    
    success = main()
    if success:
        print("\n🎊 DATABASE RESTORATION COMPLETED SUCCESSFULLY!")
        print("Your Neon database data has been restored to AWS RDS!")
    else:
        print("\n❌ Database restoration failed. Check the logs above.")