#!/usr/bin/env python3
import subprocess
import json
import os
import time

# Set environment variables to avoid AWS CLI pager issues
os.environ['AWS_PAGER'] = ''
os.environ['AWS_CLI_AUTO_PROMPT'] = 'off'

def run_aws_command(command):
    """Run an AWS CLI command and return the result"""
    try:
        result = subprocess.run(command, capture_output=True, text=True, env=os.environ)
        if result.returncode == 0:
            try:
                return True, json.loads(result.stdout)
            except json.JSONDecodeError:
                return True, result.stdout
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

def force_restart():
    """Force restart the service"""
    print("🔄 Forcing service restart...")
    command = [
        'aws', 'ecs', 'update-service',
        '--cluster', 'edsteward-cluster',
        '--service', 'edsteward-service',
        '--force-new-deployment',
        '--region', 'us-east-1'
    ]
    
    success, data = run_aws_command(command)
    if success:
        print("✅ Service restart initiated")
        return True
    else:
        print(f"❌ Failed to restart service: {data}")
        return False

def wait_for_service():
    """Wait for service to be running"""
    print("⏳ Waiting for service to start...")
    max_attempts = 20  # 10 minutes max
    attempt = 0
    
    while attempt < max_attempts:
        command = [
            'aws', 'ecs', 'describe-services',
            '--cluster', 'edsteward-cluster',
            '--services', 'edsteward-service',
            '--region', 'us-east-1'
        ]
        
        success, data = run_aws_command(command)
        if success and isinstance(data, dict):
            service = data['services'][0]
            running = service['runningCount']
            desired = service['desiredCount']
            
            print(f"   Attempt {attempt + 1}: {running}/{desired} tasks running")
            
            if running >= desired and running > 0:
                print("✅ Service is running!")
                return True
                
            # Check for any stopped tasks with errors
            command = [
                'aws', 'ecs', 'list-tasks',
                '--cluster', 'edsteward-cluster',
                '--service-name', 'edsteward-service',
                '--desired-status', 'STOPPED',
                '--region', 'us-east-1'
            ]
            
            success, task_data = run_aws_command(command)
            if success and isinstance(task_data, dict):
                stopped_tasks = task_data.get('taskArns', [])
                if stopped_tasks:
                    # Get details of stopped tasks
                    command = [
                        'aws', 'ecs', 'describe-tasks',
                        '--cluster', 'edsteward-cluster',
                        '--tasks'] + stopped_tasks[-1:] + ['--region', 'us-east-1']  # Just the latest
                    
                    success, stopped_data = run_aws_command(command)
                    if success and isinstance(stopped_data, dict):
                        for task in stopped_data.get('tasks', []):
                            if 'stoppedReason' in task:
                                print(f"   ⚠️  Task stopped: {task['stoppedReason']}")
        
        time.sleep(30)  # Wait 30 seconds
        attempt += 1
    
    print("❌ Service did not start within 10 minutes")
    return False

def test_health():
    """Test the health endpoint"""
    import requests
    
    print("🔧 Testing health endpoint...")
    try:
        response = requests.get("http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health check passed!")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def main():
    print("🚀 EdSteward Service Restart")
    print("=" * 40)
    
    # Force restart
    if not force_restart():
        return
    
    # Wait for service to be ready
    if wait_for_service():
        # Test health
        time.sleep(10)  # Give it a moment to fully start
        if test_health():
            print("\n🎉 SUCCESS! Service is running and healthy")
            print("You can now run: python3 test_endpoints.py")
        else:
            print("\n⚠️  Service is running but health check failed")
            print("Wait a minute and try: python3 test_endpoints.py")
    else:
        print("\n❌ Service failed to start properly")
        print("Check AWS console for more details")

if __name__ == "__main__":
    main() 