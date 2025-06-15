#!/bin/bash
# Auto-generated script to delete unused security groups
# Generated on 2025-06-15 10:43:16

echo '🗑️  Deleting unused security groups...'

echo 'Deleting sg-01755ff99388e0e3d - launch-wizard-1'
aws ec2 delete-security-group --group-id sg-01755ff99388e0e3d
sleep 1

echo 'Deleting sg-089823ea0e067a110 - edsteward-ecs-sg'
aws ec2 delete-security-group --group-id sg-089823ea0e067a110
sleep 1

echo 'Deleting sg-0ebc25dd2d7ea365e - edsteward-ecs-sg'
aws ec2 delete-security-group --group-id sg-0ebc25dd2d7ea365e
sleep 1

echo 'Deleting sg-038050dd848933609 - edsteward-default-vpc'
aws ec2 delete-security-group --group-id sg-038050dd848933609
sleep 1

echo 'Deleting sg-020e26812f15b1dd5 - RegulatoryTrackr-ALB-SG'
aws ec2 delete-security-group --group-id sg-020e26812f15b1dd5
sleep 1

echo 'Deleting sg-036582cf511bc230d - awseb-e-iamcucmmhn-stack-AWSEBSecurityGroup-LHK78lJ3bqtn'
aws ec2 delete-security-group --group-id sg-036582cf511bc230d
sleep 1

echo 'Deleting sg-0f3fa3d80bc279d95 - RegulatoryTrackr-ECS-SG'
aws ec2 delete-security-group --group-id sg-0f3fa3d80bc279d95
sleep 1

echo 'Deleting sg-06abaf675286527bb - ecs-edsteward'
aws ec2 delete-security-group --group-id sg-06abaf675286527bb
sleep 1

echo '✅ Cleanup complete!'
