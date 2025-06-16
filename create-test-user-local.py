#!/usr/bin/env python3
"""Create a test user in the local Neon database with known credentials"""

import psycopg2
import hashlib
import secrets
import os

# Local Neon database (from docker-compose.dev.yml)
LOCAL_DB_CONFIG = {
    'host': 'ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech',
    'database': 'neondb',
    'user': 'neondb_owner',
    'password': 'npg_foSr6ixkzw7W',
    'port': 5432
}

def hash_password_scrypt(password: str) -> str:
    """Create a password hash using scrypt to match the application's auth.ts"""
    # Generate 16-byte salt as hex (like the application)
    salt = secrets.token_hex(16)
    
    # Use scrypt with the same parameters as auth.ts: N=16384, r=8, p=1, dkLen=64
    # These are the default parameters for scrypt
    dk = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=64)
    
    # Return in the format: hexbuffer.salt (like auth.ts)
    return f"{dk.hex()}.{salt}"

def main():
    try:
        print('👤 Creating test user in local Neon database...')
        
        # Connect to local database
        local_conn = psycopg2.connect(**LOCAL_DB_CONFIG)
        local_cursor = local_conn.cursor()
        
        print('✅ Connected to local Neon database')
        
        # Check if developer user already exists
        local_cursor.execute('SELECT id, username FROM users WHERE username = %s', ('developer',))
        existing_user = local_cursor.fetchone()
        
        if existing_user:
            print(f'👤 User "developer" already exists with ID {existing_user[0]}')
            print('🧹 Updating password...')
            
            # Update existing user's password
            new_password_hash = hash_password_scrypt('admin123')
            local_cursor.execute(
                'UPDATE users SET password = %s, updated_at = NOW() WHERE username = %s',
                (new_password_hash, 'developer')
            )
        else:
            print('🆕 Creating new user "developer"...')
            
            # Create new user
            new_password_hash = hash_password_scrypt('admin123')
            local_cursor.execute('''
                INSERT INTO users (username, password, role, email, "firstName", "lastName", department)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', ('developer', new_password_hash, 'admin', 'dev@test.com', 'Test', 'Developer', 'IT'))
        
        # Also create/update testuser
        local_cursor.execute('SELECT id, username FROM users WHERE username = %s', ('testuser',))
        existing_testuser = local_cursor.fetchone()
        
        if existing_testuser:
            print(f'👤 User "testuser" already exists with ID {existing_testuser[0]}')
            print('🧹 Updating password...')
            
            # Update existing user's password
            new_password_hash = hash_password_scrypt('test123')
            local_cursor.execute(
                'UPDATE users SET password = %s, updated_at = NOW() WHERE username = %s',
                (new_password_hash, 'testuser')
            )
        else:
            print('🆕 Creating new user "testuser"...')
            
            # Create new user
            new_password_hash = hash_password_scrypt('test123')
            local_cursor.execute('''
                INSERT INTO users (username, password, role, email, "firstName", "lastName", department)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', ('testuser', new_password_hash, 'user', 'test@test.com', 'Test', 'User', 'Testing'))
        
        # Commit the changes
        local_conn.commit()
        
        print('\n✅ Test users created/updated successfully!')
        print('🔐 Credentials:')
        print('   Username: developer, Password: admin123 (admin role)')
        print('   Username: testuser, Password: test123 (user role)')
        
        # Verify the users exist
        local_cursor.execute('SELECT id, username, role, email FROM users WHERE username IN (%s, %s)', ('developer', 'testuser'))
        test_users = local_cursor.fetchall()
        
        print('\n👥 Test users in database:')
        for user in test_users:
            print(f'   ID: {user[0]}, Username: {user[1]}, Role: {user[2]}, Email: {user[3]}')
        
        local_cursor.close()
        local_conn.close()
        
        print('\n🎉 Ready to test deadlines endpoint with authentication!')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 