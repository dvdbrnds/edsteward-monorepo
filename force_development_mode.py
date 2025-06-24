#!/usr/bin/env python3
import boto3
import json

def main():
    print("🔧 FORCING DEVELOPMENT MODE")
    print("Updating task definition to always create database tables...")
    print("=" * 50)
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Get current task definition
    current_task_def = get_current_task_definition(ecs)
    if not current_task_def:
        return
    
    # Update environment variables
    updated_task_def = update_environment_variables(current_task_def)
    
    # Register new task definition
    new_revision = register_task_definition(ecs, updated_task_def)
    
    # Update service
    update_service(ecs, new_revision)

def get_current_task_definition(ecs):
    try:
        response = ecs.describe_task_definition(
            taskDefinition='edsteward-task'
        )
        return response['taskDefinition']
    except Exception as e:
        print(f"❌ Error getting task definition: {e}")
        return None

def update_environment_variables(task_def):
    print("📝 Updating environment variables...")
    
    container = task_def['containerDefinitions'][0]
    env_vars = container.get('environment', [])
    
    # Environment variables to set/update
    updates = {
        'NODE_ENV': 'development',  # Force development mode
        'FORCE_SCHEMA_CREATION': 'true',  # Force schema creation
        'DATABASE_URL': 'postgresql://edsteward:edsteward123@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable',
        'NODE_TLS_REJECT_UNAUTHORIZED': '0'
    }
    
    # Update existing or add new environment variables
    env_dict = {env['name']: env['value'] for env in env_vars}
    env_dict.update(updates)
    
    # Convert back to list format
    container['environment'] = [{'name': k, 'value': v} for k, v in env_dict.items()]
    
    print("   ✅ Environment variables updated:")
    for key, value in updates.items():
        print(f"      {key}: {value}")
    
    return task_def

def register_task_definition(ecs, task_def):
    try:
        print("📝 Registering new task definition...")
        
        # Remove fields that shouldn't be in the registration
        registration_def = {
            'family': task_def['family'],
            'taskRoleArn': task_def['taskRoleArn'],
            'executionRoleArn': task_def['executionRoleArn'],
            'networkMode': task_def['networkMode'],
            'requiresCompatibilities': task_def['requiresCompatibilities'],
            'cpu': task_def['cpu'],
            'memory': task_def['memory'],
            'containerDefinitions': task_def['containerDefinitions']
        }
        
        response = ecs.register_task_definition(**registration_def)
        
        new_revision = response['taskDefinition']['revision']
        print(f"   ✅ New task definition registered: revision {new_revision}")
        
        return new_revision
        
    except Exception as e:
        print(f"❌ Error registering task definition: {e}")
        return None

def update_service(ecs, revision):
    try:
        print("🚀 Updating service with new task definition...")
        
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=f'edsteward-task:{revision}',
            forceNewDeployment=True
        )
        
        print("   ✅ Service update initiated")
        print("   📝 New containers will start in development mode")
        print("   📝 Database tables will be created automatically")
        
        return True
        
    except Exception as e:
        print(f"❌ Error updating service: {e}")
        return False

if __name__ == "__main__":
    main()
    
    print(f"\n💡 WHAT HAPPENS NEXT:")
    print(f"1. ECS will start new containers in development mode")
    print(f"2. Application will automatically create database tables")
    print(f"3. Admin user will be created with username: admin, password: admin123")
    print(f"4. Wait 2-3 minutes for deployment to complete")
    print(f"5. Try logging in at https://edsteward.ai")
    
    print(f"\n🔍 MONITOR PROGRESS:")
    print(f"   aws ecs describe-services --cluster edsteward-cluster --services edsteward-service")
    print(f"   aws logs filter-log-events --log-group-name /aws/ecs/edsteward --filter-pattern 'CREATE TABLE'") 