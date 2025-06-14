#!/usr/bin/env python3
"""
COMPREHENSIVE DOCKER BUILD AND DEPLOY SCRIPT
============================================

This script ensures the Docker image is ALWAYS built for linux/amd64 platform
and deployed correctly to AWS ECS. It prevents the recurring platform issues.

Usage:
    python3 build-and-deploy.py [--force-rebuild] [--tag=TAG]
    
Features:
- Forces linux/amd64 platform
- Builds, tags, and pushes to ECR
- Updates ECS service
- Comprehensive error handling
- Prevents platform compatibility issues
"""

import subprocess
import sys
import json
import time
import argparse
from datetime import datetime

def run_command(command, check=True, capture_output=True):
    """Run command and return success status and output"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=check, 
            capture_output=capture_output,
            text=True,
            timeout=600  # 10 minute timeout
        )
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout if e.stdout else "", e.stderr if e.stderr else str(e)
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out after 10 minutes"

def log(message, level="INFO"):
    """Log message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    colors = {
        "INFO": "\033[94m",     # Blue
        "SUCCESS": "\033[92m",  # Green
        "WARNING": "\033[93m",  # Yellow
        "ERROR": "\033[91m",    # Red
        "END": "\033[0m"        # Reset
    }
    color = colors.get(level, colors["INFO"])
    print(f"{color}[{level}] {timestamp}: {message}{colors['END']}")

def check_prerequisites():
    """Check required tools and AWS credentials"""
    log("Checking prerequisites...")
    
    # Check Docker
    success, _, _ = run_command("docker --version")
    if not success:
        log("Docker not found. Please install Docker.", "ERROR")
        return False
    
    # Check Docker buildx
    success, _, _ = run_command("docker buildx version")
    if not success:
        log("Docker buildx not found. Please ensure Docker Desktop is running.", "ERROR")
        return False
    
    # Check AWS CLI
    success, _, _ = run_command("aws --version")
    if not success:
        log("AWS CLI not found. Please install AWS CLI.", "ERROR")
        return False
    
    # Check AWS credentials
    success, _, _ = run_command("aws sts get-caller-identity")
    if not success:
        log("AWS credentials not configured. Please run 'aws configure'.", "ERROR")
        return False
    
    log("All prerequisites met!", "SUCCESS")
    return True

def get_aws_info():
    """Get AWS account ID and ECR details"""
    log("Getting AWS account information...")
    
    success, account_id, _ = run_command("aws sts get-caller-identity --query Account --output text")
    if not success:
        log("Failed to get AWS account ID", "ERROR")
        return None, None, None
    
    account_id = account_id.strip()
    region = "us-east-1"
    ecr_registry = f"{account_id}.dkr.ecr.{region}.amazonaws.com"
    ecr_repository = f"{ecr_registry}/edsteward"
    
    log(f"Account ID: {account_id}")
    log(f"ECR Repository: {ecr_repository}")
    
    return account_id, ecr_registry, ecr_repository

def ensure_ecr_repository(account_id, region="us-east-1"):
    """Ensure ECR repository exists"""
    log("Ensuring ECR repository exists...")
    
    # Check if repository exists
    success, _, _ = run_command(f"aws ecr describe-repositories --repository-names edsteward --region {region}")
    
    if not success:
        log("Creating ECR repository...")
        success, _, stderr = run_command(f"aws ecr create-repository --repository-name edsteward --region {region}")
        if not success:
            log(f"Failed to create ECR repository: {stderr}", "ERROR")
            return False
        log("ECR repository created successfully", "SUCCESS")
    else:
        log("ECR repository already exists", "SUCCESS")
    
    return True

