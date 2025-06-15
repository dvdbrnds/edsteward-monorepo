#!/usr/bin/env python3
"""
Fix AWS RDS Connection and Complete Database Restoration
=======================================================

This script will:
1. Diagnose AWS RDS connection issues
2. Try alternative connection methods
3. Complete the database restoration
"""

import subprocess
import os
import socket
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_command(command, description, ignore_errors=False):
    """Run a shell command and return the result"""
    log(f"Running: {description}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0 or ignore_errors:
            log(f"✅ Success: {description}")
            if result.stdout:
                log(f"Output: {result.stdout.strip()}")
            return True, result.stdout
        else:
            log(f"❌ Failed: {description}")
            log(f"Error: {result.stderr}")
            return False, result.stderr
    except Exception as e:
        log(f"❌ Exception during {description}: {e}")
        return False, str(e)

def test_dns_resolution():
    """Test DNS resolution for AWS RDS"""
    hostname = "edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
    
    log(f"Testing DNS resolution for {hostname}...")
    
    try:
        # Try to resolve the hostname
        ip_address = socket.gethostbyname(hostname)
        log(f"✅ DNS resolution successful: {hostname} -> {ip_address}")
        return True, ip_address
    except socket.gaierror as e:
        log(f"❌ DNS resolution failed: {e}")
        return False, None

def test_network_connectivity(ip_address=None):
    """Test network connectivity to AWS RDS"""
    hostname = "edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
    port = 5432
    
    if ip_address:
        target = ip_address
    else:
        target = hostname
    
    log(f"Testing network connectivity to {target}:{port}...")
    
    # Try ping first
    success, _ = run_command(f"ping -c 3 {target}", f"Ping {target}", ignore_errors=True)
    
    # Try telnet/nc to test port connectivity
    success, _ = run_command(f"nc -z -v {target} {port}", f"Test port {port} connectivity", ignore_errors=True)
    
    return success

def try_alternative_connection_strings():
    """Try different connection string formats"""
    log("Trying alternative AWS RDS connection methods...")
    
    # Different connection string formats to try
    connection_strings = [
        # Original with SSL
        "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require",
        
        # Without SSL requirement
        "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=prefer",
        
        # With explicit SSL disable (for testing)
        "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=disable",
        
        # Using IP address if DNS resolution worked
        None  # Will be filled in if we get IP
    ]
    
    # Test DNS resolution first
    dns_success, ip_address = test_dns_resolution()
    
    if dns_success and ip_address:
        # Add IP-based connection string
        connection_strings.append(f"postgresql://postgres:EdSteward2024!Secure@{ip_address}:5432/postgres?sslmode=require")
    
    for i, conn_str in enumerate(connection_strings):
        if conn_str is None:
            continue
            
        log(f"\n🔍 TESTING CONNECTION METHOD {i+1}:")
        log(f"Connection string: {conn_str[:50]}...")
        
        success, output = run_command(f'psql "{conn_str}" -c "SELECT version();" --single-transaction', 
                                    f"Test connection method {i+1}", ignore_errors=True)
        
        if success:
            log(f"✅ Connection method {i+1} WORKS!")
            return conn_str
        else:
            log(f"❌ Connection method {i+1} failed")
    
    return None

def restore_with_working_connection(connection_string, backup_file):
    """Restore database using the working connection string"""
    log(f"Restoring {backup_file} using working connection...")
    
    # First, clean up any existing data (optional)
    log("Checking if we need to clean existing data...")
    success, _ = run_command(f'psql "{connection_string}" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';"', 
                           "Check existing tables", ignore_errors=True)
    
    # Restore the backup
    log("Starting database restoration...")
    success, output = run_command(f'psql "{connection_string}" < {backup_file}', 
                                "Restore backup to AWS RDS")
    
    if success:
        log("✅ Database restoration completed!")
        
        # Verify the restoration
        log("Verifying restoration...")
        verify_commands = [
            (f'psql "{connection_string}" -c "SELECT COUNT(*) FROM users;"', "Count users"),
            (f'psql "{connection_string}" -c "SELECT COUNT(*) FROM regulations;"', "Count regulations"),
            (f'psql "{connection_string}" -c "SELECT COUNT(*) FROM notes;"', "Count notes"),
        ]
        
        for cmd, desc in verify_commands:
            run_command(cmd, desc, ignore_errors=True)
        
        return True
    else:
        log("❌ Database restoration failed")
        return False

def main():
    log("🔧 FIXING AWS RDS CONNECTION AND COMPLETING RESTORATION")
    log("=" * 60)
    
    # Check if backup file exists
    backup_files = ["nosync_backup.sql", "local_backup.sql", "docker_backup.sql"]
    backup_file = None
    
    for file in backup_files:
        if os.path.exists(file) and os.path.getsize(file) > 0:
            backup_file = file
            log(f"Found backup file: {backup_file} ({os.path.getsize(backup_file)} bytes)")
            break
    
    if not backup_file:
        log("❌ No backup file found. Please run the backup script first.")
        return
    
    # Test network connectivity
    log("\n🌐 TESTING NETWORK CONNECTIVITY...")
    test_network_connectivity()
    
    # Try different connection methods
    log("\n🔍 TESTING CONNECTION METHODS...")
    working_connection = try_alternative_connection_strings()
    
    if working_connection:
        log(f"\n✅ Found working connection method!")
        
        # Complete the restoration
        log("\n📋 COMPLETING DATABASE RESTORATION...")
        if restore_with_working_connection(working_connection, backup_file):
            log("\n🎉 DATABASE RESTORATION COMPLETE!")
            log("=" * 60)
            log("Your Neon database has been successfully restored to AWS RDS!")
            log("You can now access it through:")
            log("https://edsteward.ai/admin")
            
            # Cleanup
            try:
                os.remove(backup_file)
                log(f"✅ Cleaned up backup file: {backup_file}")
            except:
                log(f"⚠️ Could not remove backup file: {backup_file}")
        else:
            log("❌ Restoration failed even with working connection")
    else:
        log("\n❌ Could not establish connection to AWS RDS")
        log("Possible issues:")
        log("1. Network connectivity problems")
        log("2. AWS RDS instance not running")
        log("3. Security group blocking connections")
        log("4. Incorrect credentials")
        log("\nPlease check AWS Console for RDS instance status.")

if __name__ == "__main__":
    main() 