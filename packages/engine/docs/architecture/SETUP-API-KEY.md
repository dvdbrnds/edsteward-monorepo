# SETUP ANTHROPIC API KEY - REGULATION ENHANCEMENT

## Why a Dedicated API Key?

Using a separate API key for the regulation enhancement project provides:
- **Cost Tracking:** Track costs specifically for this project
- **Rate Limiting:** Separate quotas from other tools
- **Project Isolation:** Keep projects independent
- **Billing Clarity:** See exactly what the regulation enhancement costs

═══════════════════════════════════════════════════════════════════

## STEP 1: Get Your Anthropic API Key

### Create Account & Get Key:

1. **Go to:** https://console.anthropic.com/
2. **Sign up** or **Log in**
3. **Navigate to:** API Keys section
4. **Click:** "Create Key"
5. **Name it:** "MCP Regulation Enhancement" (for tracking)
6. **Copy the key:** Starts with `sk-ant-api03-...`

### Add Credits:

1. **Go to:** Billing section
2. **Add credits:** $20 (recommended to start)
   - Covers ~150 regulations
   - Can add more as needed
3. **Cost per regulation:** ~$0.11
4. **Total project cost:** ~$130 for all 354 regulations

═══════════════════════════════════════════════════════════════════

## STEP 2: Set Environment Variable

### Option A: Temporary (Current Session Only)

```bash
# Set for current terminal session
export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"

# Verify it's set
echo $MCP_REGULATION_ENHANCEMENT_KEY

# Test with single regulation
node enhance-regulation-ai.cjs age-discrimination-act-of-1975 1
```

### Option B: Persistent (Recommended)

Add to your shell profile so it persists across sessions:

**For zsh (macOS default):**
```bash
# Add to ~/.zshrc
echo 'export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"' >> ~/.zshrc

# Reload shell configuration
source ~/.zshrc

# Verify
echo $MCP_REGULATION_ENHANCEMENT_KEY
```

**For bash:**
```bash
# Add to ~/.bash_profile or ~/.bashrc
echo 'export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"' >> ~/.bash_profile

# Reload
source ~/.bash_profile

# Verify
echo $MCP_REGULATION_ENHANCEMENT_KEY
```

### Option C: Project .env File (Alternative)

```bash
# Create .env file in project root
cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

# Add key to .env file
echo 'MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"' >> .env

# Load environment variables before running (manual)
export $(cat .env | xargs)
```

**Note:** .env file should be in .gitignore to keep keys secure!

═══════════════════════════════════════════════════════════════════

## STEP 3: Verify Setup

### Test API Key:

```bash
# Test with a single regulation (should take ~30 seconds)
node enhance-regulation-ai.cjs age-discrimination-act-of-1975 1
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════════════
ENHANCING REGULATION: age-discrimination-act-of-1975
Tier: 1 | Target Score: 90+
═══════════════════════════════════════════════════════════════════

📥 Fetching current regulation data...
   ✅ Found: Age Discrimination Act of 1975

🤖 Generating AI content for: Age Discrimination Act of 1975
   Current content length: 156 chars
   Target score: 90+

   ✅ Generated content:
      Full text: 2847 chars
      Summary: 283 chars
      Requirements: 721 chars

🔍 Auditing enhanced content with Inquisitor...
   📊 Audit Results:
      Overall Score: 91 (A)
      Content: 100
      Summary: 90
      Requirements: 90
   ✅ PASSED! Score 91 meets target 90+
   💾 Saved to: enhanced-regulations/age-discrimination-act-of-1975.json

═══════════════════════════════════════════════════════════════════
✅ ENHANCEMENT COMPLETE
   Score: 91
   Status: Production-ready
═══════════════════════════════════════════════════════════════════
```

### Check Enhanced Content:

```bash
# View the enhanced regulation
cat enhanced-regulations/age-discrimination-act-of-1975.json | jq '.enhanced'

# Check audit score
cat enhanced-regulations/age-discrimination-act-of-1975.json | jq '.audit'
```

