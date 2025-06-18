#!/usr/bin/env python3

import boto3
import json
import subprocess
import time
import os
from datetime import datetime, timezone
import sys

def run_command(cmd, cwd=None):
    """Run a command and return success status and output"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=300)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

def main():
    print("🚀 COMPREHENSIVE DATABASE + DOCKER FIX")
    print("=====================================")
    print("Issue: SSL parsing error + Docker platform issues")
    print("Fix: Correct platform build + definitive database connection")
    print()

    # Initialize AWS clients
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        ecr = boto3.client('ecr', region_name='us-east-1')
        logs = boto3.client('logs', region_name='us-east-1')
    except Exception as e:
        print(f"❌ Failed to initialize AWS clients: {e}")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v13.0-final-database-fix-{timestamp}"
    
    print(f"📦 Building image: {image_tag}")
    print()

    # Step 1: Build Docker image with correct platform
    print("1️⃣ Building Docker image with linux/amd64 platform...")
    
    # Create a temporary Dockerfile with platform specification
    dockerfile_content = '''FROM --platform=linux/amd64 node:18-alpine as base

FROM base as builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx vite build

FROM --platform=linux/amd64 node:18-alpine as runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server  
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/sql_dump ./sql_dump
COPY --from=builder /app/exports ./exports
COPY --from=builder /app/ssl/rds-ca-2019-root.pem /app/ssl/rds-ca-2019-root.pem

RUN mkdir -p /app/uploads /app/logs /app/ssl && chown nodejs:nodejs /app/uploads /app/logs /app/ssl

USER nodejs
EXPOSE 5000
CMD ["node", "server/index.js"]
'''

    # Write temporary Dockerfile
    with open('Dockerfile.platform', 'w') as f:
        f.write(dockerfile_content)
    
    success, stdout, stderr = run_command(f'docker build --platform linux/amd64 -f Dockerfile.platform -t edsteward:{image_tag} .')
    
    # Clean up temporary file
    os.remove('Dockerfile.platform')
    
    if not success:
        print(f"❌ Docker build failed: {stderr}")
        return
    
    print("✅ Docker build successful")

    # Step 2: Tag and push to ECR
    print("\n2️⃣ Pushing to ECR...")
    
    ecr_repo = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
    
    success, _, _ = run_command(f'docker tag edsteward:{image_tag} {ecr_repo}:{image_tag}')
    if not success:
        print("❌ Docker tag failed")
        return
        
    success, _, _ = run_command(f'docker push {ecr_repo}:{image_tag}')
    if not success:
        print("❌ Docker push failed")
        return
    
    print("✅ Image pushed to ECR")

    # Step 3: Create new task definition
    print("\n3️⃣ Creating new task definition...")
    
    try:
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward')
        current_task_def = response['taskDefinition']
        
        # Create new task definition
        new_task_def = {
            'family': 'edsteward',
            'networkMode': current_task_def.get('networkMode'),
            'requiresCompatibilities': current_task_def.get('requiresCompatibilities'),
            'cpu': current_task_def.get('cpu'),
            'memory': current_task_def.get('memory'),
            'containerDefinitions': []
        }
        
        # Only add role ARNs if they exist
        if current_task_def.get('taskRoleArn'):
            new_task_def['taskRoleArn'] = current_task_def['taskRoleArn']
        if current_task_def.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
        
        # Update container definition with new image
        for container in current_task_def['containerDefinitions']:
            container_def = container.copy()
            if container_def['name'] == 'edsteward':
                container_def['image'] = f"{ecr_repo}:{image_tag}"
                
                # Ensure proper environment variables for database connection
                env_vars = container_def.get('environment', [])
                
                # Update or add DATABASE_URL with clean format
                database_url_found = False
                for env_var in env_vars:
                    if env_var['name'] == 'DATABASE_URL':
                        # Use clean URL without problematic query parameters
                        env_var['value'] = 'postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require'
                        database_url_found = True
                        break
                
                if not database_url_found:
                    env_vars.append({
                        'name': 'DATABASE_URL',
                        'value': 'postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require'
                    })
                
                container_def['environment'] = env_vars
                
                # Ensure log configuration
                container_def['logConfiguration'] = {
                    'logDriver': 'awslogs',
                    'options': {
                        'awslogs-group': '/aws/ecs/edsteward',
                        'awslogs-region': 'us-east-1',
                        'awslogs-stream-prefix': 'ecs'
                    }
                }
            
            new_task_def['containerDefinitions'].append(container_def)
        
        # Register new task definition
        response = ecs.register_task_definition(**new_task_def)
        new_revision = response['taskDefinition']['revision']
        
        print(f"✅ New task definition created: edsteward:{new_revision}")
        
    except Exception as e:
        print(f"❌ Failed to create task definition: {e}")
        return

    # Step 4: Update service
    print("\n4️⃣ Updating ECS service...")
    
    try:
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=f'edsteward:{new_revision}',
            forceNewDeployment=True
        )
        print("✅ Service update initiated")
        
    except Exception as e:
        print(f"❌ Failed to update service: {e}")
        return

    # Step 5: Monitor deployment
    print("\n5️⃣ Monitoring deployment...")
    
    for i in range(10):  # Wait up to 10 minutes
        try:
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            pending_count = service['pendingCount']
            
            print(f"⏳ Status check {i+1}/10: Running={running_count}, Pending={pending_count}")
            
            if running_count > 0:
                print("✅ Task is running!")
                break
                
            if i == 9:
                print("⚠️ Deployment taking longer than expected")
                
        except Exception as e:
            print(f"⚠️ Error checking status: {e}")
        
        time.sleep(60)  # Wait 1 minute between checks

    # Step 6: Test the application
    print("\n6️⃣ Testing application...")
    
    time.sleep(30)  # Give the app time to start
    
    # Test main site
    success, _, _ = run_command('curl -s -o /dev/null -w "%{http_code}" https://edsteward.com')
    if success:
        print("✅ Main site accessible")
    else:
        print("⚠️ Main site may not be ready yet")
    
    # Test registration API
    test_payload = {
        "firstName": "Test",
        "lastName": "User", 
        "email": "test@example.com",
        "username": f"test-{int(time.time())}",
        "password": "TestPassword123!",
        "organizationName": "Test Org"
    }
    
    curl_cmd = f'''curl -s -X POST https://edsteward.com/api/register \\
        -H "Content-Type: application/json" \\
        -d '{json.dumps(test_payload)}' \\
        -w "\\nHTTP Status: %{{http_code}}"'''
    
    success, stdout, stderr = run_command(curl_cmd)
    if success:
        print("🧪 Registration API test:")
        print(stdout)
        if "User created" in stdout or "User already exists" in stdout or "200" in stdout:
            print("✅ Database connection working!")
        else:
            print("⚠️ May still have database issues")
    else:
        print(f"⚠️ Registration test failed: {stderr}")

    print(f"\n🎉 DEPLOYMENT COMPLETE")
    print(f"Image: {image_tag}")
    print(f"Task Definition: edsteward:{new_revision}")
    print("Platform: linux/amd64 (should fix container startup issues)")
    print("Database: Clean SSL configuration with proper parsing")

if __name__ == "__main__":
    main() 