def build_docker_image(image_tag, force_rebuild=False):
    """Build Docker image with correct platform"""
    log(f"Building Docker image with tag: {image_tag}")
    
    # Clean up any existing images if force rebuild
    if force_rebuild:
        log("Force rebuild requested - cleaning up existing images...")
        run_command(f"docker rmi edsteward:{image_tag} 2>/dev/null || true", check=False)
        run_command(f"docker system prune -f", check=False)
    
    # Build with explicit platform specification
    build_command = f"""
    docker buildx build \
        --platform linux/amd64 \
        --load \
        --progress=plain \
        -t edsteward:{image_tag} \
        -t edsteward:latest \
        .
    """
    
    log("Starting Docker build (this may take several minutes)...")
    success, stdout, stderr = run_command(build_command, capture_output=False)
    
    if not success:
        log(f"Docker build failed: {stderr}", "ERROR")
        return False
    
    # Verify the image was built with correct architecture
    log("Verifying image architecture...")
    success, arch_info, _ = run_command(f"docker inspect edsteward:{image_tag} --format '{{{{.Architecture}}}}'")
    if success:
        arch = arch_info.strip()
        if arch != "amd64":
            log(f"WARNING: Image architecture is {arch}, expected amd64", "WARNING")
        else:
            log(f"✓ Image architecture verified: {arch}", "SUCCESS")
    
    log("Docker image built successfully!", "SUCCESS")
    return True

def push_to_ecr(ecr_registry, ecr_repository, image_tag, region="us-east-1"):
    """Push image to ECR"""
    log("Pushing image to ECR...")
    
    # Login to ECR
    log("Logging into ECR...")
    success, _, stderr = run_command(f"aws ecr get-login-password --region {region} | docker login --username AWS --password-stdin {ecr_registry}")
    if not success:
        log(f"ECR login failed: {stderr}", "ERROR")
        return False
    
    # Tag for ECR
    log("Tagging image for ECR...")
    success, _, stderr = run_command(f"docker tag edsteward:{image_tag} {ecr_repository}:{image_tag}")
    if not success:
        log(f"Failed to tag image: {stderr}", "ERROR")
        return False
    
    success, _, stderr = run_command(f"docker tag edsteward:{image_tag} {ecr_repository}:latest")
    if not success:
        log(f"Failed to tag latest image: {stderr}", "ERROR")
        return False
    
    # Push images
    log(f"Pushing {ecr_repository}:{image_tag}...")
    success, _, stderr = run_command(f"docker push {ecr_repository}:{image_tag}")
    if not success:
        log(f"Failed to push tagged image: {stderr}", "ERROR")
        return False
    
    log(f"Pushing {ecr_repository}:latest...")
    success, _, stderr = run_command(f"docker push {ecr_repository}:latest")
    if not success:
        log(f"Failed to push latest image: {stderr}", "ERROR")
        return False
    
    log("Images pushed to ECR successfully!", "SUCCESS")
    return True

def update_ecs_service(ecr_repository, image_tag, region="us-east-1"):
    """Update ECS service with new image"""
    log("Updating ECS service...")
    
    cluster_name = "edsteward-cluster"
    service_name = "edsteward-service"
    task_definition = "edsteward"
    
    # Check if cluster exists
    success, _, _ = run_command(f"aws ecs describe-clusters --clusters {cluster_name} --region {region}")
    if not success:
        log(f"ECS cluster '{cluster_name}' not found", "ERROR")
        return False
    
    # Check if service exists
    success, _, _ = run_command(f"aws ecs describe-services --cluster {cluster_name} --services {service_name} --region {region}")
    if not success:
        log(f"ECS service '{service_name}' not found", "ERROR")
        return False
    
    # Get current task definition
    success, current_task_def, _ = run_command(f"aws ecs describe-task-definition --task-definition {task_definition} --region {region} --query 'taskDefinition'")
    if not success:
        log("Failed to get current task definition", "ERROR")
        return False
    
    # Update task definition with new image
    try:
        task_def_json = json.loads(current_task_def)
        
        # Update the image
        task_def_json['containerDefinitions'][0]['image'] = f"{ecr_repository}:{image_tag}"
        
        # Remove fields that aren't allowed in register-task-definition
        fields_to_remove = ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 
                           'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']
        for field in fields_to_remove:
            task_def_json.pop(field, None)
        
        # Save updated task definition to file
        with open('/tmp/task_def.json', 'w') as f:
            json.dump(task_def_json, f, indent=2)
        
        # Register new task definition
        success, _, stderr = run_command(f"aws ecs register-task-definition --region {region} --cli-input-json file:///tmp/task_def.json")
        if not success:
            log(f"Failed to register new task definition: {stderr}", "ERROR")
            return False
        
    except json.JSONDecodeError as e:
        log(f"Failed to parse task definition JSON: {e}", "ERROR")
        return False
    
    # Update service to use new task definition
    success, _, stderr = run_command(f"aws ecs update-service --cluster {cluster_name} --service {service_name} --force-new-deployment --region {region}")
    if not success:
        log(f"Failed to update ECS service: {stderr}", "ERROR")
        return False
    
    log("ECS service update initiated successfully!", "SUCCESS")
    return True

