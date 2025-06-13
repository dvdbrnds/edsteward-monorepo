#!/usr/bin/env python3
"""
Force ECS deployment - bypasses shell issues
"""
import subprocess
import json
import time

def run_aws_command(cmd_args):
    """Run AWS CLI command directly"""
    try:
        full_cmd = ['/opt/homebrew/bin/aws'] + cmd_args
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"Exception: {e}")
        return None

def force_deployment():
    """Force ECS deployment by scaling down and up"""
    print("🚀 FORCING ECS DEPLOYMENT - BYPASSING SHELL ISSUES")
    print("=" * 55)
    
    cluster = 'edsteward-cluster'
    service = 'edsteward-service'
    
    print("📊 Step 1: Scale down to 0...")
    scale_down_cmd = [
        'ecs', 'update-service',
        '--cluster', cluster,
        '--service', service,
        '--desired-count', '0'
    ]
    
    result = run_aws_command(scale_down_cmd)
    if result:
        print("✅ Scaled down to 0")
        
        print("⏳ Waiting 30 seconds for tasks to stop...")
        time.sleep(30)
        
        print("📊 Step 2: Scale up to 1 with latest task definition...")
        scale_up_cmd = [
            'ecs', 'update-service',
            '--cluster', cluster,
            '--service', service,
            '--desired-count', '1',
            '--task-definition', 'edsteward:4'
        ]
        
        result = run_aws_command(scale_up_cmd)
        if result:
            print("✅ Scaled up to 1 with task definition edsteward:4")
            print("⏳ Waiting 60 seconds for deployment...")
            time.sleep(60)
            
            # Test the application
            print("🧪 Testing application...")
            test_cmd = [
                'curl', '-X', 'POST',
                'https://edsteward.ai/api/register',
                '-H', 'Content-Type: application/json',
                '-d', '{"username":"force-test-' + str(int(time.time())) + '","password":"test123","confirmPassword":"test123"}'
            ]
            
            try:
                test_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=10)
                response = test_result.stdout
                print(f"📊 API Response: {response[:200]}...")
                
                if 'ssl' in response.lower() or 'enoent' in response.lower():
                    print("❌ Still seeing SSL/file errors - deployment may need more time")
                elif 'user' in response.lower() or 'success' in response.lower():
                    print("🎉 SUCCESS! Application is working!")
                else:
                    print("⚠️ Unexpected response - check manually")
                    
            except Exception as e:
                print(f"⚠️ Could not test application: {e}")
            
        else:
            print("❌ Failed to scale up")
    else:
        print("❌ Failed to scale down")

if __name__ == "__main__":
    force_deployment() 