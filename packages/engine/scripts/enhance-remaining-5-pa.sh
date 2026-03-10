#!/bin/bash

echo "════════════════════════════════════════════════════════════════════"
echo "🚀 ENHANCING REMAINING 5 PA REGULATIONS"
echo "════════════════════════════════════════════════════════════════════"
echo ""

export MCP_REGULATION_ENHANCEMENT_KEY="${MCP_REGULATION_ENHANCEMENT_KEY:-$ANTHROPIC_API_KEY}"
if [ -z "$MCP_REGULATION_ENHANCEMENT_KEY" ]; then echo "Set ANTHROPIC_API_KEY before running."; exit 1; fi

PA_REGS=(
  "pennsylvania-sexual-violence-education-act-article-"
  "pennsylvania-graduation-rates-reporting-act-88-of-"
  "pa-paeducation-1741813075070"
  "pa-padeptEd-1741813075521"
  "pa-padeptEd-1741813212673"
)

PA_NAMES=(
  "Pennsylvania Sexual Violence Education Act"
  "Pennsylvania Graduation Rates Reporting Act"
  "Pennsylvania Higher Education Standards"
  "Pennsylvania Institutional Accreditation Requirements"
  "Pennsylvania Student Consumer Protection Standards"
)

SUCCESS=0
FAILED=0

for i in {0..4}; do
  SLUG="${PA_REGS[$i]}"
  NAME="${PA_NAMES[$i]}"
  NUM=$((i + 1))
  
  echo "[$NUM/5] Enhancing: $NAME"
  echo "   Slug: $SLUG"
  echo "   ⏳ Starting AI enhancement..."
  
  node enhance-regulation-ai.cjs "$SLUG" > /tmp/enhance-$i.log 2>&1
  
  if [ $? -eq 0 ]; then
    echo "   ✅ ENHANCED!"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "   ❌ FAILED (check /tmp/enhance-$i.log)"
    FAILED=$((FAILED + 1))
  fi
  
  if [ $i -lt 4 ]; then
    echo "   💤 Cooling down for 20 seconds..."
    sleep 20
  fi
  echo ""
done

echo "════════════════════════════════════════════════════════════════════"
echo "✅ Enhancement Complete: $SUCCESS/5 successful, $FAILED/5 failed"
echo "════════════════════════════════════════════════════════════════════"
