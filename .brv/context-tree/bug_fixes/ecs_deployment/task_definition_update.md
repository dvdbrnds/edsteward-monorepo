**CRITICAL ECS Deployment Fix: Proper Task Definition Update Process**

The recurring issue where ECS services don't use the latest Docker images is caused by using `aws ecs update-service --force-new-deployment` which only restarts with the SAME task definition.

**Correct AWS CLI Process:**
1. Build and push Docker image with unique tag (not 'latest')
2. Download current task definition: `aws ecs describe-task-definition --task-definition FAMILY --query taskDefinition > task-def.json`
3. Update the image in task definition using jq: `cat task-def.json | jq '.containerDefinitions[0].image = "NEW_IMAGE_URI"' | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' > updated-task-def.json`
4. Register new task definition: `aws ecs register-task-definition --cli-input-json file://updated-task-def.json`
5. Update service with new task definition: `aws ecs update-service --cluster CLUSTER --service SERVICE --task-definition NEW_TASK_DEF_ARN`

**Key Points:**
- Always use unique image tags (commit SHA, timestamp, etc.) not 'latest'
- Must register new task definition with updated image URI
- `--force-new-deployment` alone will NOT pick up new images
- Clean up task definition JSON by removing AWS-managed fields before registering