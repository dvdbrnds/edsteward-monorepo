# Adding Inquisitor Widget to Console Pages

## 📍 Where to Add It

The Inquisitor widget should be added to the **sidebar** of each regulation console page.

**File Pattern:** `src/client/public/regulations/*-console.html`
**Total Files:** 286 console pages

---

## 🎯 Quick Integration (Manual for Testing)

### Step 1: Open a Console Page
Example: `src/client/public/regulations/family-educational-rights-and-privacy-act-ferpa-console.html`

### Step 2: Find the Sidebar Closing Tag
Look for this section (around line 1567):
```html
            </div>  <!-- End of error-panel -->
        </div>  <!-- End of sidebar -->
    </div>  <!-- End of console-container -->
```

### Step 3: Add Widget HTML Before Sidebar Closes
Insert the widget HTML from `inquisitor-widget-snippet.html` **BEFORE** `</div>  <!-- End of sidebar -->`

**Location:**
```html
            </div>  <!-- End of error-panel -->
            
            <!-- ADD INQUISITOR WIDGET HERE -->
            <div class="inquisitor-widget">
                ...widget HTML...
            </div>
            <!-- END INQUISITOR WIDGET -->
            
        </div>  <!-- End of sidebar -->
```

### Step 4: Add CSS to Style Section
Copy the CSS from `inquisitor-widget-snippet.html` and add it to the `<style>` section (after line 400).

### Step 5: Add JavaScript Before `</body>`
Copy the JavaScript from `inquisitor-widget-snippet.html` and add it before the closing `</body>` tag (around line 3708).

---

## 🤖 Automated Integration (Bulk Update All Pages)

Would you like me to create a script to automatically add the Inquisitor widget to all 286 console pages?

**Script would:**
1. Read `inquisitor-widget-snippet.html`
2. Find all `*-console.html` files
3. Insert CSS into `<style>` section
4. Insert HTML into sidebar
5. Insert JavaScript before `</body>`
6. Backup originals first

---

## ✅ Testing the Widget

### Once Added to a Page:

1. **Navigate to the page:**
   ```
   http://localhost:3050/regulations/family-educational-rights-and-privacy-act-ferpa-console.html
   ```

2. **Look for the sidebar:**
   - You should see a purple gradient box
   - "🤖 AI Quality Auditor" header
   - "⚡ Run AI Audit" button

3. **Click "Run AI Audit":**
   - Button shows spinner
   - Progress bar fills 0-100%
   - Takes 8-10 seconds
   - Results appear in the widget

4. **View Results:**
   - Overall score
   - Content/Summary/Requirements scores
   - AI analysis (Legal Accuracy, Completeness, etc.)
   - Written AI assessment

---

## 📋 What the Widget Shows

### Compact View (Always Visible):
```
┌────────────────────────────────┐
│ 🤖 AI Quality Auditor           │
│ ┌────────────────────────────┐ │
│ │  ⚡ Run AI Audit           │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

### During Analysis:
```
┌────────────────────────────────┐
│ 🤖 AI Quality Auditor           │
│ ┌────────────────────────────┐ │
│ │  🔄 Analyzing...           │ │
│ └────────────────────────────┘ │
│                                 │
│ ⚡ AI analyzing quality...      │
│ ████████████░░░░░░░ 75%        │
└────────────────────────────────┘
```

### After Analysis:
```
┌────────────────────────────────┐
│ 🤖 AI Quality Auditor           │
│ ┌────────────────────────────┐ │
│ │  ⚡ Run AI Audit           │ │
│ └────────────────────────────┘ │
│                                 │
│ Quality Report           A      │
│ ┌─────┬─────┬─────┬─────┐     │
│ │ 93  │ 95  │ 90  │ 92  │     │
│ │Over │Cont │Summ │Reqs │     │
│ └─────┴─────┴─────┴─────┘     │
│                                 │
│ 🤖 AI Semantic Analysis         │
│ Legal Accuracy:    95/100       │
│ Completeness:      45/100       │
│ Clarity:           75/100       │
│ Actionability:     50/100       │
│                                 │
│ AI Assessment:                  │
│ Legally sound foundation but    │
│ critically incomplete for...    │
└────────────────────────────────┘
```

---

## 🎨 Design Features

### Colors:
- **Purple Gradient Background** - Makes it stand out
- **White Cards** - Clean, readable results
- **Color-Coded Scores:**
  - 🟢 Green (90-100): Excellent
  - 🔵 Blue (75-89): Good
  - 🟡 Yellow (60-74): Fair
  - 🔴 Red (0-59): Poor

### Animations:
- **Spinner** - During button loading
- **Progress Bar** - Smooth 0-100% fill
- **Hover Effects** - Button lifts on hover

### Responsive:
- Fits perfectly in sidebar (320px width)
- Scrollable if content is long
- Doesn't break page layout

---

## 🔧 How It Works Technically

### 1. Extract Regulation Slug from URL:
```javascript
function getRegulationSlug() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    const slug = filename.replace('-console.html', '');
    return slug;
}
```

Example:
- URL: `/regulations/ferpa-console.html`
- Slug: `ferpa`

### 2. Call Inquisitor API:
```javascript
const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regulationSlug: 'ferpa' })
});
```

### 3. Display Results:
- Parse JSON response
- Update DOM elements with scores
- Apply color classes
- Show/hide sections

### 4. Error Handling:
- 60-second timeout
- Network error messages
- Server error display

---

## 🚀 Next Steps

### Option 1: Manual (Test One Page)
1. I'll add the widget to FERPA console page
2. You test it
3. If it works, we bulk-add to all pages

### Option 2: Automated (All Pages)
1. I create a Node.js script
2. Script adds widget to all 286 pages
3. Backs up originals first
4. You test multiple pages

### Option 3: Template (Future Pages)
1. Create a template console page
2. Use it for new regulations
3. Existing pages stay as-is

**Which approach do you prefer?**

---

## 📊 Impact

### Before:
- Separate Inquisitor tab on dashboard
- Must select regulation from dropdown
- Can't see quality while viewing regulation

### After:
- Inquisitor embedded on every page
- One-click audit from any regulation
- See quality report right in the sidebar
- No navigation required

**Result:** Much better user experience! 🎉

