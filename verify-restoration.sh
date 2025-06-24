#!/bin/bash
echo "🔍 Verifying Database Restoration..."

psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" << 'EOF'
-- Check if tables exist
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check user count
SELECT 'Users:' as table_name, count(*) as record_count FROM users
UNION ALL
SELECT 'Regulations:', count(*) FROM regulations
UNION ALL
SELECT 'Notes:', count(*) FROM notes
UNION ALL
SELECT 'Notifications:', count(*) FROM notifications;

-- Show sample users
SELECT 'Sample Users:' as info;
SELECT id, username, role, department FROM users LIMIT 5;
EOF
