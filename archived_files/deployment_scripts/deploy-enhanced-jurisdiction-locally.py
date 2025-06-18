#!/usr/bin/env python3
"""
Enhanced Jurisdiction System - Local Deployment
===============================================
Deploy the enhanced jurisdiction system to the local development environment
"""

import psycopg2
import subprocess
import time
import json
import os
import sys
from datetime import datetime

# Configuration - using your local Neon database
LOCAL_DB_URL = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

def log_step(step, message):
    """Log a deployment step with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{timestamp}] {step}: {message}")
    print("=" * 60)

def run_command(command, description, check=True):
    """Run a command with error handling"""
    print(f"Running: {description}")
    print(f"Command: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=check)
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

def verify_local_db_connection():
    """Verify we can connect to the local Neon database"""
    log_step("STEP 1", "Verifying Local Database Connection")
    
    try:
        conn = psycopg2.connect(LOCAL_DB_URL)
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
        
        print(f"✅ Connected to local Neon database")
        print(f"📊 Current regulation count: {reg_count:,}")
        print(f"🔄 Migration status: {'Already applied' if migration_exists else 'Needs to be applied'}")
        
        return True, reg_count, migration_exists
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, 0, False

def run_local_migration():
    """Run the enhanced jurisdiction migration on the local database"""
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
        conn = psycopg2.connect(LOCAL_DB_URL)
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
        conn = psycopg2.connect(LOCAL_DB_URL)
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

def check_if_dev_server_running():
    """Check if the development server is currently running"""
    log_step("STEP 4", "Checking Development Server Status")
    
    try:
        import requests
        response = requests.get("http://localhost:3000", timeout=5)
        print("✅ Development server is running on port 3000")
        return True, 3000
    except:
        try:
            import requests
            response = requests.get("http://localhost:5173", timeout=5)
            print("✅ Development server is running on port 5173 (Vite)")
            return True, 5173
        except:
            print("ℹ️  Development server is not currently running")
            return False, None

def restart_dev_environment():
    """Guide user to restart their development environment"""
    log_step("STEP 5", "Restarting Development Environment")
    
    print("🔄 To pick up the enhanced jurisdiction changes, please restart your development server:")
    print("\n1. Stop your current development server (Ctrl+C in the terminal where it's running)")
    print("2. Restart it with:")
    print("   npm run dev")
    print("\n⏳ Waiting for you to restart the server...")
    print("   (Press Enter once you've restarted the development server)")
    
    input()  # Wait for user to restart
    
    # Try to verify the server is back up
    print("🔍 Checking if server is back online...")
    time.sleep(3)
    
    running, port = check_if_dev_server_running()
    if running:
        print(f"✅ Development server is running on port {port}")
        return True
    else:
        print("⚠️  Could not detect the development server. Please ensure it's running.")
        return False

def test_enhanced_jurisdiction_api():
    """Test the enhanced jurisdiction API endpoints"""
    log_step("STEP 6", "Testing Enhanced Jurisdiction API")
    
    try:
        import requests
        
        # Try both common development ports
        base_urls = ["http://localhost:3000", "http://localhost:5173"]
        api_base = None
        
        for base_url in base_urls:
            try:
                response = requests.get(f"{base_url}/api/regulations", timeout=10)
                if response.status_code == 200:
                    api_base = f"{base_url}/api"
                    break
            except:
                continue
        
        if not api_base:
            print("❌ Could not connect to the API. Please ensure your development server is running.")
            return False
        
        print(f"✅ Connected to API at {api_base}")
        
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
        
        print("✅ Enhanced jurisdiction API verification completed!")
        return True
        
    except Exception as e:
        print(f"❌ API verification failed: {e}")
        print("⚠️  The migration may have succeeded, but API verification failed.")
        return False

def main():
    """Main local deployment workflow"""
    print("🚀 ENHANCED JURISDICTION SYSTEM - LOCAL DEPLOYMENT")
    print("=" * 60)
    print("This script will:")
    print("1. Verify local database connection")
    print("2. Run enhanced jurisdiction migration")
    print("3. Verify migration success")
    print("4. Guide you through restarting the dev server")
    print("5. Test the enhanced jurisdiction API")
    print("\n⚠️  This will modify your local Neon database!")
    
    # Confirm deployment
    confirm = input("\nProceed with local deployment? (yes/no): ").lower().strip()
    if confirm != 'yes':
        print("❌ Deployment cancelled by user")
        return
    
    # Step 1: Verify database connection
    success, reg_count, migration_exists = verify_local_db_connection()
    if not success:
        print("❌ Cannot proceed without database connection")
        return
    
    # Step 2: Run migration (if needed)
    if not migration_exists:
        success = run_local_migration()
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
    
    # Step 4: Check dev server status
    running, port = check_if_dev_server_running()
    
    # Step 5: Guide restart if needed
    if running:
        print("ℹ️  Development server is running. You may need to restart it to pick up changes.")
        restart_choice = input("Would you like to restart it now? (yes/no): ").lower().strip()
        if restart_choice == 'yes':
            restart_dev_environment()
    else:
        restart_dev_environment()
    
    # Step 6: Test API
    success = test_enhanced_jurisdiction_api()
    
    if success:
        print("\n🎉 LOCAL DEPLOYMENT COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        print("✅ Enhanced jurisdiction system is now live locally")
        print("✅ Database migration completed")
        print("✅ API verified and working")
        print("\n🔗 Test the enhanced system at:")
        print("   http://localhost:3000/enhanced-jurisdiction-demo")
        print("   or")
        print("   http://localhost:5173/enhanced-jurisdiction-demo")
        print("\n🎯 Features now available:")
        print("   • Dual-dimension filtering (source + institution type)")
        print("   • Enhanced regulation categorization")
        print("   • Interactive demo page")
        print("   • Backward compatible API")
    else:
        print("\n⚠️  DEPLOYMENT COMPLETED WITH WARNINGS")
        print("=" * 40)
        print("✅ Enhanced jurisdiction system deployed")
        print("⚠️  API verification had issues - please test manually")
        print("\n🔗 Try accessing:")
        print("   http://localhost:3000/enhanced-jurisdiction-demo")

if __name__ == "__main__":
    main() 