**MAJOR SUCCESS: ECS Deployment Issue Permanently Resolved**

Successfully identified and fixed the recurring ECS deployment problem where services wouldn't use the latest Docker images. The issue was using `aws ecs update-service --force-new-deployment` which only restarts with the SAME task definition.

**Root Cause:**
- `--force-new-deployment` doesn't update the Docker image URI in the task definition
- It only restarts the service with whatever image is already specified
- We were pushing new images to ECR but ECS kept using old images from previous task definitions

**Solution Implemented:**
Created `scripts/deploy-ecs-proper.sh` that follows AWS best practices:
1. Build Docker image with unique tag (timestamp + git commit)
2. Push to ECR with authentication
3. Download current task definition via AWS CLI
4. Update task definition JSON with new image URI using jq
5. Register NEW task definition with updated image
6. Update ECS service to use the NEW task definition
7. Wait for deployment completion and verify correct image is running

**Key Success Metrics:**
- Deployment completed successfully with task definition revision 11
- ECS service verified running exact image: `deploy-20250910-120809-cfebfd8`
- SAML endpoint fix deployed (hardcoded URL to `/auth/saml`)
- No more "why is ECS using old image" issues

**Critical Learning:**
Never use `aws ecs update-service --force-new-deployment` alone for image updates. Always register new task definitions with updated image URIs.