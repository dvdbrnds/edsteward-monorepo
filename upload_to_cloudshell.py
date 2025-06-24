#!/usr/bin/env python3

import os
import zipfile
from pathlib import Path

def create_migration_package():
    """Create a ZIP package for CloudShell upload"""
    
    print("📦 Creating CloudShell migration package...")
    
    # Files to include in the package
    files_to_include = [
        'cloudshell_migration_setup.sh',
        'sql_dump/full_schema.sql',
        'sql_dump/users_data.sql',
        'exports/regulations.sql',
        'exports/notes.sql',
        'exports/guides.sql',
        'exports/deadlines.sql',
    ]
    
    # Create the ZIP file
    zip_path = 'cloudshell_migration_package.zip'
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        
        # Add the setup script
        if os.path.exists('cloudshell_migration_setup.sh'):
            zipf.write('cloudshell_migration_setup.sh')
            print("✅ Added setup script")
        
        # Add SQL files if they exist
        for file_path in files_to_include[1:]:  # Skip the setup script
            if os.path.exists(file_path):
                # Keep directory structure in ZIP
                zipf.write(file_path)
                print(f"✅ Added {file_path}")
            else:
                print(f"⚠️ File not found: {file_path}")
        
        # Add a README for CloudShell
        readme_content = """# CloudShell Database Migration

## Quick Start:

1. Extract this ZIP file in CloudShell
2. Run: bash cloudshell_migration_setup.sh
3. Follow the instructions

## Files included:
- cloudshell_migration_setup.sh: Setup script
- sql_dump/: Database schema and user data
- exports/: Additional data files

## Connection Details:
- Host: edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com
- Database: postgres
- User: postgres
- SSL Mode: prefer

This package migrates your local database to AWS RDS.
"""
        
        zipf.writestr('README.md', readme_content)
        print("✅ Added README.md")
    
    file_size = os.path.getsize(zip_path) / 1024  # KB
    print(f"\n🎉 Package created: {zip_path} ({file_size:.1f} KB)")
    print("\n📋 Next steps:")
    print("1. Open AWS CloudShell in your browser")
    print("2. Upload this ZIP file to CloudShell")
    print("3. Extract and run the migration")
    
    return zip_path

if __name__ == "__main__":
    create_migration_package()