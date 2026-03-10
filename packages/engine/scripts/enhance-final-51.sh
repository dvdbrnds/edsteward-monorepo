#!/bin/bash

# Enhance the final 51 regulations (43 federal + 8 PA)

export MCP_REGULATION_ENHANCEMENT_KEY="${MCP_REGULATION_ENHANCEMENT_KEY:-$ANTHROPIC_API_KEY}"
if [ -z "$MCP_REGULATION_ENHANCEMENT_KEY" ]; then echo "Set ANTHROPIC_API_KEY before running."; exit 1; fi

cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

echo "═══════════════════════════════════════════════════════════════════"
echo "ENHANCING FINAL 51 REGULATIONS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

TOTAL=$(wc -l < still-need-enhancement.txt | tr -d ' ')
echo "Total regulations to enhance: $TOTAL"
echo ""

success=0
failed=0
count=0

# Process in batches of 3 with 5-minute cooling
batch_count=0

while read reg; do
    count=$((count + 1))
    batch_count=$((batch_count + 1))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[$count/$TOTAL] Enhancing: $reg"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Run enhancement
    if node enhance-regulation-ai.cjs "$reg" 2>&1 | tee -a logs/final-51-enhancement.log; then
        success=$((success + 1))
        echo "✅ Success ($success/$count)"
    else
        failed=$((failed + 1))
        echo "❌ Failed ($failed/$count)"
    fi
    
    # After every 3, take a 5-minute break
    if [ $batch_count -eq 3 ]; then
        batch_num=$(((count + 2) / 3))
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Batch $batch_num complete: Processed 3 regulations"
        echo "✅ Success: $success | ❌ Failed: $failed | Rate: $((success * 100 / count))%"
        echo "⏸️  Cooling period: Waiting 300s to respect rate limits..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        sleep 300
        batch_count=0
    fi
    
done < still-need-enhancement.txt

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "FINAL 51 REGULATIONS ENHANCEMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Total processed: $TOTAL"
echo "✅ Successful: $success ($((success * 100 / TOTAL))%)"
echo "❌ Failed: $failed"
echo ""
echo "📁 Total enhanced regulations: $(ls -1 enhanced-regulations/ | wc -l | tr -d ' ')"
echo ""


