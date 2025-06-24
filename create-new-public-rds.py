#!/usr/bin/env python3

import boto3
import time
import sys
import subprocess
import psycopg2

def create_public_rds():
    """Create a new publicly accessible RDS database"""
    
    rds = boto3.client('rds', region_name='us-east-1')
    ec2 = boto3.client('ec2', region_name='us-east-1')
    
    # Database configuration
    db_instance_id = 'edsteward-public-db'
    db_name = 'edsteward'
    master_username = 'postgres'
    master_password = 'EdSteward2024!Secure'
    
    print("🚀 Creating New Public RDS Database")
    print("=" * 50)
    print(f"Instance ID: {db_instance_id}")
    print(f"Database: {db_name}")
    print(f"Username: {master_username}")
    print()
    
    # Get default VPC and subnets
    try:
        print("🔍 Finding default VPC and public subnets...")
        
        # Get default VPC
        vpcs = ec2.describe_vpcs(Filters=[{'Name': 'is-default', 'Values': ['true']}])
        if not vpcs['Vpcs']:
            print("❌ No default VPC found")
            return False
            
        vpc_id = vpcs['Vpcs'][0]['VpcId']
        print(f"✅ Default VPC: {vpc_id}")
        
        # Get public subnets in different AZs
        subnets = ec2.describe_subnets(
            Filters=[
                {'Name': 'vpc-id', 'Values': [vpc_id]},
                {'Name': 'map-public-ip-on-launch', 'Values': ['true']}
            ]
        )
        
        if len(subnets['Subnets']) < 2:
            print("❌ Need at least 2 public subnets in different AZs")
            return False
            
        subnet_ids = [subnet['SubnetId'] for subnet in subnets['Subnets'][:2]]
        print(f"✅ Public subnets: {subnet_ids}")
        
        # Create security group for RDS
        print("🔒 Creating security group...")
        try:
            sg_response = ec2.create_security_group(
                GroupName='edsteward-public-rds-sg',
                Description='Security group for public EdSteward RDS',
                VpcId=vpc_id
            )
            sg_id = sg_response['GroupId']
            print(f"✅ Security group created: {sg_id}")
            
            # Add inbound rule for PostgreSQL
            ec2.authorize_security_group_ingress(
                GroupId=sg_id,
                IpPermissions=[
                    {
                        'IpProtocol': 'tcp',
                        'FromPort': 5432,
                        'ToPort': 5432,
                        'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'PostgreSQL access'}]
                    }
                ]
            )
            print("✅ PostgreSQL port 5432 opened to public")
            
        except Exception as e:
            if 'already exists' in str(e):
                # Get existing security group
                sgs = ec2.describe_security_groups(
                    Filters=[
                        {'Name': 'group-name', 'Values': ['edsteward-public-rds-sg']},
                        {'Name': 'vpc-id', 'Values': [vpc_id]}
                    ]
                )
                sg_id = sgs['SecurityGroups'][0]['GroupId']
                print(f"✅ Using existing security group: {sg_id}")
            else:
                print(f"❌ Security group error: {e}")
                return False
        
        # Create DB subnet group
        print("🌐 Creating DB subnet group...")
        try:
            rds.create_db_subnet_group(
                DBSubnetGroupName='edsteward-public-subnet-group',
                DBSubnetGroupDescription='Public subnet group for EdSteward',
                SubnetIds=subnet_ids
            )
            print("✅ DB subnet group created")
        except Exception as e:
            if 'already exists' in str(e):
                print("✅ DB subnet group already exists")
            else:
                print(f"❌ Subnet group error: {e}")
                return False
        
        # Create RDS instance
        print("💾 Creating RDS database instance...")
        print("⏳ This will take 5-10 minutes...")
        
        rds.create_db_instance(
            DBInstanceIdentifier=db_instance_id,
            DBInstanceClass='db.t3.micro',
            Engine='postgres',
            EngineVersion='16.9',
            MasterUsername=master_username,
            MasterUserPassword=master_password,
            DBName=db_name,
            AllocatedStorage=20,
            StorageType='gp2',
            VpcSecurityGroupIds=[sg_id],
            DBSubnetGroupName='edsteward-public-subnet-group',
            PubliclyAccessible=True,
            BackupRetentionPeriod=7,
            MultiAZ=False,
            StorageEncrypted=False,
            DeletionProtection=False
        )
        
        print("✅ RDS creation initiated")
        
        # Wait for RDS to be available
        print("⏳ Waiting for RDS to become available...")
        waiter = rds.get_waiter('db_instance_available')
        waiter.wait(
            DBInstanceIdentifier=db_instance_id,
            WaiterConfig={'Delay': 30, 'MaxAttempts': 40}
        )
        
        # Get RDS endpoint
        response = rds.describe_db_instances(DBInstanceIdentifier=db_instance_id)
        endpoint = response['DBInstances'][0]['Endpoint']['Address']
        port = response['DBInstances'][0]['Endpoint']['Port']
        
        print(f"✅ RDS database is ready!")
        print(f"📊 Endpoint: {endpoint}")
        print(f"📊 Port: {port}")
        
        return {
            'endpoint': endpoint,
            'port': port,
            'database': db_name,
            'username': master_username,
            'password': master_password
        }
        
    except Exception as e:
        print(f"❌ Error creating RDS: {e}")
        return False

