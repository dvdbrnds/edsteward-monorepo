#!/usr/bin/env python3

import boto3
import json
from datetime import datetime, timedelta

def main():
    print("📋 CHECKING ALL POSSIBLE LOG GROUPS")
    print("=====================================")
    
    # Initialize AWS clients
    logs = boto3.client('logs', region_name='us-east-1')
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Get list of all log groups
    try:
        response = logs.describe_log_groups()
        log_groups = [lg['logGroupName'] for lg in response['logGroups']]
        
        print(f"📊 Found {len(log_groups)} log groups:")
        for lg in log_groups:
            print(f"   - {lg}")
        print()
        
        # Check specifically for edsteward logs
        edsteward_groups = [lg for lg in log_groups if 'edsteward' in lg.lower()]
        print(f"🎯 EdSteward-related log groups ({len(edsteward_groups)}):")
        for lg in edsteward_groups:
            print(f"   - {lg}")
        print()
        
        # Get recent tasks to find which log group they use
        print("🔍 Getting recent tasks for log group info...")
        response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service',
            maxResults=10
        )
        
        if response['taskArns']:
            task_arn = response['taskArns'][0]
            task_id = task_arn.split('/')[-1]
            print(f"📋 Most recent task: {task_id}")
            
            # Try different log groups
            log_groups_to_check = [
                '/aws/ecs/edsteward',
                '/ecs/edsteward',
                'edsteward',
                '/aws/ecs/edsteward-service'
            ]
            
            for log_group in log_groups_to_check:
                if log_group in log_groups:
                    print(f"\n🔍 Checking {log_group}...")
                    try:
                        # Get recent log streams
                        streams_response = logs.describe_log_streams(
                            logGroupName=log_group,
                            orderBy='LastEventTime',
                            descending=True,
                            limit=5
                        )
                        
                        if streams_response['logStreams']:
                            print(f"   Found {len(streams_response['logStreams'])} recent streams:")
                            for stream in streams_response['logStreams']:
                                stream_name = stream['logStreamName']
                                last_event = stream.get('lastEventTime', 0)
                                last_event_dt = datetime.fromtimestamp(last_event/1000) if last_event else 'Never'
                                print(f"   - {stream_name} (last: {last_event_dt})")
                                
                                # Get recent events from this stream
                                if last_event > 0:
                                    try:
                                        events_response = logs.get_log_events(
                                            logGroupName=log_group,
                                            logStreamName=stream_name,
                                            startTime=int((datetime.now() - timedelta(minutes=30)).timestamp() * 1000),
                                            limit=50
                                        )
                                        
                                        events = events_response['events']
                                        if events:
                                            print(f"     📋 Recent events ({len(events)}):")
                                            for event in events[-10:]:  # Last 10 events
                                                timestamp = datetime.fromtimestamp(event['timestamp']/1000)
                                                message = event['message'].strip()
                                                print(f"     {timestamp}: {message}")
                                            print()
                                        else:
                                            print(f"     ℹ️ No recent events in this stream")
                                    except Exception as e:
                                        print(f"     ❌ Error getting events: {e}")
                        else:
                            print(f"   ℹ️ No log streams found")
                    except Exception as e:
                        print(f"   ❌ Error checking {log_group}: {e}")
                else:
                    print(f"   ❌ {log_group} not found in available log groups")
        else:
            print("❌ No tasks found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 