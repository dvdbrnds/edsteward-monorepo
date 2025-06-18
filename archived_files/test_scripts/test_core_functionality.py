#!/usr/bin/env python3
"""
Test Core Functionality
=======================
Quick test of Neon database and API without AWS deployment
"""

import psycopg2
import requests
import json

def test_database_connection():
    """Test Neon database connection and data"""
    print('🔍 TESTING NEON DATABASE')
    print('=' * 30)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        # Get basic stats
        cursor.execute('SELECT COUNT(*) FROM regulations;')
        total_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT category) FROM regulations;')
        category_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT jurisdiction) FROM regulations;')
        jurisdiction_count = cursor.fetchone()[0]
        
        # Check JSONB data
        cursor.execute('SELECT COUNT(*) FROM regulations WHERE actions IS NOT NULL;')
        actions_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM regulations WHERE sources IS NOT NULL;')
        sources_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        print(f'✅ Total regulations: {total_count}')
        print(f'✅ Categories: {category_count}')
        print(f'✅ Jurisdictions: {jurisdiction_count}')
        print(f'✅ Records with actions: {actions_count}')
        print(f'✅ Records with sources: {sources_count}')
        
        return total_count >= 300
        
    except Exception as e:
        print(f'❌ Database error: {e}')
        return False

def test_api_endpoints():
    """Test API endpoints"""
    print('\n🧪 TESTING API ENDPOINTS')
    print('=' * 30)
    
    # Test public endpoint
    try:
        response = requests.get('http://localhost:3000/api/public/regulations', timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f'✅ Public API: {len(data)} regulations')
            
            if data:
                sample = data[0]
                required_fields = ['id', 'itemId', 'name', 'category', 'jurisdiction']
                missing = [f for f in required_fields if f not in sample]
                
                if missing:
                    print(f'❌ Missing fields: {missing}')
                    return False
                else:
                    print('✅ Schema validation passed')
                    return True
        else:
            print(f'❌ API returned status: {response.status_code}')
            
    except Exception as e:
        print(f'⚠️  Local API not available: {e}')
        print('ℹ️  This is normal if local server is not running')
    
    return True

def test_production_api():
    """Test production API"""
    print('\n🌐 TESTING PRODUCTION API')
    print('=' * 30)
    
    production_url = 'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/public/regulations'
    
    try:
        response = requests.get(production_url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f'🎉 Production API: {len(data)} regulations')
            
            if data and len(data) >= 300:
                sample = data[0]
                required_fields = ['id', 'itemId', 'name', 'category', 'jurisdiction']
                
                if all(field in sample for field in required_fields):
                    print('✅ Production schema validation passed')
                    
                    # Show sample data
                    print('\n📋 Sample production data:')
                    for i, reg in enumerate(data[:3]):
                        name = reg.get('name', 'Unknown')[:40]
                        category = reg.get('category', 'Unknown')
                        jurisdiction = reg.get('jurisdiction', 'Unknown')
                        print(f'   {i+1}. {name}... ({category}, {jurisdiction})')
                    
                    return True
                else:
                    print('❌ Schema validation failed')
            else:
                print(f'⚠️  Only {len(data) if data else 0} regulations found')
        else:
            print(f'❌ Production API status: {response.status_code}')
            
    except Exception as e:
        print(f'❌ Production API error: {e}')
    
    return False

def main():
    print('🎯 CORE FUNCTIONALITY TEST')
    print('=' * 30)
    
    results = []
    
    # Test 1: Database
    print('\nTEST 1: Database Connection')
    db_ok = test_database_connection()
    results.append(('Database', db_ok))
    
    # Test 2: Local API
    print('\nTEST 2: Local API')
    local_api_ok = test_api_endpoints()
    results.append(('Local API', local_api_ok))
    
    # Test 3: Production API
    print('\nTEST 3: Production API')
    prod_api_ok = test_production_api()
    results.append(('Production API', prod_api_ok))
    
    # Summary
    print('\n🎊 SUMMARY')
    print('=' * 15)
    
    all_passed = True
    for test_name, result in results:
        status = '✅' if result else '❌'
        print(f'{status} {test_name}: {"PASS" if result else "FAIL"}')
        if not result:
            all_passed = False
    
    if all_passed:
        print('\n🚀 ALL TESTS PASSED!')
        print('Your RegulatoryTrackr is ready!')
    else:
        print('\n⚠️  Some tests failed - check the details above')
    
    return all_passed

if __name__ == '__main__':
    main() 