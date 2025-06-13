#!/usr/bin/env python3
"""
Check latest container logs
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

def check_latest_logs():
    """Check latest container logs"""
    print("📋 CHECKING LATEST CONTAINER LOGS")
    print("=" * 50)
    
    # Get latest log stream
    print("\n📋 1. Finding latest log stream...")
    
    streams_cmd = ['logs', 'describe-log-streams', '--log-group-name', '/aws/ecs/edsteward', '--order-by', 'LastEventTime', '--descending', '--max-items', '3', '--output', 'json']
    result = run_aws_command(streams_cmd)
    
    if result:
        try:
            data = json.loads(result)
            streams = data.get('logStreams', [])
            
            print(f"   Found {len(streams)} recent log streams")
            
            for i, stream in enumerate(streams[:2]):  # Check last 2 streams
                stream_name = stream['logStreamName']
                last_event = stream.get('lastEventTime', 0)
                
                print(f"\n📋 {i+1}. Log Stream: {stream_name}")
                print(f"   Last Event: {time.ctime(last_event/1000) if last_event else 'N/A'}")
                
                # Get logs from this stream
                logs_cmd = ['logs', 'get-log-events', '--log-group-name', '/aws/ecs/edsteward', '--log-stream-name', stream_name, '--start-from-head', '--output', 'json']
                logs_result = run_aws_command(logs_cmd)
                
                if logs_result:
                    try:
                        logs_data = json.loads(logs_result)
                        events = logs_data.get('events', [])
                        
                        print(f"   📝 Log Events ({len(events)} total):")
                        
                        # Show last 20 events
                        for event in events[-20:]:
                            timestamp = time.strftime('%H:%M:%S', time.localtime(event['timestamp']/1000))
                            message = event['message'].strip()
                            print(f"   {timestamp}: {message}")
                        
                        if not events:
                            print("   (No log events found)")
                            
                    except Exception as e:
                        print(f"   Error parsing logs: {e}")
                else:
                    print("   Could not retrieve logs")
                    
        except Exception as e:
            print(f"   Error: {e}")
    else:
        print("   Could not get log streams")

if __name__ == "__main__":
    check_latest_logs() 