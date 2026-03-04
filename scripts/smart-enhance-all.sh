#!/bin/bash

# SMART REGULATION ENHANCEMENT
# Respects API rate limits with strategic batching

export MCP_REGULATION_ENHANCEMENT_KEY="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"

cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

# STRATEGY: Process in micro-batches with cooling periods
# - Process 3 regulations
# - Wait 5 minutes
# - Repeat

BATCH_SIZE=3           # Small batches to stay under rate limit
COOLING_PERIOD=300     # 5 minutes between batches (300 seconds)
DELAY_BETWEEN=20       # 20 seconds between individual requests

echo "═══════════════════════════════════════════════════════════════════"
echo "SMART ENHANCEMENT - RATE-LIMIT-AWARE PROCESSING"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Strategy: Process $BATCH_SIZE at a time, wait $COOLING_PERIOD seconds, repeat"
echo "Individual delay: ${DELAY_BETWEEN}s between requests"
echo ""

# Get all regulations that need enhancement
cat comprehensive-audit-report.json | jq -r '[.details | .[] | select(.score > 0 and .score < 85) | .slug] | unique | .[]' > all-remaining-regs.txt

TOTAL=$(cat all-remaining-regs.txt | wc -l | tr -d ' ')
echo "Total regulations to enhance: $TOTAL"
echo ""

batch_num=0
count=0
success=0
failed=0
current_batch=0

while read reg; do
    # Skip if already enhanced
    if [ -f "enhanced-regulations/${reg}.json" ]; then
        continue
    fi
    
    count=$((count + 1))
    current_batch=$((current_batch + 1))
    
    echo ""
    echo "[$count/$TOTAL] Enhancing: $reg"
    
    # Determine tier
    original_score=$(cat comprehensive-audit-report.json | jq -r ".details[] | select(.slug == \"$reg\") | .score" | head -1)
    tier=2  # Default to tier 2 (85+ target)
    
    if [ -n "$original_score" ] && [ "$original_score" != "null" ]; then
        if [ "$original_score" -lt 50 ]; then
            tier=1
        elif [ "$original_score" -lt 70 ]; then
            tier=2
        else
            tier=3
        fi
    fi
    
    # Enhance
    if node enhance-regulation-ai.cjs "$reg" "$tier" 2>&1 | tee -a logs/smart-enhancement.log | grep -q "ENHANCEMENT COMPLETE"; then
        success=$((success + 1))
        echo "✅ Success ($success/$count)"
    else
        failed=$((failed + 1))
        echo "❌ Failed ($failed/$count)"
    fi
    
    # Micro-batch complete?
    if [ $current_batch -ge $BATCH_SIZE ]; then
        batch_num=$((batch_num + 1))
        current_batch=0
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Batch $batch_num complete: Processed $BATCH_SIZE regulations"
        echo "✅ Success: $success | ❌ Failed: $failed | Rate: $((success * 100 / count))%"
        enhanced_count=$(ls -1 enhanced-regulations/ | wc -l | tr -d ' ')
        echo "📁 Total enhanced: $enhanced_count"
        echo ""
        echo "⏸️  Cooling period: Waiting ${COOLING_PERIOD}s to respect rate limits..."
        echo "   (Next batch starts at $(date -v+${COOLING_PERIOD}S '+%I:%M %p'))"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        # Cooling period between batches
        sleep $COOLING_PERIOD
    else
        # Small delay between individual requests in batch
        sleep $DELAY_BETWEEN
    fi
    
done < all-remaining-regs.txt

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "SMART ENHANCEMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Total processed: $count"
echo "✅ Successful: $success ($((success * 100 / count))%)"
echo "❌ Failed: $failed"
echo ""
enhanced_count=$(ls -1 enhanced-regulations/ | wc -l | tr -d ' ')
echo "📁 Total enhanced regulations: $enhanced_count"
echo ""

