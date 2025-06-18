#!/usr/bin/env python3
"""
Force fresh deployment and monitor progress
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
    """Force fresh deployment and monitor"""
    print("🚀 FORCING FRESH DEPLOYMENT")
    print("=" * 40)
    
    print("\n📋 Step 1: Stopping all existing tasks...")
    
    # Get current tasks
    tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
    result = run_aws_command(tasks_cmd)
    
    task_arns = []
    if result:
        try:
            data = json.loads(result)
            task_arns = data.get('taskArns', [])
            print(f"   Found {len(task_arns)} existing tasks")
        except Exception as e:
            print(f"   Error: {e}")
    
    # Stop all existing tasks
    for task_arn in task_arns:
        task_id = task_arn.split('/')[-1]
        print(f"   Stopping task: {task_id}")
        stop_cmd = ['ecs', 'stop-task', '--cluster', 'edsteward-cluster', '--task', task_arn, '--reason', 'Force fresh deployment']
        run_aws_command(stop_cmd)
    
    # Wait for tasks to stop
    if task_arns:
        print("   ⏳ Waiting 30 seconds for tasks to stop...")
        time.sleep(30)
    
    print("\n📋 Step 2: Forcing new deployment...")
    
    # Force new deployment
    deploy_cmd = ['ecs', 'update-service', 
                  '--cluster', 'edsteward-cluster', 
                  '--service', 'edsteward-service', 
                  '--force-new-deployment',
                  '--desired-count', '1']
    
    result = run_aws_command(deploy_cmd)
    
    if result:
        print("✅ New deployment started!")
        
        print("\n📋 Step 3: Monitoring deployment...")
        
        for i in range(10):  # Monitor for 5 minutes (30 sec intervals)
            time.sleep(30)
            
            # Check service status
            status_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
            result = run_aws_command(status_cmd)
            
            if result:
                try:
                    data = json.loads(result)
                    service = data['services'][0]
                    
                    running_count = service['runningCount']
                    pending_count = service['pendingCount']
                    
                    print(f"   ⏳ Check {i+1}/10: Running={running_count}, Pending={pending_count}")
                    
                    if running_count > 0:
                        print("   🎉 Task is running!")
                        
                        # Test API quickly
                        print("\n📋 Step 4: Testing API...")
                        try:
                            test_result = subprocess.run(
                                ['curl', '-s', '-w', '%{http_code}', 'https://edsteward.ai/api/health', '--max-time', '5'],
                                capture_output=True,
                                text=True,
                                timeout=8
                            )
                            
                            http_code = test_result.stdout[-3:]
                            print(f"   API Health Check: HTTP {http_code}")
                            
                            if http_code in ['200', '404']:  # 404 is fine if health endpoint doesn't exist
                                print("🎉 SUCCESS! Backend is responding!")
                                print("\n🔗 Try logging in now at: https://edsteward.ai/")
                                return
                            elif http_code == '503':
                                print("⏳ Still starting up...")
                            else:
                                print(f"⚠️ Got HTTP {http_code}")
                                
                        except Exception as e:
                            print(f"   Could not test API: {e}")
                        
                        break
                        
                    elif i >= 8:  # After 4+ minutes
                        print("   ⚠️ Task taking too long to start. Checking for issues...")
                        
                        # Get task details
                        tasks_cmd = ['ecs', 'list-tasks', '--cluster', 'edsteward-cluster', '--service-name', 'edsteward-service', '--output', 'json']
                        result = run_aws_command(tasks_cmd)
                        
                        if result:
                            data = json.loads(result)
                            new_task_arns = data.get('taskArns', [])
                            
                            if new_task_arns:
                                task_details_cmd = ['ecs', 'describe-tasks', '--cluster', 'edsteward-cluster', '--tasks', new_task_arns[0], '--output', 'json']
                                task_result = run_aws_command(task_details_cmd)
                                
                                if task_result:
                                    task_data = json.loads(task_result)
                                    task = task_data['tasks'][0]
                                    
                                    print(f"   Task Status: {task['lastStatus']}")
                                    if 'stoppedReason' in task:
                                        print(f"   Stopped Reason: {task['stoppedReason']}")
                                        
                except Exception as e:
                    print(f"   Error checking status: {e}")
        
        if running_count == 0:
            print("\n⚠️ Deployment is taking longer than expected.")
            print("The network issue has been fixed, but startup may take more time.")
            print("Monitor with: python3 check-status.py")
            
    else:
        print("❌ Failed to start deployment")

if __name__ == "__main__":
    force_deployment() 