#!/usr/bin/env python3
import boto3
import time

def deploy_final_working():
    """Deploy the final working fix"""
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Use the final working image
        final_image = '259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-repo:final-working-1750034020'
        
        print(f"🚀 Deploying FINAL WORKING FIX: {final_image}")
        
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
                new_container['image'] = final_image
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
        
        print("⏳ Waiting for final working deployment...")
        
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
                    print("✅ FINAL WORKING DEPLOYMENT COMPLETED!")
                    
                    # Test the fix
                    print("🧪 Testing the final working fix...")
                    time.sleep(15)
                    
                    import requests
                    try:
                        # Test the frontend endpoint that was failing
                        response = requests.get('http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations', timeout=15)
                        if response.status_code == 200:
                            data = response.json()
                            if len(data) > 0:
                                first_reg = data[0]
                                field_count = len(first_reg.keys())
                                has_requirements = 'requirements' in first_reg
                                has_regulation_url = 'regulationUrl' in first_reg
                                has_submission_guidelines = 'submissionGuidelines' in first_reg
                                
                                print(f"📊 Regulation has {field_count} fields")
                                print(f"✅ Has requirements field: {has_requirements}")
                                print(f"✅ Has regulationUrl field: {has_regulation_url}")
                                print(f"✅ Has submissionGuidelines field: {has_submission_guidelines}")
                                
                                if has_requirements and has_regulation_url and field_count > 20:
                                    print("🎉 SUCCESS! The frontend should now work!")
                                    print("🎯 All critical fields are now present in /api/regulations")
                                    print("🚀 EdSteward is now fully operational!")
                                    return True
                                else:
                                    print("⚠️ Still missing some critical fields")
                                    return False
                            else:
                                print("⚠️ No regulations returned")
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
    deploy_final_working() 