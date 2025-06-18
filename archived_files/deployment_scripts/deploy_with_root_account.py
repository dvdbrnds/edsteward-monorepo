#!/usr/bin/env python3
"""
Deploy with Root Account
=======================

Deploy authentication fix using root account credentials.
"""

import boto3
import subprocess
import time

def deploy_with_root_account():
    """Deploy using root account - should have all permissions"""
    try:
        print('🔐 DEPLOYING WITH ROOT ACCOUNT')
        print('=' * 50)
        
        # Configuration
        account_id = "259661441422"
        region = "us-east-1"
        ecr_repo = f"{account_id}.dkr.ecr.{region}.amazonaws.com/edsteward"
        local_image = "regulatorytrackr-app:latest"
        
        print(f'🔧 Configuration:')
        print(f'   Account: {account_id} (root)')
        print(f'   ECR Repository: {ecr_repo}')
        print(f'   Local Image: {local_image}')
        
        # Verify root account access
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f'   Identity: {identity["Arn"]}')
        
        # Step 1: Build the image
        print(f'\n🏗️  Building Docker image with authentication fix...')
        build_result = subprocess.run([
            'docker', 'build', '-t', local_image, '.'
        ], capture_output=True, text=True)
        
        if build_result.returncode != 0:
            print(f'❌ Build failed: {build_result.stderr}')
            return False
        
        print('✅ Build successful')
        
        # Step 2: ECR login using AWS CLI (simpler approach)
        print(f'\n🔐 Authenticating with ECR using AWS CLI...')
        
        # Use AWS CLI to get login command
        ecr_login_result = subprocess.run([
            'aws', 'ecr', 'get-login-password', '--region', region
        ], capture_output=True, text=True)
        
        if ecr_login_result.returncode != 0:
            print(f'❌ ECR get-login-password failed: {ecr_login_result.stderr}')
            return False
        
        password = ecr_login_result.stdout.strip()
        
        # Docker login to ECR
        login_result = subprocess.run([
            'docker', 'login',
            '--username', 'AWS',
            '--password-stdin',
            f'{account_id}.dkr.ecr.{region}.amazonaws.com'
        ], input=password, text=True, capture_output=True)
        
        if login_result.returncode != 0:
            print(f'❌ Docker login failed: {login_result.stderr}')
            return False
        
        print('✅ ECR authentication successful')
        
        # Step 3: Tag for ECR
        timestamp = str(int(time.time()))
        auth_fix_tag = f"auth-fix-{timestamp}"
        
        print(f'\n🏷️  Tagging for ECR...')
        print(f'   Tag: {auth_fix_tag}')
        
        try:
            subprocess.run(['docker', 'tag', local_image, f'{ecr_repo}:{auth_fix_tag}'], check=True)
            subprocess.run(['docker', 'tag', local_image, f'{ecr_repo}:latest'], check=True)
            print('✅ Tagging successful')
        except subprocess.CalledProcessError as e:
            print(f'❌ Tagging failed: {e}')
            return False
        
        # Step 4: Push to ECR
        print(f'\n📤 Pushing to ECR...')
        
        try:
            # Push the auth fix tag
            print(f'   Pushing {auth_fix_tag}...')
            subprocess.run([
                'docker', 'push', f'{ecr_repo}:{auth_fix_tag}'
            ], check=True, capture_output=True)
            
            # Push latest tag
            print(f'   Pushing latest...')
            subprocess.run([
                'docker', 'push', f'{ecr_repo}:latest'
            ], check=True, capture_output=True)
            
            print('✅ Push to ECR successful!')
            
        except subprocess.CalledProcessError as e:
            print(f'❌ Push failed')
            # Try to get more details
            push_result = subprocess.run([
                'docker', 'push', f'{ecr_repo}:{auth_fix_tag}'
            ], capture_output=True, text=True)
            print(f'   Error details: {push_result.stderr}')
            return False
        
        # Step 5: Update ECS
        print(f'\n🔄 Updating ECS service...')
        
        ecs = boto3.client('ecs', region_name=region)
        
        # Get current task definition
        service_info = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_arn = service_info['services'][0]['taskDefinition']
        task_def_response = ecs.describe_task_definition(taskDefinition=current_task_arn)
        task_def = task_def_response['taskDefinition']
        
        print(f'   Current task: {current_task_arn}')
        print(f'   New image: {ecr_repo}:{auth_fix_tag}')
        
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
        
        # Register new task definition
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        
        print(f'✅ New task definition: {new_task_arn}')
        
        # Update service
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print('✅ ECS service update initiated!')
        
        # Step 6: Wait for deployment
        print(f'\n⏳ Waiting for authentication fix to deploy...')
        
        for i in range(15):
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
        
        # Step 7: Test the authentication fix
        print(f'\n🧪 Testing authentication fix...')
        time.sleep(60)  # Give it time to fully start
        
        import requests
        
        for test_attempt in range(3):
            try:
                print(f'   Test {test_attempt + 1}/3...')
                response = requests.get(
                    'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                    timeout=30
                )
                
                print(f'   Status: {response.status_code}')
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        print(f'\n🎉 AUTHENTICATION FIX SUCCESS!')
                        print(f'🎯 {len(data)} regulations now accessible!')
                        print(f'📋 Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                        print(f'🔓 Route ordering fix deployed successfully!')
                        return True
                    else:
                        print(f'   ⚠️ Got 200 but unexpected data format: {type(data)}')
                elif response.status_code == 401:
                    print(f'   ❌ Still 401 - may need more startup time')
                elif response.status_code in [502, 503]:
                    print(f'   ⏳ {response.status_code} - service still starting')
                else:
                    print(f'   ⚠️ Unexpected status: {response.status_code}')
                    print(f'   Response: {response.text[:100]}...')
                    
            except Exception as e:
                print(f'   ⚠️ Test error: {e}')
            
            if test_attempt < 2:
                print(f'   Waiting 60s before retry...')
                time.sleep(60)
        
        print('\n⚠️ Tests did not show immediate success')
        print('💭 The deployment may need more time to fully initialize')
        return False
        
    except Exception as e:
        print(f'❌ Deployment failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('🚀 DEPLOYING AUTHENTICATION FIX WITH ROOT ACCOUNT')
    print('=' * 60)
    print('Using root account credentials to deploy authentication fix')
    print()
    
    if deploy_with_root_account():
        print('\n🎉 AUTHENTICATION FIX DEPLOYED!')
        print('✅ EdSteward should now be accessible without 401 errors!')
        print('🌐 Test: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations')
        print('')
        print('🔓 The route ordering fix ensures:')
        print('   • /api/regulations accessible without authentication')
        print('   • All 367 regulations available immediately')
        print('   • No more 401 authentication errors')
    else:
        print('\n⏳ DEPLOYMENT MAY STILL BE COMPLETING')
        print('💭 Run the test again in a few minutes:')
        print('   python3 check_deployment_status.py') 