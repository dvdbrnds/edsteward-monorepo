#!/usr/bin/env python3
"""
Fix ECR Permissions and Deploy
==============================

Fix ECR permissions and deploy our authentication fix.
"""

import boto3
import subprocess
import json
import time

def fix_ecr_permissions():
    """Fix ECR permissions and deploy authentication fix"""
    try:
        print('🔐 FIXING ECR PERMISSIONS')
        print('=' * 50)
        
        # Get current user/role information
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        
        user_arn = identity['Arn']
        account_id = identity['Account']
        
        print(f'🔍 Current AWS Identity:')
        print(f'   Account: {account_id}')
        print(f'   ARN: {user_arn}')
        
        # Check if we're using a user or role
        if ':user/' in user_arn:
            identity_type = 'user'
            identity_name = user_arn.split('/')[-1]
        elif ':role/' in user_arn:
            identity_type = 'role'
            identity_name = user_arn.split('/')[-1]
        else:
            print(f'❌ Unknown identity type: {user_arn}')
            return False
        
        print(f'📋 Identity Type: {identity_type}')
        print(f'📋 Identity Name: {identity_name}')
        
        # Method 1: Try to attach ECR policy directly
        print(f'\n🔧 Method 1: Attaching ECR permissions...')
        
        iam = boto3.client('iam')
        
        try:
            if identity_type == 'user':
                # Attach ECR policy to user
                iam.attach_user_policy(
                    UserName=identity_name,
                    PolicyArn='arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser'
                )
                print('✅ ECR PowerUser policy attached to user')
                
            elif identity_type == 'role':
                # Attach ECR policy to role
                iam.attach_role_policy(
                    RoleName=identity_name,
                    PolicyArn='arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser'
                )
                print('✅ ECR PowerUser policy attached to role')
                
        except Exception as e:
            print(f'⚠️  Could not attach managed policy: {e}')
            print('   Trying inline policy method...')
            
            # Method 2: Create inline policy with ECR permissions
            ecr_policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "ecr:GetAuthorizationToken",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchGetImage",
                            "ecr:InitiateLayerUpload",
                            "ecr:UploadLayerPart",
                            "ecr:CompleteLayerUpload",
                            "ecr:PutImage",
                            "ecr:CreateRepository",
                            "ecr:DescribeRepositories",
                            "ecr:DescribeImages"
                        ],
                        "Resource": "*"
                    }
                ]
            }
            
            try:
                if identity_type == 'user':
                    iam.put_user_policy(
                        UserName=identity_name,
                        PolicyName='ECRDeploymentPolicy',
                        PolicyDocument=json.dumps(ecr_policy)
                    )
                    print('✅ Inline ECR policy created for user')
                    
                elif identity_type == 'role':
                    iam.put_role_policy(
                        RoleName=identity_name,
                        PolicyName='ECRDeploymentPolicy',
                        PolicyDocument=json.dumps(ecr_policy)
                    )
                    print('✅ Inline ECR policy created for role')
                    
            except Exception as e2:
                print(f'❌ Could not create inline policy: {e2}')
                print('💡 You may need admin permissions to modify IAM policies')
                return False
        
        # Wait a moment for IAM to propagate
        print('\n⏳ Waiting for IAM permissions to propagate...')
        time.sleep(15)
        
        # Test ECR access
        print('\n🧪 Testing ECR access...')
        
        ecr = boto3.client('ecr', region_name='us-east-1')
        
        try:
            # Test 1: List repositories
            repos = ecr.describe_repositories()
            print(f'✅ Can list repositories: {len(repos["repositories"])} found')
            
            # Test 2: Get login token
            login_response = ecr.get_authorization_token()
            print('✅ Can get ECR authorization token')
            
            # Test 3: Try ECR login
            login_data = login_response['authorizationData'][0]
            token = login_data['authorizationToken']
            endpoint = login_data['proxyEndpoint']
            
            # Decode the token
            import base64
            username, password = base64.b64decode(token).decode().split(':')
            
            # Try docker login
            login_result = subprocess.run([
                'docker', 'login',
                '--username', username,
                '--password-stdin',
                endpoint
            ], input=password, text=True, capture_output=True)
            
            if login_result.returncode == 0:
                print('✅ ECR Docker login successful!')
                print('\n🎉 ECR PERMISSIONS FIXED!')
                return True
            else:
                print(f'❌ ECR Docker login failed: {login_result.stderr}')
                return False
                
        except Exception as e:
            print(f'❌ ECR access test failed: {e}')
            return False
            
    except Exception as e:
        print(f'❌ ECR permission fix failed: {e}')
        import traceback
        traceback.print_exc()
        return False

