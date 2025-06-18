#!/usr/bin/env python3
import boto3
import time
from datetime import datetime, timedelta

def main():
    print("📊 MONITORING DATABASE CREATION")
    print("Watching for table creation and deployment progress...")
    print("=" * 50)
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    logs = boto3.client('logs', region_name='us-east-1')
    
    # Monitor for 5 minutes
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=5)
    
    print(f"🕐 Monitoring from {start_time.strftime('%H:%M:%S')} to {end_time.strftime('%H:%M:%S')}")
    
    table_created = False
    admin_created = False
    
    while datetime.now() < end_time:
        print(f"\n⏰ {datetime.now().strftime('%H:%M:%S')} - Checking status...")
        
        # Check deployment status
        check_deployment_status(ecs)
        
        # Check for table creation in logs
        if not table_created:
            table_created = check_table_creation(logs)
        
        # Check for admin user creation
        if not admin_created:
            admin_created = check_admin_creation(logs)
        
        # If both are done, we can stop early
        if table_created and admin_created:
            print("\n🎉 SUCCESS! Database setup completed!")
            break
        
        # Wait 30 seconds before next check
        time.sleep(30)
    
    # Final summary
    print(f"\n📋 FINAL STATUS:")
    print(f"   Tables Created: {'✅ Yes' if table_created else '❌ No'}")
    print(f"   Admin User Created: {'✅ Yes' if admin_created else '❌ No'}")
    
    if table_created and admin_created:
        print(f"\n🎉 LOGIN READY!")
        print(f"   URL: https://edsteward.ai")
        print(f"   Username: admin")
        print(f"   Password: admin123")
    else:
        print(f"\n⚠️ Setup may still be in progress...")
        print(f"   Check logs manually: aws logs filter-log-events --log-group-name /aws/ecs/edsteward")

def check_deployment_status(ecs):
    try:
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        running_count = service['runningCount']
        desired_count = service['desiredCount']
        task_definition = service['taskDefinition']
        
        print(f"   📦 Service: {running_count}/{desired_count} running, using {task_definition}")
        
        # Get task details
        tasks_response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service',
            desiredStatus='RUNNING'
        )
        
        if tasks_response['taskArns']:
            task_arn = tasks_response['taskArns'][0]
            task_id = task_arn.split('/')[-1]
            print(f"   🏃 Active task: {task_id}")
        
    except Exception as e:
        print(f"   ❌ Error checking deployment: {e}")

def check_table_creation(logs):
    try:
        # Check last 2 minutes for table creation
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=2)
        
        start_timestamp = int(start_time.timestamp() * 1000)
        end_timestamp = int(end_time.timestamp() * 1000)
        
        response = logs.filter_log_events(
            logGroupName='/aws/ecs/edsteward',
            startTime=start_timestamp,
            endTime=end_timestamp,
            filterPattern='CREATE TABLE'
        )
        
        events = response.get('events', [])
        
        if events:
            print(f"   ✅ Table creation detected! ({len(events)} events)")
            for event in events[-2:]:  # Show last 2 events
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                print(f"      {timestamp.strftime('%H:%M:%S')}: {message}")
            return True
        else:
            print(f"   📝 No table creation events yet...")
            return False
            
    except Exception as e:
        print(f"   ❌ Error checking table creation: {e}")
        return False

def check_admin_creation(logs):
    try:
        # Check last 2 minutes for admin user creation
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=2)
        
        start_timestamp = int(start_time.timestamp() * 1000)
        end_timestamp = int(end_time.timestamp() * 1000)
        
        response = logs.filter_log_events(
            logGroupName='/aws/ecs/edsteward',
            startTime=start_timestamp,
            endTime=end_timestamp,
            filterPattern='admin OR Admin user'
        )
        
        events = response.get('events', [])
        
        admin_events = [e for e in events if 'admin' in e['message'].lower() and ('created' in e['message'].lower() or 'insert' in e['message'].lower())]
        
        if admin_events:
            print(f"   ✅ Admin user creation detected!")
            for event in admin_events[-1:]:  # Show last event
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                print(f"      {timestamp.strftime('%H:%M:%S')}: {message}")
            return True
        else:
            print(f"   📝 No admin user creation events yet...")
            return False
            
    except Exception as e:
        print(f"   ❌ Error checking admin creation: {e}")
        return False

if __name__ == "__main__":
    main() 