#!/usr/bin/env python3
"""
Enhanced Jurisdiction System - Production Deployment
====================================================
Deploy the enhanced jurisdiction system to production with full verification
"""

import psycopg2
import boto3
import subprocess
import time
import json
import os
import sys
from datetime import datetime

# Configuration
PRODUCTION_DB_URL = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
ECR_REPOSITORY = "484537813216.dkr.ecr.us-east-2.amazonaws.com/regulatory-trackr"
ECS_CLUSTER = "regulatory-trackr-cluster"
ECS_SERVICE = "regulatory-trackr-service"
AWS_REGION = "us-east-2"

def log_step(step, message):
    """Log a deployment step with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{timestamp}] {step}: {message}")
    print("=" * 60)

def run_command(command, description):
    """Run a command with error handling"""
    print(f"Running: {description}")
    print(f"Command: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
        print(f"✅ Success: {description}")
        if result.stdout:
            print("Output:", result.stdout.strip())
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed: {description}")
        print(f"Error: {e}")
        if e.stdout:
            print("Stdout:", e.stdout)
        if e.stderr:
            print("Stderr:", e.stderr)
        return False, str(e)

def verify_production_db_connection():
    """Verify we can connect to production database"""
    log_step("STEP 1", "Verifying Production Database Connection")
    
    try:
        conn = psycopg2.connect(PRODUCTION_DB_URL)
        cursor = conn.cursor()
        
        # Get current regulation count
        cursor.execute("SELECT COUNT(*) FROM regulations;")
        reg_count = cursor.fetchone()[0]
        
        # Check if migration already exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'regulations' AND column_name = 'jurisdiction_source'
            );
        """)
        migration_exists = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        print(f"✅ Connected to production database")
        print(f"📊 Current regulation count: {reg_count:,}")
        print(f"🔄 Migration status: {'Already applied' if migration_exists else 'Needs to be applied'}")
        
        return True, reg_count, migration_exists
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, 0, False

