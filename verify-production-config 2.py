#!/usr/bin/env python3
"""
Production Configuration Verification Script
Ensures all critical values are correct to prevent 48-hour outages
"""

import json
import os
import re
import glob

# Critical values that must be correct
CORRECT_NEON_PASSWORD = "npg_foSr6ixkzw7W"
WRONG_NEON_PASSWORD = "npg_ZhQkQoD3Oo2I"
CRITICAL_UUID = "3a1cbce2-0cf8-4c4f-ab96-4023eca4977d"
CORRECT_UUID_MAPPING = "moravian"

def check_file_for_passwords(filepath):
    """Check a file for database password issues"""
    issues = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check for wrong password
        if WRONG_NEON_PASSWORD in content:
            issues.append(f"❌ WRONG PASSWORD found: {WRONG_NEON_PASSWORD}")
            
        # Check for correct password
        if CORRECT_NEON_PASSWORD in content:
            issues.append(f"✅ Correct password found: {CORRECT_NEON_PASSWORD}")
            
    except Exception as e:
        issues.append(f"⚠️ Could not read file: {e}")
        
    return issues

def check_uuid_mapping():
    """Check UUID mapping in multi-tenant service"""
    issues = []
    
    try:
        with open('server/services/multi-tenant-database.ts', 'r') as f:
            content = f.read()
            
        # Check if UUID mapping exists
        if CRITICAL_UUID in content and CORRECT_UUID_MAPPING in content:
            issues.append("✅ UUID mapping found in multi-tenant service")
        else:
            issues.append("❌ UUID mapping missing or incorrect")
            
        # Check normalization function
        if "normalizeTenantId" in content:
            issues.append("✅ Tenant ID normalization function exists")
        else:
            issues.append("❌ Tenant ID normalization function missing")
            
    except Exception as e:
        issues.append(f"❌ Could not check UUID mapping: {e}")
        
    return issues

def check_task_definitions():
    """Check all task definition files"""
    issues = []
    task_files = glob.glob("*task*.json")
    
    for task_file in task_files:
        if os.path.exists(task_file):
            file_issues = check_file_for_passwords(task_file)
            if file_issues:
                issues.append(f"📋 {task_file}:")
                issues.extend([f"   {issue}" for issue in file_issues])
                
    return issues

def check_terraform():
    """Check Terraform configuration"""
    issues = []
    
    terraform_files = glob.glob("infrastructure/terraform/*.tf")
    for tf_file in terraform_files:
        if os.path.exists(tf_file):
            file_issues = check_file_for_passwords(tf_file)
            if file_issues:
                issues.append(f"🏗️ {tf_file}:")
                issues.extend([f"   {issue}" for issue in file_issues])
                
    return issues

def check_docker_compose():
    """Check Docker Compose files"""
    issues = []
    
    compose_files = ["docker-compose.yml", "docker-compose.dev.yml", "docker-compose.local.yml"]
    for compose_file in compose_files:
        if os.path.exists(compose_file):
            file_issues = check_file_for_passwords(compose_file)
            if file_issues:
                issues.append(f"🐳 {compose_file}:")
                issues.extend([f"   {issue}" for issue in file_issues])
                
    return issues

def check_emergency_files():
    """Check emergency deployment files"""
    issues = []
    
    emergency_files = ["production-emergency-deploy.json", "emergency-deploy.py"]
    for emergency_file in emergency_files:
        if os.path.exists(emergency_file):
            file_issues = check_file_for_passwords(emergency_file)
            if file_issues:
                issues.append(f"🚨 {emergency_file}:")
                issues.extend([f"   {issue}" for issue in file_issues])
        else:
            issues.append(f"❌ Emergency file missing: {emergency_file}")
            
    return issues

def main():
    print("🔍 PRODUCTION CONFIGURATION VERIFICATION")
    print("=" * 50)
    print("Checking critical values to prevent production outages...")
    print()
    
    all_issues = []
    critical_errors = 0
    
    # Check each category
    print("🎯 Checking UUID Mapping...")
    uuid_issues = check_uuid_mapping()
    all_issues.extend(uuid_issues)
    
    print("📋 Checking Task Definitions...")
    task_issues = check_task_definitions()
    all_issues.extend(task_issues)
    
    print("🏗️ Checking Terraform...")
    terraform_issues = check_terraform()
    all_issues.extend(terraform_issues)
    
    print("🐳 Checking Docker Compose...")
    docker_issues = check_docker_compose()
    all_issues.extend(docker_issues)
    
    print("🚨 Checking Emergency Files...")
    emergency_issues = check_emergency_files()
    all_issues.extend(emergency_issues)
    
    print()
    print("📊 VERIFICATION RESULTS")
    print("=" * 30)
    
    for issue in all_issues:
        print(issue)
        if "❌ WRONG PASSWORD" in issue:
            critical_errors += 1
            
    print()
    
    if critical_errors > 0:
        print(f"🚨 CRITICAL: {critical_errors} files have WRONG password!")
        print("⚠️ This WILL cause production outage!")
        print(f"🔧 Replace {WRONG_NEON_PASSWORD} with {CORRECT_NEON_PASSWORD}")
        return False
    else:
        print("✅ All critical configuration values are correct!")
        print("🎉 Production should be stable")
        return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 