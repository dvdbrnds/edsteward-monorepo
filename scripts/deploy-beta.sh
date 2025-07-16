#!/bin/zsh

# Deploy beta environment to AWS ECS
# Usage: ./scripts/deploy-beta.sh [BETA_DATABASE_URL]

set -e

if [[ -z "$1" ]]; then
  echo "❌ Error: Beta database URL required"
  echo "Usage: ./scripts/deploy-beta.sh 'postgresql://user:password@host/database?sslmode=require'"
  exit 1
fi

BETA_DB_URL="$1"
echo "🚀 Deploying EdSteward Beta Environment"
echo "======================================"

# Update task definition with beta database URL
echo "🔧 Updating task definition..."
# Use jq to safely replace the database URL
jq --arg db_url "$BETA_DB_URL" '.containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(if .name == "DATABASE_URL" then .value = $db_url else . end))' beta-task-definition.json > beta-task-definition-configured.json

# Create/update ECS log group
echo "📋 Creating CloudWatch log group..."
aws logs create-log-group --log-group-name "/ecs/edsteward-beta" --region us-east-1 || true

# Register task definition
echo "📝 Registering task definition..."
aws ecs register-task-definition --cli-input-json file://beta-task-definition-configured.json --region us-east-1

# Update beta service
echo "🔄 Updating beta service..."
aws ecs update-service \
  --cluster edsteward-beta-cluster \
  --service edsteward-beta-service \
  --task-definition edsteward-beta \
  --force-new-deployment \
  --region us-east-1

echo "✅ Beta deployment complete!"
echo "🌐 Beta URL: https://beta.edsteward.ai"
echo "🔐 Test credentials:"
echo "   Username: admin, Password: admin"
echo "   Username: betauser, Password: betauser"

# Clean up temporary file
rm -f beta-task-definition-configured.json
