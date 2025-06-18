#!/usr/bin/env python3
import boto3
import time

def deploy_public_fix():
    """Deploy the public fix"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Use the public fix image
        public_fix_image = '259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-repo:public-fix-1750035967'
        
        print(f"🚀 Deploying PUBLIC FIX: {public_fix_image}")
        
        # Get current task definition
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_def = response['services'][0]['taskDefinition']
        
        # Get task definition details
        task_def_response = ecs.describe_task_definition(taskDefinition=current_task_def)
        task_def = task_def_response['taskDefinition']
        
        # Create new task definition
        new_task_def = {
            'family': task_def['family'],
            'networkMode': task_def['networkMode'],
            'requiresCompatibilities': task_def['requiresCompatibilities'],
            'cpu': task_def['cpu'],
            'memory': task_def['memory'],
            'executionRoleArn': task_def['executionRoleArn'],
            'containerDefinitions': []
        }
        
        if task_def.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = task_def['taskRoleArn']
        
        # Update container image
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            if container['name'] == 'edsteward-app':
                new_container['image'] = public_fix_image
            new_task_def['containerDefinitions'].append(new_container)
        
        # Register and deploy
        new_task_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = new_task_response['taskDefinition']['taskDefinitionArn']
        
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print("⏳ Waiting for public fix deployment...")
        
        # Wait for deployment
        for i in range(15):
            time.sleep(30)
            
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            desired_count = service['desiredCount']
            
            deployments = service['deployments']
            primary_deployment = next((d for d in deployments if d['status'] == 'PRIMARY'), None)
            
            if primary_deployment:
                current_task_def = primary_deployment['taskDefinition']
                print(f"   Attempt {i+1}: {running_count}/{desired_count} tasks, using {current_task_def}")
                
                if running_count == desired_count and new_task_arn in current_task_def:
                    print("✅ PUBLIC FIX DEPLOYMENT COMPLETED!")
                    
                    # Test the fix
                    print("🧪 Testing the public fix...")
                    time.sleep(15)
                    
                    import requests
                    try:
                        # Test the public endpoint
                        response = requests.get('http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/public/regulations', timeout=15)
                        if response.status_code == 200:
                            data = response.json()
                            if isinstance(data, list) and len(data) > 0:
                                first_reg = data[0]
                                field_count = len(first_reg.keys())
                                has_requirements = 'requirements' in first_reg
                                has_regulation_url = 'regulationUrl' in first_reg
                                has_submission_guidelines = 'submissionGuidelines' in first_reg
                                
                                print(f"📊 Public regulation has {field_count} fields")
                                print(f"✅ Has requirements field: {has_requirements}")
                                print(f"✅ Has regulationUrl field: {has_regulation_url}")
                                print(f"✅ Has submissionGuidelines field: {has_submission_guidelines}")
                                
                                if has_requirements and has_regulation_url and field_count > 20:
                                    print("🎉 SUCCESS! The public endpoint now has complete data!")
                                    print("🎯 All critical fields are now present in /api/public/regulations")
                                    print("🚀 EdSteward frontend should now work!")
                                    
                                    # Test the emergency endpoint too
                                    print("🧪 Testing emergency endpoint...")
                                    emergency_response = requests.get('http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/public-regulations', timeout=15)
                                    if emergency_response.status_code == 200:
                                        emergency_data = emergency_response.json()
                                        if isinstance(emergency_data, list) and len(emergency_data) > 0:
                                            emergency_reg = emergency_data[0]
                                            emergency_field_count = len(emergency_reg.keys())
                                            print(f"🚨 Emergency endpoint has {emergency_field_count} fields")
                                            print("🎯 Emergency endpoint also working!")
                                        else:
                                            print("⚠️ Emergency endpoint returned wrong format")
                                    else:
                                        print(f"⚠️ Emergency endpoint returned status {emergency_response.status_code}")
                                    
                                    return True
                                else:
                                    print("⚠️ Still missing some critical fields")
                                    return False
                            else:
                                print("⚠️ No regulations returned or wrong format")
                                return False
                        else:
                            print(f"⚠️ API returned status {response.status_code}")
                            return False
                    except Exception as e:
                        print(f"⚠️ Couldn't test API: {e}")
                        return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    deploy_public_fix() 