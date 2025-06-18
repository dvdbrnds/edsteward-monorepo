#!/usr/bin/env python3
import boto3
import json
import time

def main():
    print("🔧 FIXING DATABASE VIA ECS CONTAINER")
    print("Running database setup commands inside ECS...")
    print("=" * 50)
    
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    # Get running task
    task_arn = get_running_task(ecs)
    if not task_arn:
        print("❌ No running tasks found!")
        return
    
    print(f"📦 Using task: {task_arn.split('/')[-1]}")
    
    # Create database setup script
    db_script = create_database_script()
    
    # Execute the script inside the container
    execute_in_container(ecs, task_arn, db_script)

def get_running_task(ecs):
    try:
        response = ecs.list_tasks(
            cluster='edsteward-cluster',
            serviceName='edsteward-service',
            desiredStatus='RUNNING'
        )
        
        if response['taskArns']:
            return response['taskArns'][0]
        return None
    except Exception as e:
        print(f"❌ Error getting tasks: {e}")
        return None

def create_database_script():
    return '''
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'edsteward',
    user: process.env.DB_USER || 'edsteward',
    password: process.env.DB_PASSWORD || 'edsteward123',
    ssl: false
});

async function setupDatabase() {
    console.log('🔧 Setting up database tables...');
    
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                role VARCHAR(100) DEFAULT 'user',
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Users table created');
        
        // Create system_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                level INTEGER NOT NULL,
                message TEXT NOT NULL,
                user_id INTEGER,
                username VARCHAR(255),
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ System_logs table created');
        
        // Create admin user (password: admin123)
        const passwordHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
        await pool.query(`
            INSERT INTO users (username, password_hash, role, email)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET 
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                updated_at = CURRENT_TIMESTAMP;
        `, ['admin', passwordHash, 'admin', 'admin@edsteward.ai']);
        console.log('✅ Admin user created/updated');
        
        // Verify setup
        const userResult = await pool.query('SELECT username, role FROM users WHERE username = $1', ['admin']);
        if (userResult.rows.length > 0) {
            console.log('✅ Admin user verified:', userResult.rows[0]);
        }
        
        const tableResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'system_logs')
            ORDER BY table_name;
        `);
        console.log('✅ Tables verified:', tableResult.rows.map(r => r.table_name));
        
        console.log('🎉 Database setup complete!');
        
    } catch (error) {
        console.error('❌ Database setup error:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase();
'''

def execute_in_container(ecs, task_arn, script):
    try:
        print("📝 Creating database setup script in container...")
        
        # Write the script to a file in the container
        command1 = [
            'sh', '-c', 
            f'cat > /tmp/setup_db.js << \'EOF\'\n{script}\nEOF'
        ]
        
        response1 = ecs.execute_command(
            cluster='edsteward-cluster',
            task=task_arn,
            container='edsteward-container',
            command=command1,
            interactive=False
        )
        
        print("✅ Script created in container")
        
        # Execute the script
        print("🚀 Executing database setup...")
        
        command2 = ['node', '/tmp/setup_db.js']
        
        response2 = ecs.execute_command(
            cluster='edsteward-cluster',
            task=task_arn,
            container='edsteward-container',
            command=command2,
            interactive=False
        )
        
        print("✅ Database setup command executed")
        print("📝 Check the container logs for results...")
        
        # Clean up
        command3 = ['rm', '/tmp/setup_db.js']
        ecs.execute_command(
            cluster='edsteward-cluster',
            task=task_arn,
            container='edsteward-container',
            command=command3,
            interactive=False
        )
        
        print("🧹 Cleanup completed")
        
    except Exception as e:
        print(f"❌ Error executing in container: {e}")
        print("💡 Make sure ECS Exec is enabled for the service")

if __name__ == "__main__":
    main()
    
    print(f"\n💡 NEXT STEPS:")
    print(f"1. Check container logs to see if database setup succeeded")
    print(f"2. Try logging in with admin/admin123")
    print(f"3. If still failing, the issue might be elsewhere") 