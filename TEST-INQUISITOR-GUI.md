# 🧪 Testing the Inquisitor GUI

**Quick Testing Guide for Tuesday Afternoon**

---

## 🚀 Step 1: Start the Inquisitor Server

Open a terminal and run:

```bash
cd /Users/dvdbrnds/Desktop/DISASTER\ RECOVERY\ MCP\ ENGINE/MCP-Engine

export ANTHROPIC_API_KEY="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"

node src/inquisitor-mcp/inquisitor-server.js
```

**Expected Output:**
```
🔍 INQUISITOR MCP SERVER v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Server Configuration:
   • Port: 3060
   • Environment: development

🤖 AI Configuration:
   • Status: ✅ ENABLED
   • Model: claude-sonnet-4-5-20250929
   • Provider: Anthropic

✅ Ready to audit regulations!
```

---

## 🚀 Step 2: Start the MCP Engine Client

Open a **second terminal** and run:

```bash
cd /Users/dvdbrnds/Desktop/DISASTER\ RECOVERY\ MCP\ ENGINE/MCP-Engine/src/client

npm start
```

**Expected Output:**
```
Compiled successfully!

You can now view mcp-engine-client in the browser.

  Local:            http://localhost:3000
```

---

## 🚀 Step 3: Open the Dashboard

1. Open your browser
2. Navigate to: `http://localhost:3000`
3. You should see the MCP Engine Dashboard

---

## 🧪 Test 1: Single Regulation Audit

### Steps:

1. **Click on "🤖 Inquisitor AI - Quality Auditor" tab** (top of main content area)

2. **Make sure "Single Regulation Audit" tab is selected** (should be default)

3. **Select a regulation from the dropdown:**
   - Click the dropdown
   - Choose "Clery Act - Campus Security Policy"

4. **Click the "Run AI Audit" button** (blue button)

5. **Wait 15-30 seconds** - you'll see:
   - Spinning loader
   - "Running comprehensive audit with AI semantic analysis..."
   - "This may take 15-30 seconds"

6. **Review the results:**

   **✅ Check These Elements:**
   - [ ] Overall Quality Score displayed (e.g., "85/100")
   - [ ] Certainty level badge (e.g., "Certainty: C")
   - [ ] Four metric boxes:
     - Content Quality: __/100
     - Summary Quality: __/100
     - Requirements: __/100
     - Deadlines: __/100
   - [ ] Purple gradient "AI Semantic Analysis" section
   - [ ] "AI ACTIVE" green badge
   - [ ] Model name: "claude-sonnet-4-5-20250929"
   - [ ] Four AI scores:
     - Legal Accuracy: __/100
     - Completeness: __/100
     - Clarity: __/100
     - Actionability: __/100
   - [ ] "AI Assessment" text paragraph
   - [ ] Issues & Warnings section (if any)
   - [ ] Recommendations section (if any)

### Expected Results for Clery Act:

```
Overall Score: 85/100 (Certainty: C)

Content Quality: 95/100
Summary Quality: 95/100
Requirements: 90/100
Deadlines: 100/100

AI Analysis:
- Legal Accuracy: 95/100
- Completeness: 65/100
- Clarity: 85/100
- Actionability: 55/100

AI Assessment: "The content is legally accurate as far as it goes but critically incomplete..."
```

---

## 🧪 Test 2: Try Different Regulations

Repeat Test 1 with these regulations to see different scores:

1. **FERPA** - Should score high (90+)
2. **Title IV** - Should score high (90+)
3. **TEACH Act** - Should have some issues
4. **HEOA** - Missing deadlines, lower score

---

## 🧪 Test 3: Batch Audit (All 10 Regulations)

### Steps:

1. **Click on "Batch Audit (All 10 Demo Regs)" tab**

2. **Click "Run Batch AI Audit (10 Regulations)" button** (purple button)

3. **Wait 3-5 minutes** - you'll see:
   - Spinning loader
   - "Running batch audit on all 10 demo regulations..."
   - "Processing with AI semantic analysis"

