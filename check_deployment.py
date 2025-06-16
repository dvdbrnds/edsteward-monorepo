#!/usr/bin/env python3
import subprocess
import json
import os
import time

# Set environment variables to avoid AWS CLI pager issues
os.environ['AWS_PAGER'] = ''
os.environ['AWS_CLI_AUTO_PROMPT'] = 'off'

def run_aws_command(command, description):
    """Run an AWS CLI command and return the result"""
    try:
        print(f"\n🔧 {description}...")
        result = subprocess.run(command, capture_output=True, text=True, env=os.environ)
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                print(f"✅ {description} successful")
                return True, data
            except json.JSONDecodeError:
                print(f"✅ {description} successful (non-JSON)")
                return True, result.stdout
        else:
            print(f"❌ {description} failed: {result.stderr}")
            return False, result.stderr
    except Exception as e:
        print(f"❌ {description} error: {e}")
        return False, str(e)

def check_service_status():
    """Check ECS service status"""
    command = [
        'aws', 'ecs', 'describe-services',
        '--cluster', 'edsteward-cluster',
        '--services', 'edsteward-service',
        '--region', 'us-east-1'
    ]
    
    success, data = run_aws_command(command, "Checking service status")
    if success and isinstance(data, dict):
        service = data['services'][0]
        print(f"   Running: {service['runningCount']}/{service['desiredCount']}")
        print(f"   Status: {service['status']}")
        print(f"   Task Definition: {service['taskDefinition']}")
        
        if 'deployments' in service:
            for deployment in service['deployments']:
                print(f"   Deployment: {deployment['status']} - {deployment.get('rolloutState', 'N/A')}")
        
        return service['runningCount'] > 0
    return False

def check_tasks():
    """Check ECS tasks"""
    command = [
        'aws', 'ecs', 'list-tasks',
        '--cluster', 'edsteward-cluster',
        '--service-name', 'edsteward-service',
        '--region', 'us-east-1'
    ]
    
    success, data = run_aws_command(command, "Listing tasks")
    if success and isinstance(data, dict):
        task_arns = data.get('taskArns', [])
        print(f"   Found {len(task_arns)} tasks")
        
        if task_arns:
            # Get task details
            command = [
                'aws', 'ecs', 'describe-tasks',
                '--cluster', 'edsteward-cluster',
                '--tasks'] + task_arns + ['--region', 'us-east-1']
            
            success, task_data = run_aws_command(command, "Getting task details")
            if success and isinstance(task_data, dict):
                for task in task_data.get('tasks', []):
                    print(f"   Task: {task['lastStatus']} - {task.get('healthStatus', 'N/A')}")
                    if 'stoppedReason' in task:
                        print(f"   Stopped Reason: {task['stoppedReason']}")
        
        return len(task_arns) > 0
    return False

def get_logs():
    """Get CloudWatch logs"""
    command = [
        'aws', 'logs', 'describe-log-streams',
        '--log-group-name', '/ecs/edsteward-task',
        '--order-by', 'LastEventTime',
        '--descending',
        '--max-items', '5',
        '--region', 'us-east-1'
    ]
    
    success, data = run_aws_command(command, "Getting log streams")
    if success and isinstance(data, dict):
        streams = data.get('logStreams', [])
        if streams:
            latest_stream = streams[0]['logStreamName']
            print(f"   Latest log stream: {latest_stream}")
            
            # Get recent log events
            command = [
                'aws', 'logs', 'get-log-events',
                '--log-group-name', '/ecs/edsteward-task',
                '--log-stream-name', latest_stream,
                '--start-from-head',
                '--limit', '20',
                '--region', 'us-east-1'
            ]
            
            success, log_data = run_aws_command(command, "Getting log events")
            if success and isinstance(log_data, dict):
                events = log_data.get('events', [])
                print(f"   Recent log events ({len(events)}):")
                for event in events[-10:]:  # Last 10 events
                    timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(event['timestamp']/1000))
                    message = event['message'].strip()
                    print(f"   [{timestamp}] {message}")

def force_restart():
    """Force restart the service"""
    command = [
        'aws', 'ecs', 'update-service',
        '--cluster', 'edsteward-cluster',
        '--service', 'edsteward-service',
        '--force-new-deployment',
        '--region', 'us-east-1'
    ]
    
    success, data = run_aws_command(command, "Forcing service restart")
    return success

def main():
    print("🚀 EdSteward Deployment Status Check")
    print("=" * 50)
    
    # Check service status
    service_running = check_service_status()
    
    # Check tasks
    tasks_exist = check_tasks()
    
    # Get logs
    get_logs()
    
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    if service_running:
        print("✅ Service is running normally")
    elif tasks_exist:
        print("⚠️  Service has tasks but they may be starting/stopping")
        print("💡 Recommendation: Wait a few minutes and check again")
    else:
        print("❌ Service is not running")
        print("💡 Recommendation: Force restart the service")
        
        response = input("\nWould you like to force restart the service? (y/n): ")
        if response.lower() == 'y':
            if force_restart():
                print("✅ Service restart initiated. Wait 2-3 minutes and run test_endpoints.py again")
            else:
                print("❌ Failed to restart service")

if __name__ == "__main__":
    main() 