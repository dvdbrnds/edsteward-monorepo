#!/usr/bin/env python3
"""
Check ECS CloudWatch logs - bypasses shell issues
"""
import subprocess
import json
import time
from datetime import datetime, timedelta

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

def check_logs():
    """Check recent ECS task logs"""
    print("📋 CHECKING ECS TASK LOGS - BYPASSING SHELL ISSUES")
    print("=" * 55)
    
    # Get recent log events from the last 10 minutes
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(minutes=10)
    
    start_timestamp = int(start_time.timestamp() * 1000)
    end_timestamp = int(end_time.timestamp() * 1000)
    
    log_group = '/aws/ecs/edsteward'
    
    print(f"🔍 Checking logs from {start_time.strftime('%H:%M:%S')} to {end_time.strftime('%H:%M:%S')} UTC")
    
    # Get log events
    logs_cmd = [
        'logs', 'filter-log-events',
        '--log-group-name', log_group,
        '--start-time', str(start_timestamp),
        '--end-time', str(end_timestamp),
        '--output', 'json'
    ]
    
    result = run_aws_command(logs_cmd)
    
    if not result:
        print("❌ Failed to get log events")
        return
    
    try:
        data = json.loads(result)
        events = data.get('events', [])
        
        if not events:
            print("ℹ️ No log events found in the last 10 minutes")
            print("   The task may not be starting at all, or logs are elsewhere")
            
            # Try to get recent events from any time
            print("\n🔍 Checking for any recent events (last hour)...")
            start_timestamp_hour = int((end_time - timedelta(hours=1)).timestamp() * 1000)
            
            logs_cmd_hour = [
                'logs', 'filter-log-events',
                '--log-group-name', log_group,
                '--start-time', str(start_timestamp_hour),
                '--output', 'json'
            ]
            
            result_hour = run_aws_command(logs_cmd_hour)
            if result_hour:
                data_hour = json.loads(result_hour)
                events = data_hour.get('events', [])[-10:]  # Last 10 events
                
        if events:
            print(f"\n📊 Found {len(events)} recent log events:")
            print("-" * 50)
            
            for event in events[-20:]:  # Last 20 events
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                print(f"{timestamp.strftime('%H:%M:%S')} | {message}")
                
            print("-" * 50)
            
            # Analyze for common issues
            log_text = ' '.join([e['message'] for e in events]).lower()
            
            if 'ssl' in log_text or 'enoent' in log_text:
                print("🔴 FOUND SSL/FILE ERRORS in logs!")
                print("   The database connection issue is still present.")
            elif 'error' in log_text:
                print("🟡 Found errors in logs - check the messages above")
            elif 'listening' in log_text or 'started' in log_text:
                print("🟢 Application appears to be starting successfully")
            else:
                print("ℹ️ No obvious errors in recent logs")
                
        else:
            print("❌ No log events found")
            print("   This suggests the container is not starting at all")
            print("   Possible issues:")
            print("   - Docker image issues")
            print("   - IAM permission problems")
            print("   - Resource allocation problems")
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse logs JSON: {e}")
    except Exception as e:
        print(f"❌ Error processing logs: {e}")

if __name__ == "__main__":
    check_logs() 