def restore_data_to_new_db(db_config):
    """Restore data from backup to new database"""
    
    print("\n📊 Restoring Data to New Database")
    print("=" * 40)
    
    try:
        # Test connection
        print("🔄 Testing database connection...")
        conn = psycopg2.connect(
            host=db_config['endpoint'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['username'],
            password=db_config['password'],
            connect_timeout=30
        )
        print("✅ Connection successful!")
        conn.close()
        
        # Restore using psql
        print("📥 Restoring data from backup file...")
        
        # Set environment variable for password
        import os
        os.environ['PGPASSWORD'] = db_config['password']
        
        # Run psql restore
        cmd = [
            'psql',
            '-h', db_config['endpoint'],
            '-p', str(db_config['port']),
            '-U', db_config['username'],
            '-d', db_config['database'],
            '-f', 'nosync_backup.sql'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Data restoration completed!")
            
            # Verify restoration
            print("🔍 Verifying restoration...")
            conn = psycopg2.connect(
                host=db_config['endpoint'],
                port=db_config['port'],
                database=db_config['database'],
                user=db_config['username'],
                password=db_config['password']
            )
            
            cursor = conn.cursor()
            
            # Count users
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            print(f"📊 Users restored: {user_count}")
            
            # Count regulations
            cursor.execute("SELECT COUNT(*) FROM regulations;")
            reg_count = cursor.fetchone()[0]
            print(f"📊 Regulations restored: {reg_count}")
            
            # Show sample regulation
            if reg_count > 0:
                cursor.execute("SELECT name, category FROM regulations LIMIT 1;")
                sample = cursor.fetchone()
                print(f"📋 Sample regulation: {sample[0]} ({sample[1]})")
            
            cursor.close()
            conn.close()
            
            return True
            
        else:
            print(f"❌ Restoration failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error during restoration: {e}")
        return False

def update_application_config(db_config):
    """Show how to update application to use new database"""
    
    print("\n🔧 Application Configuration Update")
    print("=" * 40)
    print("Update your application environment variables:")
    print(f"DATABASE_URL=postgresql://{db_config['username']}:{db_config['password']}@{db_config['endpoint']}:{db_config['port']}/{db_config['database']}")
    print()
    print("Or individual variables:")
    print(f"DB_HOST={db_config['endpoint']}")
    print(f"DB_PORT={db_config['port']}")
    print(f"DB_NAME={db_config['database']}")
    print(f"DB_USER={db_config['username']}")
    print(f"DB_PASSWORD={db_config['password']}")

if __name__ == "__main__":
    print("🎯 EdSteward New Public RDS Setup")
    print("=" * 50)
    
    # Create new RDS
    db_config = create_public_rds()
    if not db_config:
        print("❌ Failed to create RDS")
        sys.exit(1)
    
    # Restore data
    if restore_data_to_new_db(db_config):
        print("\n🎉 Success! New public RDS database created and data restored!")
        update_application_config(db_config)
        
        print(f"\n🧪 Test connection:")
        print(f"psql -h {db_config['endpoint']} -p {db_config['port']} -U {db_config['username']} -d {db_config['database']}")
        
    else:
        print("❌ Data restoration failed")
        sys.exit(1) 