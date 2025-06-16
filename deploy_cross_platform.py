#!/usr/bin/env python3
"""
Deploy Cross Platform
=====================

Deploy authentication fix with correct platform for AWS ECS.
"""

import boto3
import subprocess
import time

def deploy_cross_platform():
    """Deploy with correct platform settings for AWS ECS"""
    try:
        print('🔧 CROSS-PLATFORM DEPLOYMENT FOR AWS ECS')
        print('=' * 60)
        
        # Configuration
        account_id = "259661441422"
        region = "us-east-1"
        ecr_repo = f"{account_id}.dkr.ecr.{region}.amazonaws.com/edsteward"
        local_image = "regulatorytrackr-app:latest"
        
        print('🔍 Issue identified:')
        print('   • Docker platform mismatch: macOS ARM64 vs AWS linux/amd64')
        print('   • Need to force linux/amd64 platform during build')
        print('   • AWS ECS Fargate requires exact platform match')
        print('')
        
        print('🔧 Solution:')
        print('   • Use docker buildx for cross-platform build')
        print('   • Force --platform linux/amd64')
        print('   • Build specifically for AWS ECS compatibility')
        print('')
        
        # Step 1: ECR login
        print('🔐 Step 1: ECR Authentication...')
        
        ecr_login_result = subprocess.run([
            'aws', 'ecr', 'get-login-password', '--region', region
        ], capture_output=True, text=True)
        
        if ecr_login_result.returncode != 0:
            print(f'❌ ECR login failed: {ecr_login_result.stderr}')
            return False
        
        password = ecr_login_result.stdout.strip()
        
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
        
        # Step 2: Setup buildx for cross-platform builds
        print('\n🔧 Step 2: Setting up Docker buildx...')
        
        # Create/use multiarch builder
        subprocess.run(['docker', 'buildx', 'create', '--name', 'multiarch', '--use'], 
                      capture_output=True)
        
        # Bootstrap the builder
        subprocess.run(['docker', 'buildx', 'inspect', '--bootstrap'], 
                      capture_output=True)
        
        print('✅ Docker buildx ready')
        
        # Step 3: Build for linux/amd64 platform
        timestamp = str(int(time.time()))
        auth_fix_tag = f"auth-fix-{timestamp}"
        
        print(f'\n🏗️  Step 3: Building for linux/amd64 platform...')
        print(f'   Tag: {auth_fix_tag}')
        print(f'   Target: {ecr_repo}:{auth_fix_tag}')
        
        # Use buildx to build and push directly to ECR with correct platform
        buildx_result = subprocess.run([
            'docker', 'buildx', 'build',
            '--platform', 'linux/amd64',
            '--tag', f'{ecr_repo}:{auth_fix_tag}',
            '--tag', f'{ecr_repo}:latest',
            '--push',
            '.'
        ], capture_output=True, text=True)
        
        if buildx_result.returncode != 0:
            print(f'❌ Cross-platform build failed: {buildx_result.stderr}')
            print(f'❌ stdout: {buildx_result.stdout}')
            return False
        
        print('✅ Cross-platform build and push successful!')
        
        # Step 4: Update ECS
        print(f'\n🔄 Step 4: Updating ECS service...')
        
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
        
        # Create new task definition with linux/amd64 image
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
        
        # Update container with new linux/amd64 image
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
        
        # Step 5: Wait for deployment
        print(f'\n⏳ Step 5: Waiting for linux/amd64 container to start...')
        
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
            
            if running_count == desired_count and running_count > 0:
                print('✅ Container is running!')
                break
        
        # Step 6: Test the authentication fix
        print(f'\n🧪 Step 6: Testing authentication fix...')
        time.sleep(30)
        
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
                        print(f'🔓 No more 401 authentication errors!')
                        print(f'✅ Cross-platform deployment successful!')
                        return True
                    else:
                        print(f'   ⚠️ Got 200 but unexpected data format: {type(data)}')
                elif response.status_code == 401:
                    print(f'   ❌ Still 401 - deployment may need more time')
                elif response.status_code in [502, 503]:
                    print(f'   ⏳ {response.status_code} - service still starting')
                else:
                    print(f'   ⚠️ Unexpected status: {response.status_code}')
                    
            except Exception as e:
                print(f'   ⚠️ Test error: {e}')
            
            if test_attempt < 2:
                print(f'   Waiting 60s before retry...')
                time.sleep(60)
        
        print('\n⚠️ Tests did not show immediate success')
        print('💭 The deployment may need more time or there may be other issues')
        return False
        
    except Exception as e:
        print(f'❌ Cross-platform deployment failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('🔧 CROSS-PLATFORM DEPLOYMENT FOR AWS ECS')
    print('=' * 60)
    print('Building Docker image with correct linux/amd64 platform for AWS ECS Fargate')
    print()
    
    if deploy_cross_platform():
        print('\n🎉 AUTHENTICATION FIX DEPLOYED SUCCESSFULLY!')
        print('✅ EdSteward now accessible without 401 errors!')
        print('🌐 Test: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations')
        print('')
        print('🔧 Platform issue resolved:')
        print('   • Built with linux/amd64 platform ✅')
        print('   • Compatible with AWS ECS Fargate ✅') 
        print('   • Authentication fix deployed ✅')
    else:
        print('\n⚠️ DEPLOYMENT ISSUES')
        print('💭 Check the logs above for specific error details') 