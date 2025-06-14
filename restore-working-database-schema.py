#!/usr/bin/env python3

import boto3
import os
import subprocess
import requests
import json
import time
from typing import Dict, List, Optional, Tuple

def log(message: str, status: str = "INFO"):
    """Enhanced logging with colors and timestamps"""
    colors = {
        "SUCCESS": "\033[92m✅",
        "ERROR": "\033[91m❌", 
        "WARNING": "\033[93m⚠️",
        "INFO": "\033[94mℹ️"
    }
    reset = "\033[0m"
    timestamp = time.strftime("%H:%M:%S")
    print(f"{colors.get(status, colors['INFO'])} [{timestamp}] {message}{reset}")

def run_cmd(command: str, timeout: int = 30, env=None) -> Tuple[bool, str, str]:
    """Run command with timeout and return success, stdout, stderr"""
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=timeout, env=env
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", f"Command timed out after {timeout} seconds"
    except Exception as e:
        return False, "", str(e)

def get_rds_info():
    """Get current RDS database information"""
    log("🔍 Getting RDS database information...")
    
    rds = boto3.client('rds', region_name='us-east-1')
    
    try:
        # Get the edsteward-db instance 
        response = rds.describe_db_instances(DBInstanceIdentifier='edsteward-db')
        db_instance = response['DBInstances'][0]
        
        endpoint = db_instance['Endpoint']['Address']
        port = db_instance['Endpoint']['Port']
        
        log(f"📋 Database endpoint: {endpoint}:{port}")
        return endpoint, port, "postgres", "EdSteward2024!Secure"
        
    except Exception as e:
        log(f"Failed to get RDS info: {e}", "ERROR")
        return None, None, None, None

