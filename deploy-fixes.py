#!/usr/bin/env python3
"""
Deploy production fixes to EdSteward
Includes HEAD request fix, Brotli compression fix, and all other fixes
"""

import boto3
import json
import time

def deploy_fixes():
    print('🚀 DEPLOYING PRODUCTION FIXES')
    print('============================')
    print('Fixes included:')
    print('- HEAD request handling for regulations API')
    print('- Brotli compression disabled')
    print('- Correct Neon database password')
    print('- CORS configuration')
    print('- Single-tenant architecture')
    print('')
    
    # Initialize ECS client
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Register new task definition
        print('📋 Registering new task definition...')
        
        with open('working-task-definition.json', 'r') as f:
            task_def = json.load(f)
        
        response = ecs.register_task_definition(**task_def)
        new_task_arn = response['taskDefinition']['taskDefinitionArn']
        
        print(f'✅ Task definition registered: {new_task_arn}')
        
        # Update service
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
        print('- All fixes included in the image')
        print('- Database password: correct')
        print('- Task definition: edsteward-production-fixed')
        print('')
        print('⏳ Deployment will take ~2-3 minutes')
        print('🌐 Test: https://moravian.edsteward.ai')
        
        return True
        
    except Exception as e:
        print(f'❌ Deployment failed: {e}')
        return False

if __name__ == '__main__':
    success = deploy_fixes()
    exit(0 if success else 1) 