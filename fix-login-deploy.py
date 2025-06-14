#!/usr/bin/env python3
import boto3
import subprocess
import json
from datetime import datetime

def fix_login_deploy():
    print("🚀 FIXING LOGIN ISSUE - CLEAN BUILD AND DEPLOY")
    print("The login issue is caused by application not starting due to wrong CMD")
    print("Building with simple Dockerfile and correct entry point")
    print("=" * 60)
    
    # Build new image
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v15.0-login-fix-{timestamp}"
    
    print(f"📦 Building image: {image_tag}")
    
    # Build and tag
    result = subprocess.run([
        'docker', 'build', 
        '--platform', 'linux/amd64',
        '-f', 'Dockerfile.simple',
        '-t', f'edsteward:{image_tag}', 
        '.'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ Docker build failed: {result.stderr}")
        return
    
    print("✅ Docker build successful")
    
    # Get ECR login
    ecr = boto3.client('ecr', region_name='us-east-1')
    
    try:
        token_response = ecr.get_authorization_token()
        token = token_response['authorizationData'][0]['authorizationToken']
        endpoint = token_response['authorizationData'][0]['proxyEndpoint']
        
        # Docker login to ECR
        import base64
        username, password = base64.b64decode(token).decode().split(':')
        
        subprocess.run([
            'docker', 'login', '--username', username, '--password', password, endpoint
        ], check=True, capture_output=True)
        
        print("✅ ECR login successful")
        
    except Exception as e:
        print(f"❌ ECR login failed: {e}")
        return
    
    # Tag and push
    ecr_repo = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
    full_image_name = f"{ecr_repo}:{image_tag}"
    
    subprocess.run(['docker', 'tag', f'edsteward:{image_tag}', full_image_name], check=True)
    
    result = subprocess.run(['docker', 'push', full_image_name], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ Docker push failed: {result.stderr}")
        return
    
    print("✅ Image pushed to ECR")
    
    # Create new task definition
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    task_definition = {
        "family": "edsteward",
        "networkMode": "awsvpc", 
        "requiresCompatibilities": ["FARGATE"],
        "cpu": "256",
        "memory": "512",
        "executionRoleArn": "arn:aws:iam::259661441422:role/ecsTaskExecutionRole",
        "containerDefinitions": [
            {
                "name": "edsteward",
                "image": full_image_name,
                "essential": True,
                "portMappings": [
                    {
                        "containerPort": 3000,
                        "protocol": "tcp"
                    }
                ],
                "environment": [
                    {
                        "name": "NODE_ENV",
                        "value": "production"
                    },
                    {
                        "name": "DATABASE_URL", 
                        "value": "postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require"
                    },
                    {
                        "name": "SESSION_SECRET",
                        "value": "FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s="
                    }
                ],
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group": "/aws/ecs/edsteward",
                        "awslogs-region": "us-east-1",
                        "awslogs-stream-prefix": "ecs"
                    }
                }
            }
        ]
    }
    
    print("📋 Registering new task definition...")
    response = ecs.register_task_definition(**task_definition)
    new_revision = response['taskDefinition']['revision']
    
    print(f"✅ Created task definition: edsteward:{new_revision}")
    
    # Update service
    print("📋 Updating service...")
    ecs.update_service(
        cluster='edsteward-cluster',
        service='edsteward-service',
        taskDefinition=f"edsteward:{new_revision}",
        forceNewDeployment=True
    )
    
    print("✅ Service updated!")
    print("⏳ Waiting for deployment...")
    
    # Wait and monitor
    import time
    for i in range(18):  # 18 * 10 = 3 minutes
        time.sleep(10)
        
        response = ecs.describe_services(
            cluster='edsteward-cluster',
            services=['edsteward-service']
        )
        
        service = response['services'][0]
        running_count = service['runningCount']
        
        print(f"   Status check {i+1}/18: Running={running_count}")
        
        if running_count > 0:
            print("🎉 Task is running!")
            break
    
    if running_count > 0:
        print("\n🧪 Testing login endpoint...")
        print("If this works, your login issue should be resolved!")
        
        # Test with curl
        result = subprocess.run([
            'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
            'https://edsteward.ai/api/user'
        ], capture_output=True, text=True)
        
        if result.stdout.strip() == '401':
            print("✅ API responding with 401 (expected for unauthenticated request)")
            print("🎉 LOGIN FUNCTIONALITY SHOULD NOW WORK!")
            print("\nNext steps:")
            print("1. Go to https://edsteward.ai")
            print("2. Try logging in or registering")
            print("3. The session management should now work properly")
        else:
            print(f"⚠️ API returned: {result.stdout.strip()}")
    else:
        print("❌ Task failed to start - check logs")

if __name__ == "__main__":
    fix_login_deploy() 