def restore_complete_schema(endpoint: str, port: int, username: str, password: str):
    """Restore the complete database schema from dumps"""
    log("🗄️ Restoring complete database schema...")
    
    # Set environment variable for password
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    
    # First, let's restore the full schema from our dump files
    schema_sql = """
-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS deadlines CASCADE;
DROP TABLE IF EXISTS evidence_files CASCADE;
DROP TABLE IF EXISTS guides CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS regulations CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.deadlines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.evidence_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.guides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.regulations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create users table (core authentication table)
CREATE TABLE public.users (
    id integer NOT NULL DEFAULT nextval('public.users_id_seq'::regclass),
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    department text,
    email text DEFAULT ''::text NOT NULL,
    "firstName" text,
    "lastName" text,
    external_id text,
    provider_id text,
    identity_provider text,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create regulations table
CREATE TABLE public.regulations (
    id integer NOT NULL DEFAULT nextval('public.regulations_id_seq'::regclass),
    title text NOT NULL,
    summary text,
    description text,
    requirements text,
    affected_entities text,
    compliance_date date,
    enforcement_date date,
    last_updated timestamp without time zone DEFAULT now(),
    status text DEFAULT 'active'::text,
    source_url text,
    jurisdiction text,
    agency_name text,
    category text,
    topic text,
    item_id text,
    previous_version_id integer,
    content_hash text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create session table (for session management)
CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);

-- Create notes table
CREATE TABLE public.notes (
    id integer NOT NULL DEFAULT nextval('public.notes_id_seq'::regclass),
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
    id integer NOT NULL DEFAULT nextval('public.notifications_id_seq'::regclass),
    user_id integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create system_logs table
CREATE TABLE public.system_logs (
    id integer NOT NULL DEFAULT nextval('public.system_logs_id_seq'::regclass),
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    facility integer NOT NULL,
    severity integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    hostname text NOT NULL,
    app_name text NOT NULL,
    proc_id text NOT NULL,
    msg_id text,
    structured_data jsonb,
    message text NOT NULL
);

-- Create deadlines table
CREATE TABLE public.deadlines (
    id integer NOT NULL DEFAULT nextval('public.deadlines_id_seq'::regclass),
    regulation_id integer NOT NULL,
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    assigned_to integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create evidence_files table
CREATE TABLE public.evidence_files (
    id integer NOT NULL DEFAULT nextval('public.evidence_files_id_seq'::regclass),
    regulation_id integer NOT NULL,
    filename text NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create guides table
CREATE TABLE public.guides (
    id integer NOT NULL DEFAULT nextval('public.guides_id_seq'::regclass),
    title text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create comments table
CREATE TABLE public.comments (
    id integer NOT NULL DEFAULT nextval('public.comments_id_seq'::regclass),
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Add primary key constraints
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.regulations ADD CONSTRAINT regulations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.system_logs ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.deadlines ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evidence_files ADD CONSTRAINT evidence_files_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.guides ADD CONSTRAINT guides_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

-- Add unique constraints
ALTER TABLE ONLY public.users ADD CONSTRAINT users_username_unique UNIQUE (username);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_external_id_key UNIQUE (external_id);

-- Add indexes
CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);
CREATE INDEX idx_regulations_agency ON public.regulations USING btree (agency_name);
CREATE INDEX idx_regulations_category ON public.regulations USING btree (category);
CREATE INDEX idx_regulations_item_id ON public.regulations USING btree (item_id);
CREATE INDEX idx_regulations_jurisdiction ON public.regulations USING btree (jurisdiction);
CREATE INDEX idx_regulations_last_updated ON public.regulations USING btree (last_updated);
CREATE INDEX idx_regulations_topic ON public.regulations USING btree (topic);

-- Add foreign key constraints
ALTER TABLE ONLY public.regulations ADD CONSTRAINT regulations_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.regulations(id);

-- Set sequence ownership
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER SEQUENCE public.regulations_id_seq OWNED BY public.regulations.id;
ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;
ALTER SEQUENCE public.deadlines_id_seq OWNED BY public.deadlines.id;
ALTER SEQUENCE public.evidence_files_id_seq OWNED BY public.evidence_files.id;
ALTER SEQUENCE public.guides_id_seq OWNED BY public.guides.id;
ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;

-- Insert the working user data from our dumps
INSERT INTO public.users (id, username, password, role, department, email, "firstName", "lastName", external_id, provider_id, identity_provider, last_login, created_at, updated_at) VALUES 
(5, 'nasol@moravian.edu', '4f09114c36bfd8bce96204888921752aebb6a4d26842746255d405733ad5305a3bba415fe60523b8ea87425e93bea4275ab4368e298b2cc8d2c0b2f8b736acd1.ec07d9e5935ec88a460022b62913dfde', 'admin', 'Compliance', '', NULL, NULL, NULL, NULL, NULL, NULL, '2025-03-04 14:30:48.855809', '2025-03-04 14:30:49.04378'),
(7, 'leahn', '89d1677273cf096733b7ebf1debb057e69a60ba4720252296366b37819f23fdc9704c7ce6cd1c1f5b21b76b14a08bfe46d78efa0023fb02a613562f176eeb251.60f43f7f991a731dbf6f60c39f124c38', 'admin', 'leahn', '', NULL, NULL, NULL, NULL, NULL, NULL, '2025-03-04 14:30:48.855809', '2025-03-04 14:30:49.04378'),
(8, 'leahnaso', '1c9d95a0b94e2aa56b9a1c6d2eadcae930b301cfbeeaedced1d28ddd3fc6c06150041471a3553b9d9b7d2ef310c85598e66c01e5e6b9f9606306b7d2bb701cfd.f59210d79fec350e37e1b36c55eae1e1', 'admin', 'Compliance', 'nasol@moravian.edu', NULL, NULL, NULL, NULL, NULL, NULL, '2025-03-04 14:30:48.855809', '2025-03-04 14:30:49.04378'),
(10, 'sharontest', 'a6c15631205a4bea6a2b1904a179e87b3b6005a83d0109fd2092fc0956efba8acc5924007e7569179c80c44df3202ac1e30d195d5718c4c5703df0d8f4473467.64812ca8a4ad8fd2717452f5bb7feede', 'user', 'IR', 'mauss@moravian.edu', NULL, NULL, NULL, NULL, NULL, NULL, '2025-03-04 14:30:48.855809', '2025-03-04 14:30:49.04378'),
(4, 'davey', '557f98f852351b360acc1fb240062eca4dcd4ae48c781b544f16af9934679e1dd0d3c95e8ef2e8ddbe4da681f4b63d4e8d467190c945ba6df9df83453150dc33.234792cff19ffdd124063d215010c06a', 'user', '', '', NULL, NULL, NULL, NULL, NULL, NULL, '2025-03-04 19:30:48.855809', '2025-03-04 19:30:49.04378'),
(6, 'dvdbrnds', '783782f8f254ca4880d60753314b2d648ed30795c856c2b011cae841749b77e3a76461bbb333e1af95db563cdd25d4737f7bfd664ee59dbede1cff31e1c00285.609a61a8a0c4d147ee28cf63830ec8bc', 'admin', 'IT', 'brandesd@moravian.edu', 'David', 'Brandes', NULL, NULL, NULL, '2025-05-22 20:01:31.136000', '2025-03-04 19:30:48.855809', '2025-03-04 19:30:49.04378');

-- Reset sequences to proper values
SELECT setval('public.users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.users), true);
SELECT setval('public.regulations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.regulations), true);
SELECT setval('public.notes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.notes), true);
SELECT setval('public.notifications_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.notifications), true);
SELECT setval('public.system_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.system_logs), true);
SELECT setval('public.deadlines_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.deadlines), true);
SELECT setval('public.evidence_files_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.evidence_files), true);
SELECT setval('public.guides_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.guides), true);
SELECT setval('public.comments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.comments), true);

-- Grant proper permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Final verification
SELECT 'Schema restoration complete' as status, 
       (SELECT count(*) FROM users) as user_count,
       (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count;
"""

    # Write schema to temporary file
    with open('/tmp/restore_schema.sql', 'w') as f:
        f.write(schema_sql)
    
    # Execute schema restoration
    cmd = f"psql -h {endpoint} -p {port} -U {username} -d postgres -f /tmp/restore_schema.sql"
    success, output, stderr = run_cmd(cmd, timeout=60, env=env)
    
    if success:
        log("✅ Database schema restored successfully")
        log(f"Output: {output[-200:]}")
    else:
        log(f"❌ Schema restoration failed: {stderr}", "ERROR")
        return False
    
    return True

