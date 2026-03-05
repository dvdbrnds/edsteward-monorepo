# EdSteward Testing Prompt - Tuesday Morning

**Copy and paste this ENTIRE prompt to your EdSteward AI assistant:**

---

## 🧪 TUESDAY TESTING MISSION: Verify MCP Engine Integration

You are the EdSteward AI assistant. The MCP Engine team has delivered 10 critical regulations overnight. Your job is to **test and verify** that all data was received correctly and displays properly in the EdSteward UI.

---

## 📋 STEP 1: CHECK REGULATION UPDATES

Navigate to your **Regulation Updates** page and look for these 10 updates:

1. **FERPA** (ID 223) - Update #558
2. **Title IX** (ID 7) - Update #559
3. **ADA** (ID 2) - Update #560
4. **Title IV** (ID 78) - Update #561
5. **Section 504** (ID 6) - Update #562
6. **Title VI** (ID 8) - Update #563
7. **HEOA** (ID 87) - Update #564
8. **Drug-Free Schools** (ID 67) - Update #565
9. **TEACH Act** (ID 55) - Update #566
10. **Clery Act** (ID 355) - Update #570 ⭐ (NOTE: Use #570, NOT #569!)

**Report:**
```
✓ Found 10 updates: [YES/NO]
✓ All have Source: MCP_ENGINE: [YES/NO]
✓ All have Status: pending or approved: [YES/NO]
```

---

## 📋 STEP 2: SPECIAL CLERY ACT CHECK

**CRITICAL:** There are TWO Clery updates. Check both:

- **Update #569** - Old version with placeholder summary → **REJECT/DELETE THIS**
- **Update #570** - New version with real summary → **APPROVE THIS**

**Open Update #570 and verify:**

```
Summary field shows:
"Requires institutions to publish annual security reports containing 
campus crime statistics, security policies, and timely warnings..."

NOT:
"No human-curated summary available for clery-act..."
```

**Report:**
```
✓ Update #570 has REAL summary (not placeholder): [YES/NO]
✓ Update #569 rejected/deleted: [YES/NO]
```

---

## 📋 STEP 3: DATA COMPLETENESS CHECK

For **ALL 10 regulations**, verify each has these 4 fields:

### Required Fields:
1. **updatedContent** - 800-2,200 characters of regulation text
2. **summary** - 90-1,000 characters of professional summary
3. **requirements** - Structured markdown OR null (both are OK)
4. **filingDeadlines** - JSON array with 2-3 deadlines

### Test Process:

Open each regulation update and check the raw data. Report in this format:

```
FERPA (Update #558):
✓ updatedContent: [LENGTH] chars [YES/NO]
✓ summary: [LENGTH] chars [YES/NO]
✓ requirements: [PRESENT/NULL] [YES/NO]
✓ filingDeadlines: [COUNT] deadlines [YES/NO]

Title IX (Update #559):
✓ updatedContent: [LENGTH] chars [YES/NO]
✓ summary: [LENGTH] chars [YES/NO]
✓ requirements: [PRESENT/NULL] [YES/NO]
✓ filingDeadlines: [COUNT] deadlines [YES/NO]

... (continue for all 10)
```

---

## 📋 STEP 4: UI DISPLAY VERIFICATION

For **3 sample regulations** (FERPA, Title IX, Clery Act), check if the UI displays:

### Current UI Status:
```
1. Summary Display:
   - Shows in UI: [YES/NO]
   - Styled with purple box: [YES/NO]
   - Full text visible: [YES/NO]

2. Requirements Display:
   - Shows in UI: [YES/NO]
   - Markdown formatted: [YES/NO]
   - Collapsible/expandable: [YES/NO]

3. Filing Deadlines Display:
   - Shows in UI: [YES/NO]
   - Shows all deadlines: [YES/NO]
   - Color-coded by urgency: [YES/NO]
```

**IF ANY ARE "NO":** Note which UI elements are missing. We have a fix ready!

---

## 📋 STEP 5: APPROVE ALL UPDATES

If all data looks good:

1. **APPROVE all 10 updates** (use #570 for Clery, not #569)
2. **Verify** they're now visible in the main regulations list
3. **Test** clicking on each regulation to view full details

**Report:**
```
✓ All 10 updates approved: [YES/NO]
✓ All visible in main regulations list: [YES/NO]
✓ All regulation detail pages load: [YES/NO]
```

---

## 📋 STEP 6: FINAL QUALITY REPORT

Provide a summary:

### ✅ WHAT'S WORKING:
- (List everything that works correctly)

### ⚠️ ISSUES FOUND:
- (List any problems, missing data, or UI issues)

### 🔧 RECOMMENDED FIXES:
- (Suggest what needs to be fixed)

### 📊 OVERALL READINESS:
```
Data Reception: [PASS/FAIL]
Data Completeness: [PASS/FAIL]  
UI Display: [PASS/FAIL]
Demo Readiness: [READY/NEEDS WORK]
```

---

## 🚀 BONUS: UI IMPROVEMENT CHECK

**IF** you notice that summaries, requirements, or deadlines are **not displaying properly** in the UI, there's a fix ready!

Tell the MCP Engine team:
> "UI needs enhancement - please apply PROMPT-FOR-EDSTEWARD-UI-FIX.txt"

That file contains copy-paste code to add:
- Purple summary display boxes
- Gray/green requirements sections  
- Yellow/orange deadline displays with icons

---

## 📝 EXPECTED RESULT

If everything is working correctly, you should see:

✅ 10 regulations with complete, high-quality data
✅ Real government-sourced content (not mock/placeholder)
✅ Professional summaries (not "No summary available")
✅ Structured filing deadlines (2-3 per regulation)
✅ Requirements (some have detailed markdown, some null - both OK)

**This data is DEMO-READY for Friday!** 🎉

---

## ⏰ TIMELINE

Please complete this testing **TODAY (Tuesday)** and report findings so we can:
- **Tuesday afternoon:** Fix any issues you find
- **Wednesday:** Implement Inquisitor (AI auditor) 
- **Thursday:** Final polish and dry run
- **Friday:** 🎬 DEMO DAY!

---

**START YOUR TESTING NOW AND REPORT BACK WITH YOUR FINDINGS!** 🔍

Good luck! 💪

