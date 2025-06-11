#!/bin/bash

echo "=== ECS Service Status ==="
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].{runningCount:runningCount,pendingCount:pendingCount,desiredCount:desiredCount}' --output table

echo "=== Recent Tasks ==="
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --region us-east-1 --query 'taskArns[0:2]' --output table

echo "=== Recent Log Streams ==="
aws logs describe-log-streams --log-group-name "/aws/ecs/edsteward" --region us-east-1 --order-by LastEventTime --descending --max-items 3 --query 'logStreams[].{logStreamName:logStreamName,lastEventTime:lastEventTime}' --output table 