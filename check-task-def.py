#!/usr/bin/env python3
"""
Check task definition details - bypasses shell issues
"""
import subprocess
import json

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

def check_task_definition():
    """Check task definition details"""
    print("📋 CHECKING TASK DEFINITION DETAILS")
    print("=" * 40)
    
    # Check task definition 5 (our latest)
    print("🔍 Task Definition edsteward:5...")
    task_def_cmd = ['ecs', 'describe-task-definition', '--task-definition', 'edsteward:5', '--output', 'json']
    result = run_aws_command(task_def_cmd)
    
    if result:
        try:
            data = json.loads(result)
            task_def = data['taskDefinition']
            
            print(f"Status: {task_def['status']}")
            print(f"CPU: {task_def['cpu']}")
            print(f"Memory: {task_def['memory']}")
            print(f"Network Mode: {task_def.get('networkMode', 'N/A')}")
            print(f"Execution Role: {task_def.get('executionRoleArn', 'N/A')}")
            
            # Check container definitions in detail
            for i, container in enumerate(task_def['containerDefinitions']):
                print(f"\nContainer {i+1}: {container['name']}")
                print(f"  Image: {container['image']}")
                print(f"  Memory: {container.get('memory', 'N/A')}")
                print(f"  CPU: {container.get('cpu', 'N/A')}")
                print(f"  Essential: {container.get('essential', 'N/A')}")
                
                # Port mappings
                if 'portMappings' in container:
                    print(f"  Port Mappings: {container['portMappings']}")
                
                # Environment variables
                if 'environment' in container:
                    print(f"  Environment Variables: {len(container['environment'])} variables")
                    for env in container['environment']:
                        if 'DATABASE' in env['name']:
                            print(f"    {env['name']}: {env['value'][:50]}...")
                
                # Log configuration
                log_config = container.get('logConfiguration', {})
                if log_config:
                    print(f"  Log Driver: {log_config.get('logDriver', 'N/A')}")
                    options = log_config.get('options', {})
                    for key, value in options.items():
                        print(f"    {key}: {value}")
                else:
                    print("  ❌ No log configuration!")
                
                # Health check
                if 'healthCheck' in container:
                    health = container['healthCheck']
                    print(f"  Health Check: {health.get('command', 'N/A')}")
                
        except Exception as e:
            print(f"Error parsing task definition: {e}")
    
    # Also check if log group /ecs/edsteward exists
    print(f"\n🔍 Checking if log group /ecs/edsteward exists...")
    log_check_cmd = ['logs', 'describe-log-groups', '--log-group-name-prefix', '/ecs/edsteward', '--output', 'json']
    result = run_aws_command(log_check_cmd)
    
    if result:
        try:
            data = json.loads(result)
            log_groups = data['logGroups']
            
            for lg in log_groups:
                print(f"  Found: {lg['logGroupName']}")
                print(f"    Created: {lg.get('creationTime', 'N/A')}")
                print(f"    Retention: {lg.get('retentionInDays', 'Never')} days")
                
        except Exception as e:
            print(f"Error checking log groups: {e}")

if __name__ == "__main__":
    check_task_definition() 