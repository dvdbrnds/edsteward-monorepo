#!/bin/zsh

echo "🚀 Monitoring AWS Deployment..."
echo "📅 Current time: $(date)"
echo ""

# Check AWS deployment status
echo "🔗 Check deployment status at:"
echo "   ./scripts/check-production-status.sh"
echo ""

# Check latest ECR images
echo "📦 Latest ECR images:"
export AWS_PAGER=""
aws ecr describe-images \
  --repository-name edsteward-multi-tenant \
  --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-3:].[imageTags[0],imagePushedAt]' \
  --output table

echo ""

# Check ECS service status
echo "🔄 ECS Staging Service Status:"
aws ecs describe-services \
  --cluster edsteward-multi-tenant-staging-cluster \
  --services edsteward-multi-tenant-staging-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,LastDeployment:deployments[0].updatedAt}' \
  --output table

echo ""
echo "💡 If AWS deployment is running, new images should appear in ECR within 3-5 minutes"
echo "💡 After ECR push, ECS service will update automatically" 