4. **Review the batch results:**

   **✅ Check These Elements:**
   - [ ] 10 regulation cards displayed in a grid
   - [ ] Each card shows:
     - Regulation name
     - Overall score badge (e.g., "93/100")
     - Certainty level
     - Progress bar (colored by score)
     - Individual metric scores
     - "AI Analyzed" purple tag
   - [ ] Cards are clickable (hover effect)
   - [ ] Scores vary across regulations

### Expected Batch Results:

```
Top Performers (90+):
- FERPA: 93/100
- Clery Act: 93/100
- TEACH Act: 92/100
- Title IV: 90/100

Mid Range (75-89):
- Title IX: 85/100
- Drug-Free Schools: 85/100
- Section 504: 85/100
- ADA: 85/100

Lower Scores (<75):
- Title VI: varies
- HEOA: varies (missing deadlines)
```

---

## 🧪 Test 4: Error Handling

### Test Error States:

1. **Try to audit without selecting a regulation:**
   - Leave dropdown empty
   - Click "Run AI Audit"
   - **Expected:** Error alert appears: "Please select a regulation to audit"

2. **Stop the Inquisitor server mid-audit:**
   - Start a single audit
   - While loading, kill the Inquisitor server (Ctrl+C in terminal)
   - **Expected:** Error alert with connection error message

---

## ✅ Success Criteria

**The GUI is working correctly if:**

- [x] Inquisitor tab appears in dashboard
- [x] Single audit completes in 15-30 seconds
- [x] Results display with all sections (scores, metrics, AI analysis)
- [x] AI section shows purple gradient branding
- [x] Batch audit processes all 10 regulations
- [x] Batch results grid displays all 10 cards
- [x] Scores vary across regulations (not all the same)
- [x] AI Analysis shows actual assessment text
- [x] Color coding works (green/blue/orange/red)
- [x] Loading states show spinners
- [x] Error handling shows alerts

---

## 🎯 Demo Preparation Checklist

**For Friday Demo:**

- [ ] Inquisitor server starts successfully
- [ ] GUI loads without errors
- [ ] Can successfully audit Clery Act (our flagship regulation)
- [ ] AI analysis displays properly
- [ ] Batch audit completes all 10 regulations
- [ ] Results are professional and easy to understand
- [ ] Can explain the scoring system
- [ ] Can show patent compliance (AI analysis visible)

---

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot connect to Inquisitor server"
**Fix:** Make sure Inquisitor is running on port 3060
```bash
lsof -i :3060  # Check if port is in use
node src/inquisitor-mcp/inquisitor-server.js  # Start server
```

### Issue 2: "AI Analysis not available"
**Fix:** Make sure ANTHROPIC_API_KEY is set
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
node src/inquisitor-mcp/inquisitor-server.js
```

### Issue 3: GUI doesn't show Inquisitor tab
**Fix:** Make sure client is running latest code
```bash
cd src/client
npm start
# Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### Issue 4: Audit takes too long (>60 seconds)
**Fix:** This is normal for batch audits (3-5 min). For single audits, check:
- Network connection
- Anthropic API key is valid
- No API rate limits

---

## 📸 Screenshots to Take for Demo

1. **Dashboard Overview** - showing Inquisitor tab
2. **Single Audit Interface** - dropdown and button
3. **Loading State** - spinner while auditing
4. **Single Audit Results** - complete Clery Act results
5. **AI Analysis Section** - purple gradient with scores
6. **Batch Audit Interface** - before running
7. **Batch Results Grid** - all 10 regulations
8. **Individual Batch Card** - zoomed in on one result

---

## 🎉 Testing Complete!

Once all tests pass, you're ready for the Friday demo!

**Next Steps:**
1. Practice the demo flow
2. Prepare talking points
3. Test on fresh browser (incognito mode)
4. Have backup plan if API fails (use screenshots)

**Estimated Testing Time:** 20-30 minutes

Good luck! 🚀



