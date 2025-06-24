#!/bin/bash

echo "🚨 EMERGENCY ROLLBACK - Registration 500 Fix"
echo "============================================="
echo ""

echo "Rolling back to revision 62 (confirmed working)"
echo "This revision had working database connections"

# Rollback to known working revision
/opt/homebrew/bin/aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:62 \
  --force-new-deployment \
  --region us-east-1

echo "✅ Rollback initiated to revision 62"

echo ""
echo "Waiting 2 minutes for rollback to complete..."
sleep 120

echo ""
echo "Testing service health..."
curl -s -I https://edsteward.ai | head -1

echo ""
echo "Testing registration endpoint..."
curl -s -X POST https://edsteward.ai/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","email":"test@test.com","firstName":"Test","lastName":"User","role":"user","department":"IT"}' | head -100

echo ""
echo "If you see 'User already exists' or similar, the database is working!"
echo "Check https://edsteward.ai/register to confirm the registration page works" 