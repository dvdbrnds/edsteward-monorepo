#!/usr/bin/env python3

import subprocess
import json

def run_cmd(command):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    print("🔍 Getting ECS Task Logs...")
    
    # Get log streams
    success, output, _ = run_cmd('aws logs describe-log-streams --log-group-name /ecs/edsteward --log-stream-name-prefix db-restore --output json')
    
    if success:
        data = json.loads(output)
        
        for stream in data['logStreams']:
            stream_name = stream['logStreamName']
            print(f"\n📋 Log Stream: {stream_name}")
            
            # Get log events
            success, log_output, _ = run_cmd(f'aws logs get-log-events --log-group-name /ecs/edsteward --log-stream-name "{stream_name}" --output json')
            
            if success:
                log_data = json.loads(log_output)
                
                print("📝 Log Events:")
                for event in log_data['events']:
                    timestamp = event['timestamp']
                    message = event['message']
                    print(f"   {message}")
            else:
                print("❌ Failed to get log events")
    else:
        print("❌ Failed to get log streams")

if __name__ == "__main__":
    main() 