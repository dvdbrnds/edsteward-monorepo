#!/usr/bin/env python3
"""
Fix Docker platform issue and deploy
"""
import subprocess
import json
import time
import os

def run_command(cmd, cwd=None):
    """Run command and return result"""
    try:
        print(f"Running: {cmd}")
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return False, result.stderr
        return True, result.stdout
    except Exception as e:
        print(f"Exception: {e}")
        return False, str(e)

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
            print(f"AWS Error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"AWS Exception: {e}")
        return None

def fix_docker_platform():
    """Build correct Docker image and deploy"""
    print("🔧 FIXING DOCKER PLATFORM ISSUE")
    print("=" * 50)
    
    # Set up
    timestamp = int(time.time())
    image_tag = f"platform-fix-{timestamp}"
    ecr_repo = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
    
    print(f"📦 Building image: {image_tag}")
    
    # 1. Build with correct platform
    print("\n📋 Step 1: Building Docker image for linux/amd64...")
    
    build_cmd = f"docker buildx build --platform linux/amd64 -t edsteward:{image_tag} . --load"
    success, output = run_command(build_cmd)
    
    if not success:
        print("❌ Docker build failed")
        return
    
    print("✅ Docker build successful")
    
    # 2. Get ECR login
    print("\n📋 Step 2: Logging into ECR...")
    
    login_cmd = f"aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin {ecr_repo.split('/')[0]}"
    success, output = run_command(login_cmd)
    
    if not success:
        print("❌ ECR login failed")
        return
    
    print("✅ ECR login successful")
    
    # 3. Tag and push
    print("\n📋 Step 3: Pushing to ECR...")
    
    tag_cmd = f"docker tag edsteward:{image_tag} {ecr_repo}:{image_tag}"
    success, output = run_command(tag_cmd)
    
    if not success:
        print("❌ Docker tag failed")
        return
    
    push_cmd = f"docker push {ecr_repo}:{image_tag}"
    success, output = run_command(push_cmd)
    
    if not success:
        print("❌ Docker push failed")
        return
    
    print("✅ Image pushed to ECR")
    
    # 4. Create new task definition
    print("\n📋 Step 4: Creating new task definition...")
    
    # Get current task definition
    task_def_cmd = ['ecs', 'describe-task-definition', '--task-definition', 'edsteward:17', '--output', 'json']
    result = run_aws_command(task_def_cmd)
    
    if not result:
        print("❌ Failed to get current task definition")
        return
    
    try:
        data = json.loads(result)
        task_def = data['taskDefinition']
        
        # Create new task definition
        new_task_def = {
            "family": task_def['family'],
            "networkMode": task_def['networkMode'],
            "requiresCompatibilities": task_def['requiresCompatibilities'],
            "cpu": task_def['cpu'],
            "memory": task_def['memory'],
            "executionRoleArn": task_def['executionRoleArn'],
            "containerDefinitions": []
        }
        
        # Add task role if exists
        if 'taskRoleArn' in task_def:
            new_task_def['taskRoleArn'] = task_def['taskRoleArn']
        
        # Update container with new image
        for container in task_def['containerDefinitions']:
            new_container = container.copy()
            if new_container['name'] == 'edsteward':
                new_container['image'] = f"{ecr_repo}:{image_tag}"
                
                # Ensure log configuration
                new_container['logConfiguration'] = {
                    'logDriver': 'awslogs',
                    'options': {
                        'awslogs-group': '/aws/ecs/edsteward',
                        'awslogs-region': 'us-east-1',
                        'awslogs-stream-prefix': 'ecs'
                    }
                }
            
            new_task_def['containerDefinitions'].append(new_container)
        
        # Write task definition to file
        with open('/tmp/new-task-def.json', 'w') as f:
            json.dump(new_task_def, f, indent=2)
        
        # Register new task definition
        register_cmd = ['ecs', 'register-task-definition', '--cli-input-json', 'file:///tmp/new-task-def.json', '--output', 'json']
        result = run_aws_command(register_cmd)
        
        if result:
            data = json.loads(result)
            new_revision = data['taskDefinition']['revision']
            print(f"✅ New task definition created: edsteward:{new_revision}")
            
            # 5. Update service
            print("\n📋 Step 5: Updating ECS service...")
            
            update_cmd = [
                'ecs', 'update-service',
                '--cluster', 'edsteward-cluster', 
                '--service', 'edsteward-service',
                '--task-definition', f'edsteward:{new_revision}',
                '--desired-count', '1',
                '--force-new-deployment'
            ]
            
            result = run_aws_command(update_cmd)
            
            if result:
                print("✅ Service updated!")
                
                # 6. Monitor deployment
                print("\n📋 Step 6: Monitoring deployment...")
                
                for i in range(8):  # 4 minutes max
                    time.sleep(30)
                    
                    status_cmd = ['ecs', 'describe-services', '--cluster', 'edsteward-cluster', '--services', 'edsteward-service', '--output', 'json']
                    result = run_aws_command(status_cmd)
                    
                    if result:
                        try:
                            data = json.loads(result)
                            service = data['services'][0]
                            running_count = service['runningCount']
                            
                            print(f"   ⏳ Check {i+1}/8: Running tasks = {running_count}")
                            
                            if running_count > 0:
                                print("🎉 SUCCESS! Container is running!")
                                
                                # Test the application
                                print("\n📋 Step 7: Testing application...")
                                time.sleep(10)  # Give it a moment to start
                                
                                try:
                                    test_result = subprocess.run(
                                        ['curl', '-s', '-w', '%{http_code}', 'https://edsteward.ai/', '--max-time', '10'],
                                        capture_output=True,
                                        text=True,
                                        timeout=15
                                    )
                                    
                                    http_code = test_result.stdout[-3:]
                                    print(f"   Website response: HTTP {http_code}")
                                    
                                    if http_code == '200':
                                        print("🎉 PERFECT! Website is working!")
                                        print("🔗 Try logging in at: https://edsteward.ai/")
                                    elif http_code in ['503', '502']:
                                        print("⏳ Still starting up. Try again in 1-2 minutes.")
                                    else:
                                        print("⚠️ Getting response, may still be initializing")
                                        
                                except Exception as e:
                                    print(f"   Test failed: {e}")
                                
                                return
                                
                        except Exception as e:
                            print(f"   Error checking status: {e}")
                
                print("⚠️ Deployment taking longer than expected")
                print("Monitor with: python3 check-status.py")
                
            else:
                print("❌ Failed to update service")
                
        else:
            print("❌ Failed to register task definition")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_docker_platform() 