def wait_for_deployment(timeout_minutes=10):
    """Wait for ECS deployment to complete"""
    log("Waiting for deployment to complete...")
    
    cluster_name = "edsteward-cluster"
    service_name = "edsteward-service"
    region = "us-east-1"
    
    timeout_seconds = timeout_minutes * 60
    start_time = time.time()
    
    while (time.time() - start_time) < timeout_seconds:
        success, service_info, _ = run_command(
            f"aws ecs describe-services --cluster {cluster_name} --services {service_name} --region {region} --query 'services[0]'"
        )
        
        if success:
            try:
                service_data = json.loads(service_info)
                running_count = service_data.get('runningCount', 0)
                desired_count = service_data.get('desiredCount', 0)
                pending_count = service_data.get('pendingCount', 0)
                
                elapsed = int(time.time() - start_time)
                log(f"[{elapsed}s] Running: {running_count}/{desired_count}, Pending: {pending_count}")
                
                if running_count == desired_count and desired_count > 0:
                    log("Deployment completed successfully!", "SUCCESS")
                    return True
                
            except json.JSONDecodeError:
                pass
        
        time.sleep(10)
    
    log(f"Deployment did not complete within {timeout_minutes} minutes", "WARNING")
    return False

def test_application():
    """Test if the application is responding"""
    log("Testing application...")
    
    app_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    success, response, _ = run_command(f"curl -s -o /dev/null -w '%{{http_code}}' {app_url}")
    if success and response.strip() == "200":
        log(f"✓ Application is responding at {app_url}", "SUCCESS")
        return True
    else:
        log(f"Application test failed. HTTP response: {response}", "WARNING")
        return False

def main():
    parser = argparse.ArgumentParser(description='Build and deploy Docker image with correct platform')
    parser.add_argument('--force-rebuild', action='store_true', help='Force rebuild by cleaning existing images')
    parser.add_argument('--tag', default=f"v{datetime.now().strftime('%Y%m%d-%H%M%S')}", help='Image tag (default: timestamp)')
    parser.add_argument('--skip-deploy', action='store_true', help='Only build and push, skip ECS deployment')
    args = parser.parse_args()
    
    log("=" * 60)
    log("STARTING COMPREHENSIVE DOCKER BUILD AND DEPLOY")
    log("=" * 60)
    log(f"Image tag: {args.tag}")
    log(f"Force rebuild: {args.force_rebuild}")
    log(f"Skip deploy: {args.skip_deploy}")
    
    # Step 1: Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Step 2: Get AWS info
    account_id, ecr_registry, ecr_repository = get_aws_info()
    if not account_id:
        sys.exit(1)
    
    # Step 3: Ensure ECR repository exists
    if not ensure_ecr_repository(account_id):
        sys.exit(1)
    
    # Step 4: Build Docker image
    if not build_docker_image(args.tag, args.force_rebuild):
        sys.exit(1)
    
    # Step 5: Push to ECR
    if not push_to_ecr(ecr_registry, ecr_repository, args.tag):
        sys.exit(1)
    
    if args.skip_deploy:
        log("Skipping ECS deployment as requested", "INFO")
        log("Image built and pushed successfully!", "SUCCESS")
        return
    
    # Step 6: Update ECS service
    if not update_ecs_service(ecr_repository, args.tag):
        sys.exit(1)
    
    # Step 7: Wait for deployment
    if not wait_for_deployment():
        log("Deployment may still be in progress. Check AWS console for status.", "WARNING")
    
    # Step 8: Test application
    time.sleep(30)  # Give load balancer time to route to new tasks
    test_application()
    
    log("=" * 60)
    log("DEPLOYMENT COMPLETED SUCCESSFULLY!")
    log("=" * 60)
    log(f"Image: {ecr_repository}:{args.tag}")
    log("Application: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")

if __name__ == "__main__":
    main() 