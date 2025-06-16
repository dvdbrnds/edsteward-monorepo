#!/usr/bin/env python3
"""
Simple AWS Deployment Script
============================
Deploy with Neon database configuration
"""

import boto3
import time

def deploy_to_aws():
    """Deploy with Neon configuration"""
    print('🚀 DEPLOYING TO AWS ECS')
    print('=' * 25)
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Check current service status
        print('📊 Checking current service status...')
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        if not response['services']:
            print('❌ Service not found!')
            return False
            
        service = response['services'][0]
        print(f'Service status: {service["status"]}')
        print(f'Running tasks: {service["runningCount"]}/{service["desiredCount"]}')
        
        # Get current task definition
        current_task_def_arn = service['taskDefinition']
        print(f'Current task definition: {current_task_def_arn}')
        
        response = ecs.describe_task_definition(taskDefinition=current_task_def_arn)
        current_task_def = response['taskDefinition']
        
        # Create new task definition with Neon environment
        print('🔧 Creating new task definition with Neon configuration...')
        
        # Neon environment variables
        neon_env = [
            {"name": "DATABASE_URL", "value": "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"},
            {"name": "DB_HOST", "value": "ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech"},
            {"name": "DB_PORT", "value": "5432"},
            {"name": "DB_NAME", "value": "neondb"},
            {"name": "DB_USER", "value": "neondb_owner"},
            {"name": "DB_PASSWORD", "value": "npg_foSr6ixkzw7W"},
            {"name": "DB_SSL", "value": "true"},
            {"name": "NODE_ENV", "value": "production"},
            {"name": "PORT", "value": "3000"}
        ]
        
        # Build new task definition
        new_task_def = {
            'family': current_task_def['family'],
            'containerDefinitions': []
        }
        
        # Copy essential fields
        for field in ['networkMode', 'requiresCompatibilities', 'cpu', 'memory']:
            if field in current_task_def:
                new_task_def[field] = current_task_def[field]
                
        # Copy IAM roles if they exist
        for role_field in ['taskRoleArn', 'executionRoleArn']:
            if current_task_def.get(role_field):
                new_task_def[role_field] = current_task_def[role_field]
        
        # Update containers
        for container in current_task_def['containerDefinitions']:
            new_container = {}
            
            # Copy essential container fields
            essential_fields = ['name', 'image', 'memory', 'cpu', 'essential', 'portMappings']
            for field in essential_fields:
                if field in container:
                    new_container[field] = container[field]
            
            # Add logging if it exists
            if 'logConfiguration' in container:
                new_container['logConfiguration'] = container['logConfiguration']
            
            # Set new environment variables
            new_container['environment'] = neon_env
            
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register new task definition
        print('📝 Registering new task definition...')
        response = ecs.register_task_definition(**new_task_def)
        new_task_def_arn = response['taskDefinition']['taskDefinitionArn']
        new_revision = response['taskDefinition']['revision']
        
        print(f'✅ New task definition: {current_task_def["family"]}:{new_revision}')
        
        # Update service
        print('🔄 Updating ECS service...')
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_def_arn,
            forceNewDeployment=True  # Force new deployment
        )
        
        print('⏳ Waiting for deployment...')
        
        # Wait for deployment with shorter intervals
        for attempt in range(30):  # 15 minutes max
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            print(f'   Attempt {attempt + 1}: {running_count}/{desired_count} tasks running')
            
            # Check if deployment is complete
            if running_count == desired_count and running_count > 0:
                print('✅ Deployment successful!')
                return True
                
            # Check for deployment failures
            if len(service['deployments']) > 0:
                deployment = service['deployments'][0]
                if deployment['status'] == 'STOPPED':
                    print(f'❌ Deployment stopped: {deployment.get("statusReason", "Unknown")}')
                    break
        
        print('⚠️  Deployment did not complete in expected time')
        return False
        
    except Exception as e:
        print(f'❌ Deployment error: {e}')
        return False

def check_deployment():
    """Check deployment status"""
    print('\n🔍 CHECKING DEPLOYMENT STATUS')
    print('=' * 35)
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        
        print(f'Service status: {service["status"]}')
        print(f'Running tasks: {service["runningCount"]}/{service["desiredCount"]}')
        print(f'Pending tasks: {service["pendingCount"]}')
        
        # Check deployments
        if service['deployments']:
            print('\nDeployments:')
            for i, deployment in enumerate(service['deployments'][:3]):
                status = deployment['status']
                created = deployment['createdAt'].strftime('%Y-%m-%d %H:%M:%S')
                print(f'  {i+1}. Status: {status}, Created: {created}')
        
        # Check tasks
        response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service'
        )
        
        if response['taskArns']:
            print('\nTasks:')
            task_response = ecs.describe_tasks(
                cluster='edsteward-cluster',
                tasks=response['taskArns']
            )
            
            for task in task_response['tasks']:
                status = task['lastStatus']
                health = task.get('healthStatus', 'UNKNOWN')
                print(f'  Task: {status} (Health: {health})')
        
        return service['runningCount'] > 0
        
    except Exception as e:
        print(f'❌ Error checking status: {e}')
        return False

def main():
    print('🎯 AWS ECS DEPLOYMENT')
    print('=' * 20)
    
    # Deploy
    if deploy_to_aws():
        print('\n✅ Deployment completed successfully!')
        
        # Final status check
        if check_deployment():
            print('\n🎉 Service is running!')
            print('🌐 Check: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/public/regulations')
        else:
            print('\n⚠️  Service may need more time to start')
    else:
        print('\n❌ Deployment failed')
        check_deployment()

if __name__ == '__main__':
    main() 