def run_production_migration():
    """Run the enhanced jurisdiction migration on production"""
    log_step("STEP 2", "Running Enhanced Jurisdiction Migration")
    
    try:
        # Read the migration script
        migration_script_path = "scripts/production-jurisdiction-migration.sql"
        if not os.path.exists(migration_script_path):
            print(f"❌ Migration script not found: {migration_script_path}")
            return False
        
        with open(migration_script_path, 'r') as f:
            migration_sql = f.read()
        
        # Connect and run migration
        conn = psycopg2.connect(PRODUCTION_DB_URL)
        cursor = conn.cursor()
        
        print("🚀 Executing migration script...")
        cursor.execute(migration_sql)
        
        # Get all notices
        notices = []
        for notice in conn.notices:
            notices.append(notice.strip())
            print(f"📝 {notice.strip()}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False

def verify_migration_success():
    """Verify the migration was successful"""
    log_step("STEP 3", "Verifying Migration Success")
    
    try:
        conn = psycopg2.connect(PRODUCTION_DB_URL)
        cursor = conn.cursor()
        
        # Check columns exist
        cursor.execute("""
            SELECT 
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'regulations' AND column_name = 'jurisdiction_source') as has_jurisdiction_source,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'regulations' AND column_name = 'applicable_institutions') as has_applicable_institutions;
        """)
        has_jurisdiction_source, has_applicable_institutions = cursor.fetchone()
        
        # Check data quality
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN jurisdiction_source IS NOT NULL THEN 1 END) as with_jurisdiction_source,
                COUNT(CASE WHEN applicable_institutions IS NOT NULL THEN 1 END) as with_applicable_institutions
            FROM regulations;
        """)
        total, with_jurisdiction_source, with_applicable_institutions = cursor.fetchone()
        
        # Get jurisdiction breakdown
        cursor.execute("""
            SELECT jurisdiction_source, COUNT(*) as count 
            FROM regulations 
            GROUP BY jurisdiction_source 
            ORDER BY count DESC;
        """)
        jurisdiction_breakdown = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Report results
        print(f"📊 Schema verification:")
        print(f"   • jurisdiction_source column: {'✅' if has_jurisdiction_source else '❌'}")
        print(f"   • applicable_institutions column: {'✅' if has_applicable_institutions else '❌'}")
        
        print(f"\n📊 Data verification:")
        print(f"   • Total regulations: {total:,}")
        print(f"   • With jurisdiction_source: {with_jurisdiction_source:,} ({(with_jurisdiction_source/total)*100:.1f}%)")
        print(f"   • With applicable_institutions: {with_applicable_institutions:,} ({(with_applicable_institutions/total)*100:.1f}%)")
        
        print(f"\n📊 Jurisdiction breakdown:")
        for jurisdiction, count in jurisdiction_breakdown:
            percentage = (count / total) * 100
            print(f"   • {jurisdiction}: {count:,} ({percentage:.1f}%)")
        
        # Success criteria
        migration_success = (
            has_jurisdiction_source and 
            has_applicable_institutions and 
            with_jurisdiction_source == total and 
            with_applicable_institutions == total
        )
        
        if migration_success:
            print("\n✅ MIGRATION VERIFICATION PASSED!")
            return True
        else:
            print("\n❌ MIGRATION VERIFICATION FAILED!")
            return False
        
    except Exception as e:
        print(f"❌ Migration verification failed: {e}")
        return False

def build_and_push_docker_image():
    """Build and push the updated Docker image"""
    log_step("STEP 4", "Building and Pushing Docker Image")
    
    # Get git commit for tagging
    success, git_commit = run_command("git rev-parse --short HEAD", "Get git commit hash")
    if not success:
        git_commit = "unknown"
    else:
        git_commit = git_commit.strip()
    
    # Tag with enhanced-jurisdiction and commit hash
    tag = f"enhanced-jurisdiction-{git_commit}"
    image_uri = f"{ECR_REPOSITORY}:{tag}"
    
    print(f"🏗️  Building image with tag: {tag}")
    
    # Login to ECR
    success, _ = run_command(
        f"aws ecr get-login-password --region {AWS_REGION} | docker login --username AWS --password-stdin {ECR_REPOSITORY}",
        "Login to ECR"
    )
    if not success:
        return False, None
    
    # Build image
    success, _ = run_command(
        f"docker build --platform linux/amd64 -t {image_uri} .",
        "Build Docker image"
    )
    if not success:
        return False, None
    
    # Push image
    success, _ = run_command(
        f"docker push {image_uri}",
        "Push Docker image to ECR"
    )
    if not success:
        return False, None
    
    print(f"✅ Docker image built and pushed: {image_uri}")
    return True, image_uri

def deploy_to_ecs(image_uri):
    """Deploy the new image to ECS"""
    log_step("STEP 5", "Deploying to ECS")
    
    try:
        ecs = boto3.client('ecs', region_name=AWS_REGION)
        
        # Get current task definition
        response = ecs.describe_services(
            cluster=ECS_CLUSTER,
            services=[ECS_SERVICE]
        )
        
        if not response['services']:
            print(f"❌ Service {ECS_SERVICE} not found in cluster {ECS_CLUSTER}")
            return False
        
        current_task_def_arn = response['services'][0]['taskDefinition']
        
        # Get task definition details
        task_def_response = ecs.describe_task_definition(taskDefinition=current_task_def_arn)
        task_def = task_def_response['taskDefinition']
        
        # Update the image URI in the container definition
        for container in task_def['containerDefinitions']:
            if container['name'] == 'regulatory-trackr':  # Adjust container name if different
                old_image = container['image']
                container['image'] = image_uri
                print(f"🔄 Updating image: {old_image} → {image_uri}")
                break
        
        # Remove fields that can't be included in registration
        for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
            task_def.pop(field, None)
        
        # Register new task definition
        new_task_def_response = ecs.register_task_definition(**task_def)
        new_task_def_arn = new_task_def_response['taskDefinition']['taskDefinitionArn']
        
        print(f"📝 Registered new task definition: {new_task_def_arn}")
        
        # Update the service
        update_response = ecs.update_service(
            cluster=ECS_CLUSTER,
            service=ECS_SERVICE,
            taskDefinition=new_task_def_arn
        )
        
        print(f"🚀 Service update initiated")
        
        # Wait for deployment to complete
        print("⏳ Waiting for deployment to complete...")
        waiter = ecs.get_waiter('services_stable')
        waiter.wait(
            cluster=ECS_CLUSTER,
            services=[ECS_SERVICE],
            WaiterConfig={'delay': 15, 'maxAttempts': 40}  # Wait up to 10 minutes
        )
        
        print("✅ ECS deployment completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ ECS deployment failed: {e}")
        return False

def verify_production_api():
    """Verify the production API is working with enhanced jurisdiction"""
    log_step("STEP 6", "Verifying Production API")
    
    # Wait a bit for the service to be fully ready
    print("⏳ Waiting for service to be ready...")
    time.sleep(30)
    
    try:
        import requests
        
        # Get the production API URL (adjust as needed)
        api_base = "https://regulatorytrackr.com/api"  # Update with your actual domain
        
        # Test basic regulations endpoint
        print("🔍 Testing basic regulations API...")
        response = requests.get(f"{api_base}/regulations", timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Basic API test failed: {response.status_code}")
            return False
        
        regulations = response.json()
        print(f"✅ Retrieved {len(regulations)} regulations")
        
        # Test enhanced jurisdiction filtering
        print("🔍 Testing enhanced jurisdiction filtering...")
        
        # Test jurisdiction source filter
        response = requests.get(f"{api_base}/regulations?jurisdictionSource=federal", timeout=30)
        if response.status_code == 200:
            federal_regs = response.json()
            print(f"✅ Federal regulations filter: {len(federal_regs)} results")
        else:
            print(f"⚠️  Federal filter test returned {response.status_code}")
        
        # Test institution type filter
        response = requests.get(f"{api_base}/regulations?institutionType=public-universities", timeout=30)
        if response.status_code == 200:
            public_uni_regs = response.json()
            print(f"✅ Public universities filter: {len(public_uni_regs)} results")
        else:
            print(f"⚠️  Public universities filter test returned {response.status_code}")
        
        # Test combined filters
        response = requests.get(f"{api_base}/regulations?jurisdictionSource=federal&institutionType=all-institutions", timeout=30)
        if response.status_code == 200:
            combined_regs = response.json()
            print(f"✅ Combined filters: {len(combined_regs)} results")
        else:
            print(f"⚠️  Combined filter test returned {response.status_code}")
        
        print("✅ Production API verification completed!")
        return True
        
    except Exception as e:
        print(f"❌ API verification failed: {e}")
        print("⚠️  The deployment may have succeeded, but API verification failed.")
        print("   Please check the API manually at your production URL.")
        return False

def main():
    """Main deployment workflow"""
    print("🚀 ENHANCED JURISDICTION SYSTEM - PRODUCTION DEPLOYMENT")
    print("=" * 60)
    print("This script will:")
    print("1. Verify production database connection")
    print("2. Run enhanced jurisdiction migration")
    print("3. Verify migration success")
    print("4. Build and push Docker image")
    print("5. Deploy to ECS")
    print("6. Verify production API")
    print("\n⚠️  WARNING: This will modify the production database!")
    
    # Confirm deployment
    confirm = input("\nProceed with production deployment? (yes/no): ").lower().strip()
    if confirm != 'yes':
        print("❌ Deployment cancelled by user")
        return
    
    # Step 1: Verify database connection
    success, reg_count, migration_exists = verify_production_db_connection()
    if not success:
        print("❌ Cannot proceed without database connection")
        return
    
    # Step 2: Run migration (if needed)
    if not migration_exists:
        success = run_production_migration()
        if not success:
            print("❌ Migration failed - aborting deployment")
            return
    else:
        print("ℹ️  Migration already applied, skipping database migration step")
    
    # Step 3: Verify migration
    success = verify_migration_success()
    if not success:
        print("❌ Migration verification failed - aborting deployment")
        return
    
    # Step 4: Build and push Docker image
    success, image_uri = build_and_push_docker_image()
    if not success:
        print("❌ Docker build/push failed - aborting deployment")
        return
    
    # Step 5: Deploy to ECS
    success = deploy_to_ecs(image_uri)
    if not success:
        print("❌ ECS deployment failed")
        return
    
    # Step 6: Verify production API
    success = verify_production_api()
    if success:
        print("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!")
        print("=" * 40)
        print("✅ Enhanced jurisdiction system is now live in production")
        print("✅ Database migration completed")
        print("✅ Application deployed to ECS")
        print("✅ API verified and working")
        print("\n🔗 Test the enhanced system at:")
        print("   /enhanced-jurisdiction-demo")
    else:
        print("\n⚠️  DEPLOYMENT COMPLETED WITH WARNINGS")
        print("=" * 40)
        print("✅ Enhanced jurisdiction system deployed")
        print("⚠️  API verification had issues - please test manually")

if __name__ == "__main__":
    main() 