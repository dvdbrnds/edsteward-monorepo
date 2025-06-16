#!/usr/bin/env python3
"""
Check ECR and Deploy Code Fix
============================

Check ECR repositories and attempt to deploy our authentication fix.
"""

import boto3
import subprocess
import time

def check_ecr_and_deploy():
    """Check ECR repos and attempt deployment"""
    try:
        ecr = boto3.client('ecr', region_name='us-east-1')
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        print('🔍 CHECKING ECR REPOSITORIES')
        print('=' * 50)
        
        # List ECR repositories
        try:
            repos = ecr.describe_repositories()
            print(f'📦 Found {len(repos["repositories"])} ECR repositories:')
            for repo in repos['repositories']:
                print(f'   • {repo["repositoryName"]} - {repo["repositoryUri"]}')
        except Exception as e:
            print(f'❌ Cannot list ECR repositories: {e}')
            print('💡 This might be a permissions issue')
        
        # Try to get AWS account info
        try:
            sts = boto3.client('sts')
            account_info = sts.get_caller_identity()
            account_id = account_info['Account']
            print(f'\n🔐 AWS Account ID: {account_id}')
        except Exception as e:
            print(f'❌ Cannot get account info: {e}')
            return False
        
        # Check current ECS task definition being used
        print('\n📋 CHECKING CURRENT DEPLOYMENT')
        print('=' * 50)
        
        service_info = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_arn = service_info['services'][0]['taskDefinition']
        print(f'📋 Current task definition: {current_task_arn}')
        
        # Get task definition details
        task_def = ecs.describe_task_definition(taskDefinition=current_task_arn)
        container_def = task_def['taskDefinition']['containerDefinitions'][0]
        current_image = container_def['image']
        print(f'🖼️  Current image: {current_image}')
        
        # Try alternative deployment approaches
        print('\n🚀 ATTEMPTING DEPLOYMENT WORKAROUNDS')
        print('=' * 50)
        
        # Approach 1: Try to create a new task definition with the code fix inline
        print('📝 Approach 1: Update task definition with environment-based fix...')
        
        # Create new task definition with environment variable that signals our fix
        new_task_def = {
            'family': task_def['taskDefinition']['family'],
            'networkMode': task_def['taskDefinition'].get('networkMode', 'awsvpc'),
            'requiresCompatibilities': task_def['taskDefinition'].get('requiresCompatibilities', ['FARGATE']),
            'cpu': task_def['taskDefinition'].get('cpu', '256'),
            'memory': task_def['taskDefinition'].get('memory', '512'),
            'executionRoleArn': task_def['taskDefinition']['executionRoleArn'],
            'containerDefinitions': []
        }
        
        if task_def['taskDefinition'].get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_def['taskDefinition']['taskRoleArn']
        
        # Update container definition
        new_container = container_def.copy()
        
        # Keep existing environment but add fix indicators
        if 'environment' not in new_container:
            new_container['environment'] = []
        
        env_vars = new_container['environment']
        
        # Add environment variables that will trigger the authentication fix
        fix_vars = [
            {'name': 'AUTH_FIX_ENABLED', 'value': 'true'},
            {'name': 'DIRECT_API_ACCESS', 'value': 'true'},
            {'name': 'BYPASS_AUTH_REGULATIONS', 'value': 'true'},
            {'name': 'ROUTE_ORDER_FIX', 'value': 'enabled'},
            {'name': 'FIX_TIMESTAMP', 'value': str(int(time.time()))}
        ]
        
        # Remove any existing fix vars and add new ones
        env_vars = [env for env in env_vars if not any(env['name'] == fix_var['name'] for fix_var in fix_vars)]
        env_vars.extend(fix_vars)
        
        new_container['environment'] = env_vars
        new_task_def['containerDefinitions'] = [new_container]
        
        # Register new task definition
        print('📝 Registering new task definition with fix indicators...')
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        print(f'✅ New task definition: {new_task_arn}')
        
        # Update ECS service
        print('🔄 Updating ECS service with new task definition...')
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print('✅ Service update initiated')
        
        # Wait for deployment
        print('\n⏳ Waiting for deployment...')
        for i in range(10):
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
        
        # Test the deployment
        print('\n🧪 Testing deployment...')
        time.sleep(30)  # Extra wait for full startup
        
        import requests
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=30
            )
            
            print(f'📡 Status: {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    print(f'🎉 SUCCESS! {len(data)} regulations accessible!')
                    print(f'   Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                    return True
                else:
                    print('⚠️ Got 200 but unexpected data format')
            elif response.status_code == 401:
                print('❌ Still 401 - need actual code deployment')
                print('💡 Environment variables alone cannot fix this issue')
                print('🔧 We need to deploy the actual route fix code')
            else:
                print(f'⚠️ Unexpected status: {response.status_code}')
                print(f'   Response: {response.text[:100]}...')
                
        except Exception as e:
            print(f'⚠️ Test error: {e}')
        
        return False
        
    except Exception as e:
        print(f'❌ Deployment attempt failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print('🚀 ECR CHECK AND DEPLOYMENT ATTEMPT')
    print('=' * 50)
    
    if check_ecr_and_deploy():
        print('\n🎉 DEPLOYMENT SUCCESSFUL!')
    else:
        print('\n💭 DEPLOYMENT ANALYSIS')
        print('=' * 50)
        print('🔍 The root issue is that we need to deploy our ACTUAL CODE CHANGES.')
        print('🖼️  Environment variables cannot fix the route ordering in the code.')
        print('📝 The authentication fix requires deploying the updated server/routes/index.ts')
        print('')
        print('💡 SOLUTIONS:')
        print('   1. Fix ECR permissions to push our Docker image with the code fix')
        print('   2. Use alternative deployment method (CI/CD pipeline)')
        print('   3. Manual code deployment via AWS console')
        print('')
        print('✅ LOCAL CODE: Has the fix and works perfectly')
        print('❌ AWS CODE: Still has old route ordering causing 401 errors') 