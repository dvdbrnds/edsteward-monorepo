#!/usr/bin/env python3

import boto3
import json
from datetime import datetime, timedelta

def main():
    print("🔍 AGGRESSIVE LOG CHECKING - ALL STREAMS")
    print("========================================")
    
    # Initialize AWS clients
    logs = boto3.client('logs', region_name='us-east-1')
    
    try:
        log_group = '/aws/ecs/edsteward'
        
        # Get ALL log streams, not just recent ones
        print(f"📋 Getting all streams from {log_group}...")
        
        paginator = logs.get_paginator('describe_log_streams')
        all_streams = []
        
        for page in paginator.paginate(
            logGroupName=log_group,
            orderBy='LastEventTime',
            descending=True
        ):
            all_streams.extend(page['logStreams'])
        
        print(f"   Found {len(all_streams)} total streams")
        print()
        
        # Check recent streams for any logs
        recent_streams = all_streams[:10]  # Last 10 streams
        
        for i, stream in enumerate(recent_streams):
            stream_name = stream['logStreamName']
            creation_time = datetime.fromtimestamp(stream['creationTime']/1000)
            last_event_time = stream.get('lastEventTime', 0)
            
            if last_event_time:
                last_event_dt = datetime.fromtimestamp(last_event_time/1000)
            else:
                last_event_dt = "Never"
            
            print(f"📋 Stream {i+1}: {stream_name}")
            print(f"   Created: {creation_time}")
            print(f"   Last Event: {last_event_dt}")
            
            # Try to get events regardless of last event time
            try:
                # Look for events in the last 2 hours
                start_time = int((datetime.now() - timedelta(hours=2)).timestamp() * 1000)
                
                events_response = logs.get_log_events(
                    logGroupName=log_group,
                    logStreamName=stream_name,
                    startTime=start_time,
                    limit=100
                )
                
                events = events_response['events']
                
                if events:
                    print(f"   📊 Found {len(events)} events:")
                    for event in events[-20:]:  # Last 20 events
                        timestamp = datetime.fromtimestamp(event['timestamp']/1000)
                        message = event['message'].strip()
                        print(f"     {timestamp}: {message}")
                else:
                    print(f"   ℹ️ No events found in last 2 hours")
                    
            except Exception as e:
                print(f"   ❌ Error getting events: {e}")
            
            print("   " + "="*60)
            print()
            
            # Only check first few streams to avoid overwhelming output
            if i >= 4:
                break
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 