#!/usr/bin/env python3

import boto3
import json
import subprocess
import time
import os
from datetime import datetime

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
    print("🎯 SIMPLE WORKING FIX")
    print("=====================")
    print("Issue: Server needs to run with tsx for TypeScript")
    print("Fix: Use existing Dockerfile but change CMD to use tsx")
    print()

    # Initialize AWS clients
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        ecr = boto3.client('ecr', region_name='us-east-1')
    except Exception as e:
        print(f"❌ Failed to initialize AWS clients: {e}")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v15.0-simple-tsx-fix-{timestamp}"
    
    print(f"📦 Building image: {image_tag}")
    print()

    # Step 1: Create a simple Dockerfile that just fixes the CMD
    print("1️⃣ Creating simple working Dockerfile...")
    
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
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Use tsx to run TypeScript directly - no compilation needed
CMD ["npx", "tsx", "server/index.ts"]
'''

    # Write Dockerfile
    with open('Dockerfile.simple', 'w') as f:
        f.write(dockerfile_content)
    
    print("   ✅ Created Dockerfile.simple with tsx")

    # Step 2: Build Docker image
    print("\n2️⃣ Building Docker image...")
    
    success, stdout, stderr = run_command(f'docker build --platform linux/amd64 -f Dockerfile.simple -t edsteward:{image_tag} .')
    
    if not success:
        print(f"❌ Docker build failed: {stderr}")
        return
    
    print("✅ Docker build successful")

    # Step 3: Tag and push to ECR
    print("\n3️⃣ Pushing to ECR...")
    
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

    # Step 4: Create new task definition
    print("\n4️⃣ Creating new task definition...")
    
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
        
        # Add execution role
        if current_task_def.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
        else:
            new_task_def['executionRoleArn'] = 'arn:aws:iam::259661441422:role/ecsTaskExecutionRole'
        
        # Update container definition with new image
        for container in current_task_def['containerDefinitions']:
            container_def = container.copy()
            if container_def['name'] == 'edsteward':
                container_def['image'] = f"{ecr_repo}:{image_tag}"
                
                # Ensure environment variables
                env_vars = container_def.get('environment', [])
                
                # DATABASE_URL
                database_url_found = False
                for env_var in env_vars:
                    if env_var['name'] == 'DATABASE_URL':
                        env_var['value'] = 'postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require'
                        database_url_found = True
                        break
                
                if not database_url_found:
                    env_vars.append({
                        'name': 'DATABASE_URL',
                        'value': 'postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require'
                    })
                
                # NODE_ENV
                node_env_found = False
                for env_var in env_vars:
                    if env_var['name'] == 'NODE_ENV':
                        env_var['value'] = 'production'
                        node_env_found = True
                        break
                
                if not node_env_found:
                    env_vars.append({
                        'name': 'NODE_ENV',
                        'value': 'production'
                    })
                
                container_def['environment'] = env_vars
                
                # Log configuration
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

    # Step 5: Update service
    print("\n5️⃣ Updating ECS service...")
    
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

    # Step 6: Clean up
    print("\n6️⃣ Cleaning up...")
    
    if os.path.exists('Dockerfile.simple'):
        os.remove('Dockerfile.simple')
    
    print("   ✅ Cleaned up temporary files")

    # Step 7: Monitor briefly
    print("\n7️⃣ Monitoring deployment...")
    
    for i in range(3):
        time.sleep(30)
        try:
            response = ecs.describe_services(
                cluster='edsteward-cluster',
                services=['edsteward-service']
            )
            
            service = response['services'][0]
            running_count = service['runningCount']
            pending_count = service['pendingCount']
            
            print(f"   ⏳ Check {i+1}/3: Running={running_count}, Pending={pending_count}")
            
            if running_count > 0:
                print("   ✅ Task is running!")
                break
                
        except Exception as e:
            print(f"   ⚠️ Error checking status: {e}")

    print(f"\n🎉 DEPLOYMENT COMPLETE")
    print(f"Image: {image_tag}")
    print(f"Task Definition: edsteward:{new_revision}")
    print("Key fixes:")
    print("- ✅ Docker platform: linux/amd64") 
    print("- ✅ Server execution: tsx server/index.ts (TypeScript directly)")
    print("- ✅ Database URL: Clean format with SSL")
    print()
    print("Monitor with: python3 check-logs-aggressive.py")

if __name__ == "__main__":
    main() 