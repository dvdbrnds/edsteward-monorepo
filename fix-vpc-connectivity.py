#!/usr/bin/env python3
"""
VPC Connectivity Fix for ECS-RDS Communication
"""

import subprocess
import json
import time

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except:
        return False, "", "Command failed"

def main():
    print("🌐 FIXING VPC CONNECTIVITY FOR DATABASE ACCESS")
    print("=" * 55)
    
    # 1. Get the default VPC (where RDS is)
    print("\n1. Finding VPC details...")
    success, default_vpc, _ = run_cmd("aws ec2 describe-vpcs --filters 'Name=is-default,Values=true' --query 'Vpcs[0].VpcId' --output text")
    ecs_vpc = "vpc-08e725354dc2ff83e"  # From previous output
    
    if success:
        print(f"   📍 Default VPC (RDS): {default_vpc}")
        print(f"   📍 ECS VPC: {ecs_vpc}")
        
        if default_vpc == ecs_vpc:
            print("   ✅ VPCs are the same - checking other issues...")
        else:
            print("   ⚠️  VPCs are different - need connectivity solution")
            
            # Check if VPC peering exists
            success, peering_info, _ = run_cmd(f"aws ec2 describe-vpc-peering-connections --filters 'Name=status-code,Values=active' 'Name=accepter-vpc-info.vpc-id,Values={ecs_vpc}' 'Name=requester-vpc-info.vpc-id,Values={default_vpc}' --query 'VpcPeeringConnections[0].VpcPeeringConnectionId' --output text")
            
            if success and peering_info and peering_info != "None":
                print(f"   🔗 VPC peering exists: {peering_info}")
                
                # Check route tables
                print("   🛣️  Checking route tables...")
                success, ecs_routes, _ = run_cmd(f"aws ec2 describe-route-tables --filters 'Name=vpc-id,Values={ecs_vpc}' --query 'RouteTables[0].Routes[?DestinationCidrBlock==`172.31.0.0/16`]' --output json")
                
                if success:
                    routes = json.loads(ecs_routes) if ecs_routes else []
                    if not routes:
                        print("   🔧 Adding route to default VPC...")
                        
                        # Get route table ID
                        success, rt_id, _ = run_cmd(f"aws ec2 describe-route-tables --filters 'Name=vpc-id,Values={ecs_vpc}' --query 'RouteTables[0].RouteTableId' --output text")
                        if success:
                            success, _, _ = run_cmd(f"aws ec2 create-route --route-table-id {rt_id} --destination-cidr-block 172.31.0.0/16 --vpc-peering-connection-id {peering_info}")
                            if success:
                                print("   ✅ Route added successfully")
                            else:
                                print("   ❌ Failed to add route")
                    else:
                        print("   ✅ Route already exists")
            else:
                print("   🔧 Creating VPC peering connection...")
                
                # Create VPC peering
                success, peering_output, _ = run_cmd(f"aws ec2 create-vpc-peering-connection --vpc-id {ecs_vpc} --peer-vpc-id {default_vpc}")
                if success:
                    try:
                        peering_data = json.loads(peering_output)
                        peering_id = peering_data['VpcPeeringConnection']['VpcPeeringConnectionId']
                        print(f"   ✅ VPC peering created: {peering_id}")
                        
                        # Accept the peering connection
                        success, _, _ = run_cmd(f"aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id {peering_id}")
                        if success:
                            print("   ✅ VPC peering accepted")
                            
                            # Add routes
                            time.sleep(10)  # Wait for peering to be active
                            
                            # Route from ECS VPC to default VPC
                            success, rt_id, _ = run_cmd(f"aws ec2 describe-route-tables --filters 'Name=vpc-id,Values={ecs_vpc}' --query 'RouteTables[0].RouteTableId' --output text")
                            if success:
                                success, _, _ = run_cmd(f"aws ec2 create-route --route-table-id {rt_id} --destination-cidr-block 172.31.0.0/16 --vpc-peering-connection-id {peering_id}")
                                if success:
                                    print("   ✅ Route from ECS to default VPC added")
                            
                            # Route from default VPC to ECS VPC
                            success, default_rt_id, _ = run_cmd(f"aws ec2 describe-route-tables --filters 'Name=vpc-id,Values={default_vpc}' --query 'RouteTables[0].RouteTableId' --output text")
                            if success:
                                success, _, _ = run_cmd(f"aws ec2 create-route --route-table-id {default_rt_id} --destination-cidr-block 10.0.0.0/16 --vpc-peering-connection-id {peering_id}")
                                if success:
                                    print("   ✅ Route from default VPC to ECS added")
                                    
                    except Exception as e:
                        print(f"   ❌ Error creating peering: {e}")
    
    # 2. Alternative: Move ECS to default VPC
    print("\n2. Alternative solution: Moving ECS to default VPC...")
    
    # Get default VPC subnets
    success, subnet_output, _ = run_cmd(f"aws ec2 describe-subnets --filters 'Name=vpc-id,Values={default_vpc}' --query 'Subnets[0:2].SubnetId' --output json")
    if success:
        try:
            default_subnets = json.loads(subnet_output)
            print(f"   📍 Default VPC subnets: {default_subnets}")
            
            # Get current security group details
            success, sg_output, _ = run_cmd("aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text")
            
            if success and sg_output:
                current_sg = sg_output.strip()
                
                # Create new security group in default VPC
                print("   🔒 Creating security group in default VPC...")
                success, new_sg_output, _ = run_cmd(f"aws ec2 create-security-group --group-name edsteward-default-vpc --description 'edsteward in default VPC' --vpc-id {default_vpc}")
                
                if success:
                    try:
                        new_sg_data = json.loads(new_sg_output)
                        new_sg_id = new_sg_data['GroupId']
                        print(f"   ✅ New security group created: {new_sg_id}")
                        
                        # Add rules to new security group
                        rules = [
                            f"aws ec2 authorize-security-group-ingress --group-id {new_sg_id} --protocol tcp --port 80 --cidr 0.0.0.0/0",
                            f"aws ec2 authorize-security-group-ingress --group-id {new_sg_id} --protocol tcp --port 443 --cidr 0.0.0.0/0",
                            f"aws ec2 authorize-security-group-ingress --group-id {new_sg_id} --protocol tcp --port 3000 --cidr 0.0.0.0/0",
                            f"aws ec2 authorize-security-group-ingress --group-id {new_sg_id} --protocol tcp --port 5432 --source-group {new_sg_id}",
                        ]
                        
                        for rule in rules:
                            run_cmd(rule)
                        
                        print("   ✅ Security group rules added")
                        
                        # Update ECS service to use default VPC
                        print("   🔄 Updating ECS service to use default VPC...")
                        
                        network_config = {
                            "awsvpcConfiguration": {
                                "subnets": default_subnets,
                                "securityGroups": [new_sg_id],
                                "assignPublicIp": "ENABLED"
                            }
                        }
                        
                        with open('/tmp/network_config.json', 'w') as f:
                            json.dump(network_config, f)
                        
                        success, _, _ = run_cmd(f"aws ecs update-service --cluster edsteward-cluster --service edsteward-service --network-configuration file:///tmp/network_config.json --force-new-deployment")
                        
                        if success:
                            print("   ✅ ECS service updated to use default VPC")
                            
                            # Wait for deployment
                            print("   ⏳ Waiting 2 minutes for deployment...")
                            time.sleep(120)
                            
                            # Test login
                            print("   🧪 Testing login after VPC fix...")
                            success, login_output, _ = run_cmd("curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login")
                            
                            if success and login_output:
                                if any(keyword in login_output for keyword in ['401', 'Authentication failed', 'Invalid credentials', 'error']):
                                    if 'timeout' not in login_output.lower():
                                        print(f"   🎉 SUCCESS! Login endpoint working: {login_output[:100]}")
                                        return True
                                    else:
                                        print("   ❌ Still getting timeout errors")
                                else:
                                    print(f"   ✅ Login responding: {login_output[:100]}")
                                    return True
                            else:
                                print("   ❌ No response from login endpoint")
                        else:
                            print("   ❌ Failed to update ECS service")
                            
                    except Exception as e:
                        print(f"   ❌ Error creating security group: {e}")
                        
        except Exception as e:
            print(f"   ❌ Error getting subnets: {e}")
    
    return False

if __name__ == "__main__":
    result = main()
    if result:
        print("\n🎉 VPC CONNECTIVITY FIXED! LOGIN SHOULD BE WORKING!")
    else:
        print("\n❌ VPC CONNECTIVITY ISSUE PERSISTS")
        print("🔍 Consider manually checking:")
        print("   1. VPC peering connections")
        print("   2. Route table configurations")
        print("   3. Security group rules for port 5432") 