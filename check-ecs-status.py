#!/usr/bin/env python3
"""
Direct AWS ECS status checker - bypasses shell issues
"""
import subprocess
import json
import sys

def run_aws_command(cmd_args):
    """Run AWS CLI command directly"""
    try:
        # Use full path to aws to avoid shell issues
        full_cmd = ['/opt/homebrew/bin/aws'] + cmd_args
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Error: {result.stderr}")
            return None
            
    except subprocess.TimeoutExpired:
        print("Command timed out")
        return None
    except Exception as e:
        print(f"Exception: {e}")
        return None

def check_ecs_status():
    """Check ECS service status"""
    print("🔍 CHECKING ECS STATUS - BYPASSING SHELL ISSUES")
    print("=" * 50)
    
    # Get service description
    cmd = [
        'ecs', 'describe-services',
        '--cluster', 'edsteward-cluster',
        '--services', 'edsteward-service',
        '--output', 'json'
    ]
    
    print("📋 Getting service information...")
    result = run_aws_command(cmd)
    
    if not result:
        print("❌ Failed to get service information")
        return
    
    try:
        data = json.loads(result)
        service = data['services'][0]
        
        print("\n✅ SERVICE STATUS:")
        print(f"   Task Definition: {service['taskDefinition']}")
        print(f"   Desired Count: {service['desiredCount']}")
        print(f"   Running Count: {service['runningCount']}")
        print(f"   Pending Count: {service['pendingCount']}")
        
        print("\n🚀 DEPLOYMENTS:")
        for i, deployment in enumerate(service['deployments']):
            print(f"   Deployment {i+1}:")
            print(f"     Status: {deployment['status']}")
            print(f"     Task Definition: {deployment['taskDefinition']}")
            print(f"     Running: {deployment['runningCount']}")
            print(f"     Pending: {deployment['pendingCount']}")
            print(f"     Created: {deployment['createdAt']}")
            print()
        
        # Check current task definition
        current_task_def = service['taskDefinition']
        if 'edsteward:4' in current_task_def:
            print("✅ Using latest task definition (edsteward:4) with RDS database!")
        elif 'edsteward:3' in current_task_def:
            print("⚠️ Using task definition edsteward:3")
        elif 'edsteward:2' in current_task_def:
            print("⚠️ Using task definition edsteward:2")
        else:
            print(f"❌ Using old task definition: {current_task_def}")
        
        # Check if deployment is complete
        primary_deployment = next((d for d in service['deployments'] if d['status'] == 'PRIMARY'), None)
        if primary_deployment:
            if primary_deployment['runningCount'] > 0 and primary_deployment['pendingCount'] == 0:
                print("✅ Deployment appears complete!")
            else:
                print("⏳ Deployment still in progress...")
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse JSON: {e}")
    except KeyError as e:
        print(f"❌ Missing expected field: {e}")

if __name__ == "__main__":
    check_ecs_status() 