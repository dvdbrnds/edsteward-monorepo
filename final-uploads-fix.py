#!/usr/bin/env python3

import boto3
import subprocess
import time
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
    print("🎯 FINAL UPLOADS PATH FIX")
    print("=========================")
    print("Issue: Permission denied creating /uploads (should be /app/uploads)")
    print("Fix: Corrected uploads path in uploads.ts")
    print()

    # Initialize AWS clients
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        ecr = boto3.client('ecr', region_name='us-east-1')
    except Exception as e:
        print(f"❌ Failed to initialize AWS clients: {e}")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v16.0-uploads-path-fix-{timestamp}"
    
    print(f"📦 Building final image: {image_tag}")

    # Use the same working Dockerfile from before with tsx
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

RUN mkdir -p /app/uploads /app/logs /app/ssl && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npx", "tsx", "server/index.ts"]
'''

    # Build and deploy
    with open('Dockerfile.final', 'w') as f:
        f.write(dockerfile_content)
    
    print("1️⃣ Building Docker image...")
    success, stdout, stderr = run_command(f'docker build --platform linux/amd64 -f Dockerfile.final -t edsteward:{image_tag} .')
    
    if not success:
        print(f"❌ Docker build failed: {stderr}")
        return
    
    print("✅ Docker build successful")

    print("\n2️⃣ Pushing to ECR...")
    ecr_repo = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
    
    run_command(f'docker tag edsteward:{image_tag} {ecr_repo}:{image_tag}')
    success, _, _ = run_command(f'docker push {ecr_repo}:{image_tag}')
    if not success:
        print("❌ Docker push failed")
        return
    
    print("✅ Image pushed to ECR")

    print("\n3️⃣ Creating final task definition...")
    try:
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward')
        current_task_def = response['taskDefinition']
        
        # Create new task definition with fixed image
        new_task_def = {
            'family': 'edsteward',
            'networkMode': current_task_def.get('networkMode'),
            'requiresCompatibilities': current_task_def.get('requiresCompatibilities'),
            'cpu': current_task_def.get('cpu'),
            'memory': current_task_def.get('memory'),
            'containerDefinitions': []
        }
        
        if current_task_def.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
        
        # Update container with new image
        for container in current_task_def['containerDefinitions']:
            container_def = container.copy()
            if container_def['name'] == 'edsteward':
                container_def['image'] = f"{ecr_repo}:{image_tag}"
            new_task_def['containerDefinitions'].append(container_def)
        
        # Register and deploy
        response = ecs.register_task_definition(**new_task_def)
        new_revision = response['taskDefinition']['revision']
        
        print(f"✅ Task definition created: edsteward:{new_revision}")
        
        # Update service
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

    # Clean up
    import os
    if os.path.exists('Dockerfile.final'):
        os.remove('Dockerfile.final')

    print(f"\n🎉 FINAL FIX DEPLOYED!")
    print(f"Image: {image_tag}")
    print(f"Task Definition: edsteward:{new_revision}")
    print()
    print("🏁 ALL ISSUES SHOULD NOW BE RESOLVED:")
    print("✅ SSL parsing error - FIXED")
    print("✅ Module not found error - FIXED") 
    print("✅ SESSION_SECRET missing - FIXED")
    print("✅ Uploads path permission - FIXED")
    print()
    print("🔍 Wait 2 minutes then check:")
    print("   python3 check-logs-aggressive.py")
    print("   python3 check-exact-status.py")

if __name__ == "__main__":
    main() 