#!/bin/bash

# QUICK STATUS CHECK - Run this anytime!

cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

echo "═══════════════════════════════════════════════════════════════════"
echo "🤖 AUTONOMOUS ENHANCEMENT STATUS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check if process is running
if ps aux | grep -q "[s]mart-enhance-all.sh"; then
    echo "✅ Status: RUNNING"
    PID=$(ps aux | grep "[s]mart-enhance-all.sh" | awk '{print $2}')
    echo "   Process ID: $PID"
else
    echo "⏸️  Status: STOPPED"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PROGRESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count enhanced
ENHANCED=$(ls -1 enhanced-regulations/ 2>/dev/null | wc -l | tr -d ' ')
TOTAL=295
PERCENT=$((ENHANCED * 100 / TOTAL))
REMAINING=$((TOTAL - ENHANCED))

echo "Enhanced:  $ENHANCED / $TOTAL ($PERCENT%)"
echo "Remaining: $REMAINING"
echo ""

# Calculate ETA (assuming 30 per hour)
if [ $REMAINING -gt 0 ]; then
    HOURS=$((REMAINING / 30))
    MINS=$(((REMAINING % 30) * 2))
    echo "ETA:       ~${HOURS}h ${MINS}m remaining"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 RECENT ACTIVITY (last 10 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

tail -10 logs/smart-enhancement-full.log 2>/dev/null | grep -E "(Enhancing:|Success|Batch|Cooling)" | tail -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 LATEST 5 COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ls -lt enhanced-regulations/ 2>/dev/null | head -6 | tail -5 | awk '{print $9}' | sed 's/.json$//'

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Commands:"
echo "  Watch live:    tail -f logs/smart-enhancement-full.log"
echo "  Pause:         ./control-enhancement.sh pause"
echo "  Resume:        ./control-enhancement.sh resume"
echo ""
echo "═══════════════════════════════════════════════════════════════════"



