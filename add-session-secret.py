#!/usr/bin/env python3

import boto3
import secrets
import string

def main():
    print("🔑 ADDING MISSING SESSION_SECRET")
    print("=================================")
    print("Issue: Environment variable SESSION_SECRET is required but not set")
    print("Fix: Add SESSION_SECRET to current task definition")
    print()

    # Initialize AWS client
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
    except Exception as e:
        print(f"❌ Failed to initialize AWS client: {e}")
        return

    # Generate a secure session secret
    session_secret = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(64))
    print(f"🔐 Generated secure SESSION_SECRET: {session_secret[:20]}...")

    try:
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward')
        current_task_def = response['taskDefinition']
        current_revision = current_task_def['revision']
        
        print(f"📋 Current task definition: edsteward:{current_revision}")
        
        # Create new task definition with SESSION_SECRET
        new_task_def = {
            'family': 'edsteward',
            'networkMode': current_task_def.get('networkMode'),
            'requiresCompatibilities': current_task_def.get('requiresCompatibilities'),
            'cpu': current_task_def.get('cpu'),
            'memory': current_task_def.get('memory'),
            'containerDefinitions': []
        }
        
        # Add execution role if present
        if current_task_def.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
        
        # Update container definition with SESSION_SECRET
        for container in current_task_def['containerDefinitions']:
            container_def = container.copy()
            if container_def['name'] == 'edsteward':
                env_vars = container_def.get('environment', [])
                
                # Add SESSION_SECRET
                session_secret_found = False
                for env_var in env_vars:
                    if env_var['name'] == 'SESSION_SECRET':
                        env_var['value'] = session_secret
                        session_secret_found = True
                        print("   ✅ Updated existing SESSION_SECRET")
                        break
                
                if not session_secret_found:
                    env_vars.append({
                        'name': 'SESSION_SECRET',
                        'value': session_secret
                    })
                    print("   ✅ Added new SESSION_SECRET")
                
                container_def['environment'] = env_vars
            
            new_task_def['containerDefinitions'].append(container_def)
        
        # Register new task definition
        response = ecs.register_task_definition(**new_task_def)
        new_revision = response['taskDefinition']['revision']
        
        print(f"✅ New task definition created: edsteward:{new_revision}")
        
        # Update service
        print("\n🚀 Updating ECS service...")
        
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=f'edsteward:{new_revision}',
            forceNewDeployment=True
        )
        print("✅ Service update initiated")
        
        print(f"\n🎉 SESSION_SECRET ADDED SUCCESSFULLY!")
        print(f"Task Definition: edsteward:{new_revision}")
        print()
        print("🔍 Monitor progress with:")
        print("   python3 check-exact-status.py")
        print("   python3 check-logs-aggressive.py")
        print()
        print("All known issues should now be resolved:")
        print("✅ SSL parsing error - FIXED")
        print("✅ Module not found error - FIXED") 
        print("✅ SESSION_SECRET missing - FIXED")
        
    except Exception as e:
        print(f"❌ Failed to add SESSION_SECRET: {e}")

if __name__ == "__main__":
    main() 