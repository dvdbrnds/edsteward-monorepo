#!/bin/bash

echo "🔧 DEPLOYING DATABASE FIX FOR STAGING TENANT"
echo "============================================="

# Add the database fix script to git and push
echo "📦 Adding database fix script to repository..."
git add fix-staging-tenant.js fix-staging-tenant-database.sql

# Commit if there are changes
if ! git diff --cached --exit-code > /dev/null; then
    git commit -m "feat: add database fix script for staging tenant

- Automated Node.js script to fix staging tenant database record
- SQL script for manual execution if needed
- Fixes staging tenant ID mapping: admin → staging"
    
    echo "✅ Database fix scripts committed"
else
    echo "ℹ️  Database fix scripts already committed"
fi

# Push to trigger deployment
echo "🚀 Pushing to trigger deployment..."
git push origin main

echo ""
echo "🎯 NEXT STEPS:"
echo "1. Wait for deployment to complete (~2-3 minutes)"
echo "2. SSH into the production server"
echo "3. Run: cd /path/to/edsteward && node fix-staging-tenant.js"
echo "4. Verify: curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId"
echo ""
echo "Expected result: tenantId should change from 'admin' to 'staging'" 