#!/bin/bash

echo "🔍 CHECKING RDS INSTANCES"
echo "========================"
echo ""

echo "1. Listing all RDS instances in us-east-1..."
/opt/homebrew/bin/aws rds describe-db-instances --region us-east-1 2>/dev/null || echo "Failed to get RDS instances"

echo ""
echo "2. Looking for instances with 'edsteward' in the name..."
/opt/homebrew/bin/aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`edsteward`)].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' --output table 2>/dev/null || echo "No edsteward instances found"

echo ""
echo "3. Checking all RDS instance identifiers..."
/opt/homebrew/bin/aws rds describe-db-instances --region us-east-1 --query 'DBInstances[*].DBInstanceIdentifier' --output text 2>/dev/null || echo "Failed to list instance IDs"

echo ""
echo "4. Testing alternative regions..."
for region in us-west-2 eu-west-1 eu-central-1; do
    echo "Checking $region..."
    instances=$(/opt/homebrew/bin/aws rds describe-db-instances --region $region --query 'DBInstances[*].DBInstanceIdentifier' --output text 2>/dev/null)
    if [ ! -z "$instances" ]; then
        echo "Found instances in $region: $instances"
    fi
done

echo ""
echo "5. Checking if you have any PostgreSQL databases..."
/opt/homebrew/bin/aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?Engine==`postgres`].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address,Engine:Engine}' --output table 2>/dev/null || echo "No PostgreSQL instances found"

echo ""
echo "INVESTIGATION COMPLETE"
echo "====================="
echo ""
echo "If no RDS instances are found, this means:"
echo "1. The RDS database doesn't exist"
echo "2. You're using the wrong AWS account/region"
echo "3. The DATABASE_URL in production is pointing to a non-existent RDS"
echo ""
echo "RECOMMENDED ACTIONS:"
echo "- Check if you actually have an RDS instance"
echo "- Verify the correct endpoint URL"
echo "- Consider using the same database for local and production" 