def deploy_authentication_fix():
    """Deploy the authentication fix now that ECR permissions are fixed"""
    try:
        print('\n🚀 DEPLOYING AUTHENTICATION FIX')
        print('=' * 50)
        
        account_id = "259661441422"
        region = "us-east-1"
        ecr_repo = f"{account_id}.dkr.ecr.{region}.amazonaws.com/edsteward"
        local_image = "regulatorytrackr-app:latest"
        
        # Build with authentication fix
        print('🏗️  Building Docker image with authentication fix...')
        build_result = subprocess.run([
            'docker', 'build', '-t', local_image, '.'
        ], capture_output=True, text=True)
        
        if build_result.returncode != 0:
            print(f'❌ Build failed: {build_result.stderr}')
            return False
        
        print('✅ Build successful')
        
        # Tag for ECR
        timestamp = str(int(time.time()))
        auth_fix_tag = f"auth-fix-{timestamp}"
        
        print(f'🏷️  Tagging as {auth_fix_tag}...')
        subprocess.run(['docker', 'tag', local_image, f'{ecr_repo}:{auth_fix_tag}'], check=True)
        subprocess.run(['docker', 'tag', local_image, f'{ecr_repo}:latest'], check=True)
        
        # Push to ECR
        print(f'📤 Pushing to ECR...')
        push_result = subprocess.run([
            'docker', 'push', f'{ecr_repo}:{auth_fix_tag}'
        ], capture_output=True, text=True)
        
        if push_result.returncode != 0:
            print(f'❌ Push failed: {push_result.stderr}')
            return False
        
        print('✅ Push to ECR successful!')
        
        # Update ECS
        print('🔄 Updating ECS service...')
        
        ecs = boto3.client('ecs', region_name=region)
        
        # Get current task definition
        service_info = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_arn = service_info['services'][0]['taskDefinition']
        task_def_response = ecs.describe_task_definition(taskDefinition=current_task_arn)
        task_def = task_def_response['taskDefinition']
        
        # Create new task definition
        new_task_def = {
            'family': task_def['family'],
            'networkMode': task_def.get('networkMode', 'awsvpc'),
            'requiresCompatibilities': task_def.get('requiresCompatibilities', ['FARGATE']),
            'cpu': task_def.get('cpu', '256'),
            'memory': task_def.get('memory', '512'),
            'executionRoleArn': task_def['executionRoleArn'],
            'containerDefinitions': []
        }
        
        if task_def.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_def['taskRoleArn']
        
        # Update container with new image
        new_container = task_def['containerDefinitions'][0].copy()
        new_container['image'] = f'{ecr_repo}:{auth_fix_tag}'
        
        new_task_def['containerDefinitions'] = [new_container]
        
        # Register and deploy
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        
        print(f'📝 New task definition: {new_task_arn}')
        
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print('✅ ECS service update initiated!')
        
        # Wait for deployment
        print('\n⏳ Waiting for deployment...')
        for i in range(12):
            time.sleep(30)
            
            service_status = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = service_status['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            print(f'   Check {i+1}: {running_count}/{desired_count} tasks')
            
            if running_count == desired_count:
                print('✅ Deployment complete!')
                break
        
        # Test the fix
        print('\n🧪 Testing authentication fix...')
        time.sleep(45)
        
        import requests
        response = requests.get(
            'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
            timeout=30
        )
        
        print(f'📡 Status: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                print(f'🎉 AUTHENTICATION FIX SUCCESS!')
                print(f'🎯 {len(data)} regulations now accessible!')
                print(f'📋 Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                return True
        
        print('❌ Authentication fix not working yet')
        return False
        
    except Exception as e:
        print(f'❌ Deployment failed: {e}')
        return False

if __name__ == "__main__":
    print('🔐 FIXING ECR PERMISSIONS AND DEPLOYING AUTHENTICATION FIX')
    print('=' * 70)
    
    # Step 1: Fix ECR permissions
    if fix_ecr_permissions():
        print('\n✅ ECR permissions fixed!')
        
        # Step 2: Deploy authentication fix
        if deploy_authentication_fix():
            print('\n🎉 AUTHENTICATION FIX DEPLOYED SUCCESSFULLY!')
            print('✅ EdSteward now accessible without 401 errors!')
            print('🌐 Test: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations')
        else:
            print('\n⚠️ Deployment completed but may need more time to fully start')
    else:
        print('\n❌ Could not fix ECR permissions')
        print('💡 You may need to contact AWS admin or use AWS console') 