#!/usr/bin/env python3

import boto3
import json
import time
from datetime import datetime, timedelta

def log(message: str, level: str = "INFO"):
    """Log messages with timestamp"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    colors = {
        "SUCCESS": "\033[92m✅",
        "ERROR": "\033[91m❌",
        "WARNING": "\033[93m⚠️",
        "INFO": "\033[94mℹ️"
    }
    reset = "\033[0m"
    
    formatted_msg = f"{colors.get(level, colors['INFO'])} [{timestamp}] {message}{reset}"
    print(formatted_msg)

def get_current_task_definition():
    """Get the current task definition being used"""
    log("🔍 Getting current task definition from ECS...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Get service details
        service_response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = service_response['services'][0]
        deployments = service['deployments']
        
        # Find the primary deployment
        primary_deployment = None
        for deployment in deployments:
            if deployment['status'] == 'PRIMARY':
                primary_deployment = deployment
                break
        
        if not primary_deployment:
            log("No primary deployment found", "ERROR")
            return None
        
        task_def_arn = primary_deployment['taskDefinition']
        task_def_name = task_def_arn.split('/')[-1]
        
        log(f"📋 Current task definition: {task_def_name}")
        
        # Get task definition details
        task_def_response = ecs.describe_task_definition(taskDefinition=task_def_arn)
        task_def = task_def_response['taskDefinition']
        
        return task_def
        
    except Exception as e:
        log(f"Failed to get task definition: {e}", "ERROR")
        return None

def get_current_database_config(task_def):
    """Extract database configuration from task definition"""
    log("🔍 Extracting database configuration...")
    
    try:
        container = task_def['containerDefinitions'][0]
        env_vars = container.get('environment', [])
        
        db_config = {}
        
        for env_var in env_vars:
            name = env_var['name']
            value = env_var['value']
            
            if any(keyword in name.upper() for keyword in ['DATABASE', 'DB_', 'POSTGRES', 'SSL']):
                if 'PASSWORD' in name.upper() and len(value) > 10:
                    # Mask password but show first few chars
                    masked_value = value[:8] + '*' * (len(value) - 8)
                    db_config[name] = masked_value
                else:
                    db_config[name] = value
        
        log("📋 Current Database Configuration:")
        for key, value in db_config.items():
            log(f"   {key}: {value}")
        
        # Extract database URL components
        database_url = None
        for env_var in env_vars:
            if env_var['name'] == 'DATABASE_URL':
                database_url = env_var['value']
                break
        
        if database_url:
            log("🔗 Parsing DATABASE_URL...")
            if 'postgresql://' in database_url:
                # Extract host from URL
                try:
                    import re
                    host_match = re.search(r'@([^:]+):', database_url)
                    if host_match:
                        host = host_match.group(1)
                        log(f"🏠 Database Host: {host}")
                        return host, database_url
                except Exception as e:
                    log(f"Failed to parse DATABASE_URL: {e}", "WARNING")
        
        return None, database_url
        
    except Exception as e:
        log(f"Failed to extract database config: {e}", "ERROR")
        return None, None

def get_recent_logs():
    """Get recent CloudWatch logs from the application"""
    log("📋 Getting recent CloudWatch logs...")
    
    try:
        logs_client = boto3.client('logs', region_name='us-east-1')
        
        # Get log groups
        log_groups = [
            '/ecs/edsteward',
            '/aws/ecs/edsteward',
            '/aws/ecs/containerinsights/edsteward-cluster/performance'
        ]
        
        # Time range: last 30 minutes
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=30)
        
        end_timestamp = int(end_time.timestamp() * 1000)
        start_timestamp = int(start_time.timestamp() * 1000)
        
        all_logs = []
        
        for log_group in log_groups:
            try:
                log(f"🔍 Checking log group: {log_group}")
                
                # Get log streams
                streams_response = logs_client.describe_log_streams(
                    logGroupName=log_group,
                    orderBy='LastEventTime',
                    descending=True,
                    limit=5
                )
                
                for stream in streams_response['logStreams']:
                    stream_name = stream['logStreamName']
                    
                    if 'lastEventTime' in stream:
                        last_event = datetime.fromtimestamp(stream['lastEventTime'] / 1000)
                        log(f"   📝 Stream: {stream_name} (last: {last_event})")
                        
                        # Get log events
                        try:
                            events_response = logs_client.get_log_events(
                                logGroupName=log_group,
                                logStreamName=stream_name,
                                startTime=start_timestamp,
                                endTime=end_timestamp,
                                limit=50
                            )
                            
                            for event in events_response['events']:
                                message = event['message'].strip()
                                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                                
                                # Look for database-related messages
                                if any(keyword in message.lower() for keyword in [
                                    'database', 'postgresql', 'postgres', 'connection', 
                                    'ssl', 'rds', 'edsteward-db', 'edsteward-postgres'
                                ]):
                                    all_logs.append({
                                        'timestamp': timestamp,
                                        'log_group': log_group,
                                        'stream': stream_name,
                                        'message': message
                                    })
                        
                        except Exception as e:
                            log(f"   Failed to get events from {stream_name}: {e}", "WARNING")
                
            except Exception as e:
                log(f"Failed to check log group {log_group}: {e}", "WARNING")
        
        # Sort logs by timestamp
        all_logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        if all_logs:
            log(f"📋 Found {len(all_logs)} database-related log entries:")
            for entry in all_logs[:20]:  # Show last 20
                log(f"   [{entry['timestamp']}] {entry['message'][:200]}")
        else:
            log("No recent database-related logs found", "WARNING")
        
        return all_logs
        
    except Exception as e:
        log(f"Failed to get CloudWatch logs: {e}", "ERROR")
        return []

def check_current_tasks():
    """Check current running tasks and their details"""
    log("🔍 Checking current running ECS tasks...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # List current tasks
        tasks_response = ecs.list_tasks(cluster='edsteward-cluster')
        task_arns = tasks_response['taskArns']
        
        if not task_arns:
            log("No tasks currently running", "WARNING")
            return
        
        # Get task details
        tasks_detail = ecs.describe_tasks(
            cluster='edsteward-cluster',
            tasks=task_arns
        )
        
        for task in tasks_detail['tasks']:
            task_id = task['taskArn'].split('/')[-1][:8]
            status = task['lastStatus']
            task_def = task['taskDefinitionArn'].split('/')[-1]
            
            log(f"📋 Task {task_id}: {status} (def: {task_def})")
            
            # Check for specific task logs
            if status == 'RUNNING':
                log(f"   ✅ Task {task_id} is running - this is our live application")
                
                # Try to get logs for this specific task
                try:
                    # The log stream name typically includes the task ID
                    log(f"   🔍 Looking for logs from task {task_id}")
                except Exception as e:
                    log(f"   Failed to get task-specific logs: {e}", "WARNING")
        
    except Exception as e:
        log(f"Failed to check current tasks: {e}", "ERROR")

def main():
    log("🎯 Checking Live AWS Configuration and Logs")
    log("=" * 60)
    
    # Step 1: Get current task definition
    task_def = get_current_task_definition()
    if not task_def:
        log("Cannot proceed without task definition", "ERROR")
        return
    
    print()
    
    # Step 2: Extract database configuration
    db_host, db_url = get_current_database_config(task_def)
    
    print()
    
    # Step 3: Check current running tasks
    check_current_tasks()
    
    print()
    
    # Step 4: Get recent logs
    recent_logs = get_recent_logs()
    
    print()
    
    # Summary
    log("=" * 60)
    log("🎯 LIVE CONFIGURATION SUMMARY")
    log("=" * 60)
    
    if db_host:
        log(f"🏠 Database Host: {db_host}", "SUCCESS")
        log(f"🔗 Full URL: {db_url[:50]}...", "SUCCESS")
    else:
        log("❌ Could not determine database host", "ERROR")
    
    if recent_logs:
        log(f"📋 Found {len(recent_logs)} recent database log entries", "SUCCESS")
    else:
        log("⚠️ No recent database logs found", "WARNING")

if __name__ == "__main__":
    main()