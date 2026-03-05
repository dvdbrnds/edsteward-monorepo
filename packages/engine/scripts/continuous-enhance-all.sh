#!/bin/bash

# CONTINUOUS REGULATION ENHANCEMENT
# Processes all remaining regulations below score 85

export MCP_REGULATION_ENHANCEMENT_KEY="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"

cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

echo "═══════════════════════════════════════════════════════════════════"
echo "CONTINUOUS ENHANCEMENT - ALL REMAINING REGULATIONS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Get all regulations that need enhancement (score < 85)
cat comprehensive-audit-report.json | jq -r '[.details | .[] | select(.score > 0 and .score < 85) | .slug] | unique | .[]' > all-remaining-regs.txt

TOTAL=$(cat all-remaining-regs.txt | wc -l | tr -d ' ')
echo "Total regulations to enhance: $TOTAL"
echo ""

count=0
success=0
failed=0

while read reg; do
    # Skip if already enhanced
    if [ -f "enhanced-regulations/${reg}.json" ]; then
        echo "⏭️  Skipping $reg (already enhanced)"
        continue
    fi
    
    count=$((count + 1))
    echo ""
    echo "[$count/$TOTAL] Enhancing: $reg"
    
    # Determine tier based on original score
    original_score=$(cat comprehensive-audit-report.json | jq -r ".details[] | select(.slug == \"$reg\") | .score" | head -1)
    
    if [ -z "$original_score" ] || [ "$original_score" = "null" ]; then
        tier=3
    elif [ "$original_score" -lt 50 ]; then
        tier=1
    elif [ "$original_score" -lt 70 ]; then
        tier=2
    else
        tier=3
    fi
    
    # Enhance with appropriate tier
    if node enhance-regulation-ai.cjs "$reg" "$tier" 2>&1 | tee -a logs/continuous-enhancement.log | grep -q "ENHANCEMENT COMPLETE"; then
        success=$((success + 1))
        echo "✅ Success ($success/$count)"
    else
        failed=$((failed + 1))
        echo "❌ Failed ($failed/$count)"
    fi
    
    # Progress update every 10
    if [ $((count % 10)) -eq 0 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Progress: $count/$TOTAL processed"
        echo "✅ Success: $success | ❌ Failed: $failed | Success Rate: $((success * 100 / count))%"
        enhanced_count=$(ls -1 enhanced-regulations/ | wc -l | tr -d ' ')
        echo "📁 Total enhanced files: $enhanced_count"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi
    
    # Rate limiting (12 seconds between requests)
    sleep 60
    
done < all-remaining-regs.txt

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "CONTINUOUS ENHANCEMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Total processed: $count"
echo "✅ Successful: $success"
echo "❌ Failed: $failed"
echo "Success rate: $((success * 100 / count))%"
echo ""
enhanced_count=$(ls -1 enhanced-regulations/ | wc -l | tr -d ' ')
echo "📁 Total enhanced regulations: $enhanced_count"
echo ""
echo "═══════════════════════════════════════════════════════════════════"