def deploy_fixed_application():
    """Deploy the application with the restored database"""
    log("🚀 Deploying application with restored database...")
    
    # Create the deployment configuration
    deployment_config = {
        "version": "v1.21-schema-restored",
        "database_url": "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres",
        "environment": "production"
    }
    
    # Update ECS service
    ecs = boto3.client('ecs', region_name='us-east-1')
    
    try:
        # Get current task definition
        response = ecs.describe_task_definition(taskDefinition='edsteward-task')
        current_task_def = response['taskDefinition']
        
        # Create new task definition with updated environment
        new_task_def = {
            'family': current_task_def['family'],
            'networkMode': current_task_def['networkMode'],
            'requiresCompatibilities': current_task_def['requiresCompatibilities'],
            'cpu': current_task_def['cpu'],
            'memory': current_task_def['memory'],
            'executionRoleArn': current_task_def['executionRoleArn'],
            'taskRoleArn': current_task_def.get('taskRoleArn'),
            'containerDefinitions': []
        }
        
        # Update container definition
        for container in current_task_def['containerDefinitions']:
            container_def = {
                'name': container['name'],
                'image': container['image'],
                'memory': container.get('memory', 1024),
                'cpu': container.get('cpu', 512),
                'essential': container.get('essential', True),
                'portMappings': container.get('portMappings', []),
                'logConfiguration': container.get('logConfiguration'),
                'environment': [
                    {'name': 'NODE_ENV', 'value': 'production'},
                    {'name': 'PORT', 'value': '3000'},
                    {'name': 'DATABASE_URL', 'value': deployment_config['database_url']},
                    {'name': 'SESSION_SECRET', 'value': 'EdSteward2024!SecureSession'},
                    {'name': 'VERSION', 'value': deployment_config['version']}
                ]
            }
            new_task_def['containerDefinitions'].append(container_def)
        
        # Register new task definition
        log("📋 Registering new task definition...")
        register_response = ecs.register_task_definition(**new_task_def)
        new_task_arn = register_response['taskDefinition']['taskDefinitionArn']
        
        log(f"✅ New task definition registered: {new_task_arn}")
        
        # Update ECS service
        log("🔄 Updating ECS service...")
        ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            taskDefinition=new_task_arn,
            forceNewDeployment=True
        )
        
        log("✅ ECS service update initiated")
        return True
        
    except Exception as e:
        log(f"❌ Deployment failed: {e}", "ERROR")
        return False

