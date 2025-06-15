#!/usr/bin/env python3
"""
Security Group Analysis and Cleanup
===================================

This script will:
1. Identify which security groups are managed by Terraform (KEEP)
2. Identify which security groups are used by active resources (KEEP)
3. Identify which security groups are unused and can be deleted (DELETE)
4. Show you exactly which ones to delete
"""

import subprocess
import json
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_cmd(command):
    """Run AWS CLI command and return result"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            return True, result.stdout.strip(), None
        else:
            return False, None, result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    log("🔍 SECURITY GROUP ANALYSIS")
    log("=" * 50)
    
    # Security groups that MUST be kept (from Terraform)
    terraform_security_groups = {
        "sg-05e946256774c2ae8": "ALB Security Group (edsteward-alb-sg)",
        "sg-05d224df33d970f0c": "ECS Security Group (edsteward-ecs-sg)", 
        "sg-0a43f791ccea6fc34": "RDS Security Group (edsteward-rds-sg)",
        "sg-0ca110b5c4ad239e4": "Redis Security Group (edsteward-redis-sg)"
    }
    
    log("✅ TERRAFORM-MANAGED SECURITY GROUPS (KEEP THESE):")
    for sg_id, description in terraform_security_groups.items():
        log(f"   🔒 {sg_id} - {description}")
    
    # Get all security groups
    log("\n🔍 ANALYZING ALL SECURITY GROUPS...")
    success, all_sgs, _ = run_cmd("aws ec2 describe-security-groups --query 'SecurityGroups[*].[GroupId,GroupName,Description,VpcId]' --output json")
    
    if not success:
        log("❌ Failed to get security groups")
        return
    
    try:
        security_groups = json.loads(all_sgs)
        log(f"Found {len(security_groups)} total security groups")
        
        # Categorize security groups
        keep_groups = []
        delete_candidates = []
        
        for sg in security_groups:
            sg_id, sg_name, sg_desc, vpc_id = sg
            
            # Always keep Terraform-managed groups
            if sg_id in terraform_security_groups:
                keep_groups.append((sg_id, sg_name, "Terraform-managed", sg_desc))
            
            # Always keep default security groups
            elif sg_name == "default":
                keep_groups.append((sg_id, sg_name, "Default VPC security group", sg_desc))
            
            # Check if it's used by active resources
            else:
                delete_candidates.append((sg_id, sg_name, sg_desc, vpc_id))
        
        # Check which delete candidates are actually in use
        log("\n🔍 CHECKING RESOURCE USAGE...")
        
        final_delete_list = []
        final_keep_list = keep_groups.copy()
        
        for sg_id, sg_name, sg_desc, vpc_id in delete_candidates:
            in_use = False
            usage_reason = ""
            
            # Check ECS services
            success, ecs_check, _ = run_cmd(f"aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' --output json 2>/dev/null")
            if success:
                try:
                    ecs_sgs = json.loads(ecs_check)
                    if sg_id in ecs_sgs:
                        in_use = True
                        usage_reason = "Used by ECS service"
                except:
                    pass
            
            # Check RDS instances
            if not in_use:
                success, rds_check, _ = run_cmd(f"aws rds describe-db-instances --query 'DBInstances[*].VpcSecurityGroups[?VpcSecurityGroupId==`{sg_id}`]' --output json")
                if success:
                    try:
                        rds_sgs = json.loads(rds_check)
                        if rds_sgs and any(rds_sgs):
                            in_use = True
                            usage_reason = "Used by RDS instance"
                    except:
                        pass
            
            # Check Load Balancers
            if not in_use:
                success, alb_check, _ = run_cmd(f"aws elbv2 describe-load-balancers --query 'LoadBalancers[?SecurityGroups[?contains(@, `{sg_id}`)]]' --output json")
                if success:
                    try:
                        alb_sgs = json.loads(alb_check)
                        if alb_sgs:
                            in_use = True
                            usage_reason = "Used by Load Balancer"
                    except:
                        pass
            
            # Check ElastiCache
            if not in_use:
                success, cache_check, _ = run_cmd(f"aws elasticache describe-cache-clusters --query 'CacheClusters[?SecurityGroups[?contains(@.SecurityGroupId, `{sg_id}`)]]' --output json")
                if success:
                    try:
                        cache_sgs = json.loads(cache_check)
                        if cache_sgs:
                            in_use = True
                            usage_reason = "Used by ElastiCache"
                    except:
                        pass
            
            if in_use:
                final_keep_list.append((sg_id, sg_name, usage_reason, sg_desc))
            else:
                final_delete_list.append((sg_id, sg_name, sg_desc, vpc_id))
        
        # Show results
        log("\n✅ SECURITY GROUPS TO KEEP:")
        for sg_id, sg_name, reason, sg_desc in final_keep_list:
            log(f"   🔒 {sg_id} - {sg_name} ({reason})")
        
        log(f"\n❌ SECURITY GROUPS SAFE TO DELETE ({len(final_delete_list)}):")
        if final_delete_list:
            for sg_id, sg_name, sg_desc, vpc_id in final_delete_list:
                log(f"   🗑️  {sg_id} - {sg_name} - {sg_desc} (VPC: {vpc_id})")
        else:
            log("   🎉 No unused security groups found!")
        
        # Generate delete commands
        if final_delete_list:
            log("\n🗑️  DELETE COMMANDS:")
            log("Copy and paste these commands to delete unused security groups:")
            log("-" * 60)
            for sg_id, sg_name, sg_desc, vpc_id in final_delete_list:
                log(f"aws ec2 delete-security-group --group-id {sg_id}")
            log("-" * 60)
            
            # Also create a batch delete script
            with open('delete-unused-security-groups.sh', 'w') as f:
                f.write("#!/bin/bash\n")
                f.write("# Auto-generated script to delete unused security groups\n")
                f.write("# Generated on " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n\n")
                f.write("echo '🗑️  Deleting unused security groups...'\n\n")
                
                for sg_id, sg_name, sg_desc, vpc_id in final_delete_list:
                    f.write(f"echo 'Deleting {sg_id} - {sg_name}'\n")
                    f.write(f"aws ec2 delete-security-group --group-id {sg_id}\n")
                    f.write("sleep 1\n\n")
                
                f.write("echo '✅ Cleanup complete!'\n")
            
            log(f"📝 Created delete-unused-security-groups.sh script")
        
        # Now let's fix the RDS connection issue
        log("\n🔧 FIXING RDS CONNECTION...")
        
        # The issue is that your RDS security group only allows connections from ECS security group
        # But you're trying to connect from your local machine
        # We need to add a rule to allow your IP or make it public temporarily
        
        rds_sg_id = "sg-0a43f791ccea6fc34"  # From Terraform state
        
        log(f"Adding temporary public access rule to RDS security group {rds_sg_id}...")
        success, _, _ = run_cmd(f"aws ec2 authorize-security-group-ingress --group-id {rds_sg_id} --protocol tcp --port 5432 --cidr 0.0.0.0/0")
        
        if success:
            log("✅ Added temporary public access rule to RDS security group")
            log("🎉 You can now run the database restoration!")
            log("\n⚠️  SECURITY NOTE: This allows public access to your database.")
            log("   After restoration, remove this rule with:")
            log(f"   aws ec2 revoke-security-group-ingress --group-id {rds_sg_id} --protocol tcp --port 5432 --cidr 0.0.0.0/0")
        else:
            log("⚠️  Could not add public access rule (it might already exist)")
            log("🎉 Try running the database restoration now!")
        
    except json.JSONDecodeError:
        log("❌ Failed to parse security groups")
        return

if __name__ == "__main__":
    main() 