═══════════════════════════════════════════════════════════════════

## STEP 4: Start Batch Enhancement

Once verified, start processing regulations in batches:

```bash
# Enhance first 5 regulations (test batch)
node batch-enhance-regulations.cjs 1 5

# Enhance first 10 critical regulations
node batch-enhance-regulations.cjs 1 10

# Enhance all Tier 1 regulations (60 total)
# Process in batches of 10 for better monitoring
node batch-enhance-regulations.cjs 1 10  # Batch 1
node batch-enhance-regulations.cjs 1 10  # Batch 2 (will skip completed ones)
# ... continue until all 60 Tier 1 complete
```

═══════════════════════════════════════════════════════════════════

## COST TRACKING

### Monitor API Usage:

**In Anthropic Console:**
1. Go to: https://console.anthropic.com/settings/usage
2. View: Real-time usage and costs
3. Track: API calls by day/week/month

### Estimate Costs:

**Per Regulation:**
- Input tokens: ~5,000 (regulation data + prompt)
- Output tokens: ~2,000 (generated content)
- Total tokens: ~7,000
- Cost: ~$0.11 per regulation

**By Tier:**
- Tier 1 (60 regs): ~$7
- Tier 2 (130 regs): ~$14
- Tier 3 (154 regs): ~$17
- **Total (344 regs):** ~$38 base cost
- **With retries (2x):** ~$76
- **Total budget:** ~$130 (includes buffer)

═══════════════════════════════════════════════════════════════════

## TROUBLESHOOTING

### Error: "API key not set"

**Solution:**
```bash
# Check if key is set
echo $MCP_REGULATION_ENHANCEMENT_KEY

# If empty, set it
export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"
```

### Error: "Invalid API key"

**Possible causes:**
1. Key copied incorrectly (check for extra spaces)
2. Key not activated in Anthropic console
3. Key has no credits

**Solution:**
- Log into https://console.anthropic.com/
- Check API Keys section
- Verify key is active
- Check billing has credits

### Error: "Rate limit exceeded"

**Solution:**
- Wait a few minutes
- The batch processor has built-in rate limiting (5 second delay)
- Reduce batch size if needed: `batch-enhance-regulations.cjs 1 3`

### Error: "Insufficient credits"

**Solution:**
- Go to: https://console.anthropic.com/settings/billing
- Add more credits (suggest $20 at a time)
- Check current balance

═══════════════════════════════════════════════════════════════════

## SECURITY BEST PRACTICES

1. **Never commit API keys to git**
   - Already in .gitignore: `.env`
   - Don't paste keys in code files
   - Don't share keys in screenshots

2. **Use environment variables**
   - Set in shell profile or .env file
   - Never hardcode in scripts

3. **Rotate keys periodically**
   - Create new key every 3-6 months
   - Delete old keys in console

4. **Monitor usage**
   - Check console regularly
   - Set up budget alerts in Anthropic console
   - Track costs per project

═══════════════════════════════════════════════════════════════════

## QUICK REFERENCE

**Set Key (Recommended):**
```bash
export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"
```

**Test Setup:**
```bash
node enhance-regulation-ai.cjs age-discrimination-act-of-1975 1
```

**Start Production:**
```bash
node batch-enhance-regulations.cjs 1 10
```

**Check Progress:**
```bash
ls -la enhanced-regulations/ | wc -l
cat batch-enhancement-report-tier1-*.json | jq '.statistics'
```

═══════════════════════════════════════════════════════════════════

**Ready to start?** Once you have your API key:

```bash
# 1. Set the key
export MCP_REGULATION_ENHANCEMENT_KEY="sk-ant-api03-YOUR-KEY-HERE"

# 2. Test it
node enhance-regulation-ai.cjs age-discrimination-act-of-1975 1

# 3. Start batch processing
node batch-enhance-regulations.cjs 1 5

# You're enhancing regulations! 🚀
```

═══════════════════════════════════════════════════════════════════