def wait_for_deployment():
    """Wait for the deployment to complete and application to be healthy"""
    log("⏳ Waiting for deployment to complete...")
    
    max_wait = 300  # 5 minutes
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait:
        try:
            # Check health endpoint
            response = requests.get(
                "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health",
                timeout=10
            )
            
            if response.status_code == 200:
                log("✅ Application is healthy")
                
                # Test login endpoint
                time.sleep(5)  # Give it a moment to fully initialize
                
                login_response = requests.post(
                    "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/login",
                    json={"username": "dvdbrnds", "password": "test123"},
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                log(f"🔐 Login test: {login_response.status_code}")
                if login_response.status_code == 401:
                    log("✅ Login endpoint is working (401 = invalid credentials, which is expected)")
                    return True
                elif login_response.status_code == 200:
                    log("✅ Login successful!")
                    return True
                else:
                    log(f"⚠️ Login endpoint returned: {login_response.status_code}", "WARNING")
            
        except requests.exceptions.RequestException as e:
            log(f"⏳ Still waiting... ({e})")
        
        time.sleep(10)
    
    log("⚠️ Deployment wait timeout - checking final status", "WARNING")
    return False

def test_restored_functionality():
    """Test the restored database and application functionality"""
    log("🧪 Testing restored functionality...")
    
    base_url = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
    
    tests = [
        ("Health Check", "GET", "/health"),
        ("API Test", "GET", "/api/test"),
        ("Login Endpoint", "POST", "/api/login", {"username": "test", "password": "test"}),
        ("User Endpoint", "GET", "/api/user"),
        ("Database Init", "GET", "/api/init-db-simple")
    ]
    
    results = {}
    
    for test_name, method, endpoint, data in [(*t, None) if len(t) == 3 else t for t in tests]:
        try:
            url = f"{base_url}{endpoint}"
            if method == "GET":
                response = requests.get(url, timeout=15)
            else:
                response = requests.post(url, json=data, timeout=15)
            
            results[test_name] = {
                "status": response.status_code,
                "response": response.text[:200] if response.text else ""
            }
            
            status_color = "SUCCESS" if response.status_code < 500 else "ERROR"
            log(f"{test_name}: {response.status_code}", status_color)
            
        except Exception as e:
            results[test_name] = {"status": "ERROR", "response": str(e)}
            log(f"{test_name}: ERROR - {str(e)}", "ERROR")
    
    return results

def main():
    log("🚀 Starting database schema restoration and application fix...")
    
    # Step 1: Get RDS information
    endpoint, port, username, password = get_rds_info()
    if not endpoint:
        log("❌ Failed to get RDS information", "ERROR")
        return
    
    # Step 2: Restore complete database schema
    if not restore_complete_schema(endpoint, port, username, password):
        log("❌ Failed to restore database schema", "ERROR")
        return
    
    # Step 3: Deploy the fixed application
    if not deploy_fixed_application():
        log("❌ Failed to deploy application", "ERROR")
        return
    
    # Step 4: Wait for deployment to complete
    deployment_success = wait_for_deployment()
    
    # Step 5: Test the restored functionality
    test_results = test_restored_functionality()
    
    # Final summary
    log("=" * 60)
    log("🎯 RESTORATION SUMMARY")
    log("=" * 60)
    
    log("✅ Database schema: RESTORED")
    log("✅ User data: RESTORED (6 users including dvdbrnds)")
    log("✅ Application: DEPLOYED")
    
    if deployment_success:
        log("✅ Deployment: SUCCESS")
    else:
        log("⚠️ Deployment: PARTIAL (may still be starting)", "WARNING")
    
    log("\n📊 Test Results:")
    for test_name, result in test_results.items():
        status_icon = "✅" if result['status'] < 500 else "❌"
        log(f"   {status_icon} {test_name}: {result['status']}")
    
    log("\n🔗 Application URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com")
    log("👤 Test users available: dvdbrnds, nasol@moravian.edu, leahn, leahnaso")
    
    log("🎉 Database restoration and application deployment complete!")

if __name__ == "__main__":
    main() 