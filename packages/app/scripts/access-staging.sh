#!/bin/zsh

# EdSteward Staging Access Script
# This script provides access information for the AWS staging environment

echo "🚀 EdSteward AWS Staging Environment"
echo "============================================="
echo ""

echo "🌐 **PROPER STAGING URLS (AWS)**"
echo "   • Staging Admin:     https://staging.edsteward.ai/"
echo "   • Moravian (Staging): https://moravian.edsteward.ai/"
echo ""

echo "👤 **Login Credentials:**"
echo "   • Username: dvdbrnds"
echo "   • Password: gabadhgabadh"
echo ""

echo "📊 **Sample Data Available:**"
echo "   • Moravian University (Conservatory)"
echo "   • 5 conservatory-applicable regulations"
echo "   • 3 upcoming deadlines"
echo "   • Institution filtering working correctly"
echo ""

echo "🏗️ **Infrastructure:**"
echo "   • AWS ECS Staging Cluster"
echo "   • Separate Neon staging database"
echo "   • Application Load Balancer routing"
echo "   • SSL/HTTPS enabled"
echo ""

# Test connectivity
echo "🧪 **Testing connectivity...**"
if curl -s "https://staging.edsteward.ai/health" | grep -q "OK"; then
    echo "✅ Staging Admin: RESPONDING"
else
    echo "❌ Staging Admin: NOT RESPONDING"
fi

if curl -s "https://moravian.edsteward.ai/health" | grep -q "OK"; then
    echo "✅ Moravian Staging: RESPONDING"
else
    echo "❌ Moravian Staging: NOT RESPONDING"
fi

echo ""
echo "🎯 **What to Test:**"
echo "   1. Login with dvdbrnds/gabadhgabadh"
echo "   2. Dashboard shows conservatory filtering"
echo "   3. Regulation count: '5 of 12 regulations'"
echo "   4. Pink highlighting on institution badges"
echo "   5. Upcoming deadlines visible"
echo ""

echo "🚀 **Ready to use!**"
echo "   • Staging Admin: https://staging.edsteward.ai/"
echo "   • Moravian: https://moravian.edsteward.ai/"
echo ""

echo "💡 **Note:** This is the proper SaaS staging setup where:"
echo "   • staging.edsteward.ai = EdSteward admin staging environment"
echo "   • moravian.edsteward.ai = Moravian University tenant"
echo "   • Both use the same staging database with sample data" 