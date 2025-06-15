#!/bin/bash
echo "🚀 Starting Database Restoration..."

# Test connection first
echo "📡 Testing RDS connection..."
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT version();"

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
    echo "📋 Starting database restoration..."
    
    # Run the restoration
    psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" < nosync_backup.sql
    
    if [ $? -eq 0 ]; then
        echo "🎉 DATABASE RESTORATION COMPLETED SUCCESSFULLY!"
        echo "✅ Your Neon database data has been restored to AWS RDS!"
        
        # Test the restoration
        echo "🧪 Testing restored data..."
        psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT count(*) as user_count FROM users;"
        
    else
        echo "❌ Database restoration failed!"
        exit 1
    fi
else
    echo "❌ Cannot connect to RDS database"
    echo "Please check:"
    echo "1. RDS is publicly accessible"
    echo "2. Security groups allow port 5432"
    echo "3. Network connectivity"
    exit 1
fi
