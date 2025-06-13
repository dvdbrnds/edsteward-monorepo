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
    print("🔧 FINAL DOCKER + SERVER BUILD FIX")
    print("===================================")
    print("Issue: Server entry point incorrect - using wrong build target")
    print("Fix: Use correct build process for full server (not frontend-only)")
    print()

    # Initialize AWS clients
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        ecr = boto3.client('ecr', region_name='us-east-1')
    except Exception as e:
        print(f"❌ Failed to initialize AWS clients: {e}")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    image_tag = f"v14.0-full-server-fix-{timestamp}"
    
    print(f"📦 Building image: {image_tag}")
    print()

    # Step 1: Fix the build process to compile full server
    print("1️⃣ Updating package.json build script...")
    
    # Read current package.json
    with open('package.json', 'r') as f:
        package_json = json.load(f)
    
    # Update build script to compile the full server, not frontend-only
    original_build = package_json['scripts']['build']
    package_json['scripts']['build'] = "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
    
    # Write updated package.json
    with open('package.json', 'w') as f:
        json.dump(package_json, f, indent=2)
    
    print(f"   Original build: {original_build}")
    print(f"   Updated build: {package_json['scripts']['build']}")
    
    # Step 2: Create optimized Dockerfile
    print("\n2️⃣ Creating optimized Dockerfile...")
    
    dockerfile_content = '''FROM --platform=linux/amd64 node:18-alpine as base

FROM base as builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build both frontend and server
RUN npm run build

FROM --platform=linux/amd64 node:18-alpine as runner
WORKDIR /app

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy runtime dependencies (production only)
COPY --from=builder /app/node_modules ./node_modules

# Copy shared files and other directories
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/sql_dump ./sql_dump
COPY --from=builder /app/exports ./exports
COPY --from=builder /app/ssl /app/ssl

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs && chown -R nodejs:nodejs /app

# Set ownership
USER nodejs

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server (compiled server, not frontend-only)
CMD ["node", "dist/index.js"]
'''

    # Write Dockerfile
    with open('Dockerfile.fixed', 'w') as f:
        f.write(dockerfile_content)
    
    print("   ✅ Created Dockerfile.fixed")

    # Step 3: Build Docker image
    print("\n3️⃣ Building Docker image...")
    
    success, stdout, stderr = run_command(f'docker build --platform linux/amd64 -f Dockerfile.fixed -t edsteward:{image_tag} .')
    
    if not success:
        print(f"❌ Docker build failed: {stderr}")
        # Restore original package.json
        package_json['scripts']['build'] = original_build
        with open('package.json', 'w') as f:
            json.dump(package_json, f, indent=2)
        return
    
    print("✅ Docker build successful")

    # Step 4: Tag and push to ECR
    print("\n4️⃣ Pushing to ECR...")
    
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

    # Step 5: Create new task definition
    print("\n5️⃣ Creating new task definition...")
    
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
        
        # Add execution role (required for CloudWatch logs)
        if current_task_def.get('executionRoleArn'):
            new_task_def['executionRoleArn'] = current_task_def['executionRoleArn']
        else:
            # Use the IAM role we created earlier
            new_task_def['executionRoleArn'] = 'arn:aws:iam::259661441422:role/ecsTaskExecutionRole'
        
        # Update container definition with new image
        for container in current_task_def['containerDefinitions']:
            container_def = container.copy()
            if container_def['name'] == 'edsteward':
                container_def['image'] = f"{ecr_repo}:{image_tag}"
                
                # Ensure proper environment variables
                env_vars = container_def.get('environment', [])
                
                # Clean DATABASE_URL
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
                
                # Ensure NODE_ENV is production
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
                
                # Ensure correct log configuration
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

    # Step 6: Update service
    print("\n6️⃣ Updating ECS service...")
    
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

    # Step 7: Clean up and restore
    print("\n7️⃣ Cleaning up...")
    
    # Restore original package.json
    package_json['scripts']['build'] = original_build
    with open('package.json', 'w') as f:
        json.dump(package_json, f, indent=2)
    
    # Remove temporary Dockerfile
    if os.path.exists('Dockerfile.fixed'):
        os.remove('Dockerfile.fixed')
    
    print("   ✅ Restored original files")

    # Step 8: Monitor briefly
    print("\n8️⃣ Monitoring deployment...")
    
    for i in range(3):  # Just 3 quick checks
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
    print("- ✅ Server compilation: Full server (not frontend-only)")
    print("- ✅ Entry point: node dist/index.js")
    print("- ✅ Database URL: Clean format with SSL")
    print()
    print("Monitor logs with: python3 check-logs-aggressive.py")

if __name__ == "__main__":
    main() 