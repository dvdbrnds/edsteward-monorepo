#!/usr/bin/env python3

import boto3

def check_rds_status():
    try:
        rds = boto3.client('rds', region_name='us-east-1')
        response = rds.describe_db_instances(DBInstanceIdentifier='edsteward-public-db')
        db = response['DBInstances'][0]
        
        print(f"🔍 RDS Status: {db['DBInstanceStatus']}")
        
        if 'Endpoint' in db and db['Endpoint']:
            print(f"🌐 Endpoint: {db['Endpoint']['Address']}")
            print(f"🔌 Port: {db['Endpoint']['Port']}")
            print("✅ RDS is ready!")
            return True
        else:
            print("⏳ Endpoint not ready yet...")
            return False
            
    except Exception as e:
        print(f"❌ RDS not found or error: {e}")
        return False

if __name__ == "__main__":
    check_rds_status() 