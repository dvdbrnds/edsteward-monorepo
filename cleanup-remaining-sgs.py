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
    print("🧹 CLEANING UP REMAINING SECURITY GROUPS")
    print("=" * 50)
    
    # Get all security groups
    success, output, error = run_cmd('aws ec2 describe-security-groups --output json')
    
    if not success:
        print(f"❌ Failed to get security groups: {error}")
        return
    
    try:
        data = json.loads(output)
        security_groups = data['SecurityGroups']
        
        print(f"📊 Found {len(security_groups)} total security groups")
        
        # Security groups to keep (from our analysis)
        keep_groups = {
            'sg-08beaf1f5f9821760',  # default
            'sg-05e946256774c2ae8',  # ALB (Terraform)
            'sg-08d91fe29fa819e59',  # default
            'sg-0a43f791ccea6fc34',  # RDS (Terraform)
            'sg-0ca110b5c4ad239e4',  # Redis (Terraform)
            'sg-05d224df33d970f0c',  # ECS (Terraform)
            'sg-06cc3f04176c6adcb',  # RDS VPC (in use)
            'sg-02bc3208d72f262db',  # RDS SG (in use)
        }
        
        print("\n✅ KEEPING THESE SECURITY GROUPS:")
        for sg in security_groups:
            if sg['GroupId'] in keep_groups:
                print(f"   🔒 {sg['GroupId']} - {sg['GroupName']}")
        
        print("\n🗑️  ATTEMPTING TO DELETE:")
        deleted_count = 0
        
        for sg in security_groups:
            sg_id = sg['GroupId']
            sg_name = sg['GroupName']
            
            if sg_id not in keep_groups:
                print(f"   Deleting {sg_id} - {sg_name}")
                
                success, _, error = run_cmd(f'aws ec2 delete-security-group --group-id {sg_id}')
                
                if success:
                    print(f"   ✅ Deleted {sg_id}")
                    deleted_count += 1
                else:
                    if "DependencyViolation" in error:
                        print(f"   ⚠️  {sg_id} has dependencies - skipping")
                    elif "InvalidGroup.NotFound" in error:
                        print(f"   ✅ {sg_id} already deleted")
                        deleted_count += 1
                    else:
                        print(f"   ❌ Failed to delete {sg_id}: {error}")
        
        print(f"\n🎉 CLEANUP COMPLETE!")
        print(f"   Deleted: {deleted_count} security groups")
        print(f"   Remaining: {len(security_groups) - deleted_count} security groups")
        
        # Show final count
        success, output, _ = run_cmd('aws ec2 describe-security-groups --output json')
        if success:
            final_data = json.loads(output)
            final_count = len(final_data['SecurityGroups'])
            print(f"   Final total: {final_count} security groups")
        
    except json.JSONDecodeError:
        print("❌ Failed to parse security groups JSON")

if __name__ == "__main__":
    main() 