#!/usr/bin/env python3
"""
Emergency Production Deployment
Get EdSteward back online with UUID mapping + Neon password fixes
"""

import boto3
import json
import time

def deploy_emergency_fix():
    print('🚨 EMERGENCY PRODUCTION DEPLOYMENT')
    print('==================================')
    print('Goal: Get EdSteward back online after 48 hours downtime')
    print('')
    
    # Initialize ECS client
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Register new task definition with fixed image and Neon password
        print('📋 Registering emergency task definition...')
        
        with open('production-emergency-deploy.json', 'r') as f:
            task_def = json.load(f)
        
        response = ecs.register_task_definition(**task_def)
        new_task_arn = response['taskDefinition']['taskDefinitionArn']
        
        print(f'✅ Task definition registered: {new_task_arn}')
        
        # Update service to use new task definition
        print('🔄 Updating ECS service...')
        
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service', 
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        print('✅ Service update initiated!')
        print('')
        print('🎯 DEPLOYMENT SUMMARY:')
        print('- Image: 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest')
        print('- UUID Mapping: 3a1cbce2-0cf8-4c4f-ab96-4023eca4977d → moravian')
        print('- Neon Password: npg_foSr6ixkzw7W (correct)')
        print('- Multi-tenant: Enabled')
        print('')
        print('⏳ Deployment will take ~2-3 minutes to complete')
        print('🌐 Test: https://moravian.edsteward.ai')
        print('')
        print('📊 Monitor deployment:')
        print('aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1')
        
        return True
        
    except Exception as e:
        print(f'❌ Emergency deployment failed: {e}')
        return False

if __name__ == '__main__':
    success = deploy_emergency_fix()
    exit(0 if success else 1) 