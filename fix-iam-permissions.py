#!/usr/bin/env python3
"""
Fix ECS IAM role permissions - bypasses shell issues
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

def fix_iam_permissions():
    """Fix ECS IAM role permissions"""
    print("🔧 FIXING ECS IAM ROLE PERMISSIONS")
    print("=" * 40)
    
    role_name = "ecsTaskExecutionRole"
    
    # 1. Check if role exists
    print("📋 1. Checking if role exists...")
    get_role_cmd = ['iam', 'get-role', '--role-name', role_name, '--output', 'json']
    result = run_aws_command(get_role_cmd)
    
    if result:
        print(f"✅ Role {role_name} exists")
        try:
            data = json.loads(result)
            role = data['Role']
            print(f"   ARN: {role['Arn']}")
            print(f"   Created: {role['CreateDate']}")
        except Exception as e:
            print(f"   Error parsing role info: {e}")
    else:
        print(f"❌ Role {role_name} does not exist - we need to create it")
        
        # Create the role
        print("📋 Creating ECS task execution role...")
        
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ecs-tasks.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        create_role_cmd = [
            'iam', 'create-role',
            '--role-name', role_name,
            '--assume-role-policy-document', json.dumps(trust_policy),
            '--description', 'ECS Task Execution Role for Fargate tasks'
        ]
        
        result = run_aws_command(create_role_cmd)
        if result:
            print(f"✅ Created role {role_name}")
        else:
            print(f"❌ Failed to create role {role_name}")
            return
    
    # 2. Attach required policies
    print("\n📋 2. Attaching required policies...")
    
    required_policies = [
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
        "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    ]
    
    for policy_arn in required_policies:
        attach_cmd = [
            'iam', 'attach-role-policy',
            '--role-name', role_name,
            '--policy-arn', policy_arn
        ]
        
        result = run_aws_command(attach_cmd)
        if result is not None:  # Empty string is success for attach commands
            print(f"✅ Attached policy: {policy_arn.split('/')[-1]}")
        else:
            print(f"⚠️ Failed to attach or already attached: {policy_arn.split('/')[-1]}")
    
    # 3. Check attached policies
    print("\n📋 3. Verifying attached policies...")
    list_policies_cmd = [
        'iam', 'list-attached-role-policies',
        '--role-name', role_name,
        '--output', 'json'
    ]
    
    result = run_aws_command(list_policies_cmd)
    if result:
        try:
            data = json.loads(result)
            policies = data['AttachedPolicies']
            
            print("   Attached policies:")
            for policy in policies:
                print(f"     - {policy['PolicyName']}")
                
            if len(policies) >= 2:
                print("✅ Required policies are attached")
            else:
                print("⚠️ Some required policies may be missing")
                
        except Exception as e:
            print(f"   Error checking policies: {e}")
    
    # 4. Test role assumption
    print("\n📋 4. Testing role assumption...")
    sts_cmd = [
        'sts', 'assume-role',
        '--role-arn', f'arn:aws:iam::259661441422:role/{role_name}',
        '--role-session-name', 'test-session',
        '--output', 'json'
    ]
    
    result = run_aws_command(sts_cmd)
    if result:
        print("✅ Role can be assumed successfully")
    else:
        print("❌ Role assumption failed - there may be trust relationship issues")
    
    # 5. Force a new deployment to test
    print("\n📋 5. Forcing new deployment to test IAM fix...")
    
    # Update service to force new deployment
    update_cmd = [
        'ecs', 'update-service',
        '--cluster', 'edsteward-cluster',
        '--service', 'edsteward-service',
        '--force-new-deployment',
        '--desired-count', '1'
    ]
    
    result = run_aws_command(update_cmd)
    if result:
        print("✅ Forced new deployment")
        print("⏳ Waiting 60 seconds for deployment to start...")
        time.sleep(60)
        
        # Check if tasks are now starting
        print("🧪 Checking if tasks are now starting...")
        
        # Get current tasks
        list_tasks_cmd = [
            'ecs', 'list-tasks',
            '--cluster', 'edsteward-cluster',
            '--service-name', 'edsteward-service',
            '--output', 'json'
        ]
        
        result = run_aws_command(list_tasks_cmd)
        if result:
            try:
                data = json.loads(result)
                task_arns = data['taskArns']
                
                if task_arns:
                    print(f"✅ Found {len(task_arns)} current tasks - IAM fix likely worked!")
                    
                    # Get task details
                    describe_cmd = [
                        'ecs', 'describe-tasks',
                        '--cluster', 'edsteward-cluster',
                        '--tasks', task_arns[0],  # Just check the first task
                        '--output', 'json'
                    ]
                    
                    task_result = run_aws_command(describe_cmd)
                    if task_result:
                        task_data = json.loads(task_result)
                        task = task_data['tasks'][0]
                        
                        print(f"   Task Status: {task.get('lastStatus', 'Unknown')}")
                        print(f"   Desired Status: {task.get('desiredStatus', 'Unknown')}")
                        
                        if task.get('lastStatus') in ['PENDING', 'RUNNING']:
                            print("🎉 SUCCESS! Task is now starting/running!")
                            print("⏳ Wait 2-3 minutes for full startup, then test the application")
                        
                else:
                    print("❌ No current tasks found - IAM issue may persist")
                    
            except Exception as e:
                print(f"   Error checking tasks: {e}")
        
    else:
        print("❌ Failed to force new deployment")

if __name__ == "__main__":
    fix_iam_permissions() 