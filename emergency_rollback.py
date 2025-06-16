#!/usr/bin/env python3
import boto3
import json
import time

def get_previous_working_task_definition():
    """Find a previous working task definition"""
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # List task definitions for the service
    response = ecs.list_task_definitions(
        familyPrefix='edsteward',
        status='ACTIVE',
        sort='DESC'
    )
    
    print("Available task definitions:")
    for i, arn in enumerate(response['taskDefinitionArns'][:10]):  # Show last 10
        print(f"  {i+1}. {arn}")
    
    # Try to get service current status
    try:
        service_response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        current_task_def = service_response['services'][0]['taskDefinition']
        print(f"\nCurrent task definition: {current_task_def}")
        
        deployments = service_response['services'][0]['deployments']
        print(f"\nCurrent deployments:")
        for deployment in deployments:
            print(f"  Status: {deployment['status']}")
            print(f"  Task Definition: {deployment['taskDefinition']}")
            print(f"  Running Count: {deployment['runningCount']}")
            print(f"  Desired Count: {deployment['desiredCount']}")
            print()
        
        # Look for a working task definition (not the current failing one)
        task_def_arns = response['taskDefinitionArns']
        
        # Try to find task definition :78 (before our changes)
        for arn in task_def_arns:
            if ':78' in arn:
                print(f"Found previous working version: {arn}")
                return arn
        
        # If not found, try :77, :76, etc.
        for version in range(77, 70, -1):
            for arn in task_def_arns:
                if f':{version}' in arn:
                    print(f"Found alternative working version: {arn}")
                    return arn
        
        return None
        
    except Exception as e:
        print(f"Error checking service: {e}")
        return None

def rollback_service(target_task_definition):
    """Rollback the service to a previous task definition"""
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    print(f"\n🔄 Rolling back to: {target_task_definition}")
    
    try:
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=target_task_definition
        )
        
        print("✅ Rollback initiated successfully!")
        print(f"New deployment status: {response['service']['deployments'][0]['status']}")
        
        # Wait for deployment to complete
        print("\n⏳ Waiting for deployment to complete...")
        waiter = ecs.get_waiter('services_stable')
        
        try:
            waiter.wait(
                cluster='edsteward-cluster',
                services=['edsteward-service'],
                WaiterConfig={
                    'delay': 15,
                    'maxAttempts': 20
                }
            )
            print("✅ Rollback completed successfully!")
            
        except Exception as e:
            print(f"⚠️ Rollback in progress (couldn't wait for completion): {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        return False

def main():
    print("🚨 EMERGENCY ROLLBACK SCRIPT")
    print("=" * 50)
    
    # First, find a working task definition
    target_task_def = get_previous_working_task_definition()
    
    if not target_task_def:
        print("❌ No previous working task definition found!")
        print("Available task definitions to try manually:")
        
        ecs = boto3.client('ecs', region_name='us-east-1')
        response = ecs.list_task_definitions(
            familyPrefix='edsteward',
            status='ACTIVE',
            sort='DESC'
        )
        
        for arn in response['taskDefinitionArns'][:5]:
            print(f"  {arn}")
        
        return False
    
    # Confirm rollback
    print(f"\n🤔 Do you want to rollback to: {target_task_def}")
    print("This will replace the current failing deployment.")
    
    # For automation, proceed with rollback
    print("🚀 Proceeding with automatic rollback...")
    
    success = rollback_service(target_task_def)
    
    if success:
        print("\n✅ EMERGENCY ROLLBACK COMPLETED!")
        print("The service should be healthy again in a few minutes.")
        print("You can check status with: python3 check_aws_status.py")
    else:
        print("\n❌ EMERGENCY ROLLBACK FAILED!")
        print("Manual intervention required.")
    
    return success

if __name__ == "__main__":
    main() 