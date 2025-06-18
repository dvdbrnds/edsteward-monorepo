#!/bin/bash

echo "🚨 EMERGENCY DATABASE ENDPOINT TESTS 🚨"
echo "========================================"

echo ""
echo "1. Testing basic API endpoint..."
curl -s "https://edsteward.ai/api/test"
echo ""

echo "2. Testing direct database connection..."
curl -s "https://edsteward.ai/api/db-direct"
echo ""

echo "3. Testing database stats..."
curl -s "https://edsteward.ai/api/db-stats"
echo ""

echo "4. Testing database import endpoint..."
curl -s -X POST "https://edsteward.ai/api/db-import"
echo ""

echo "5. Testing old admin endpoints (should be 404)..."
curl -s "https://edsteward.ai/api/admin/database/stats"
echo ""

echo "========================================"
echo "🚨 EMERGENCY TESTS COMPLETE 🚨" 