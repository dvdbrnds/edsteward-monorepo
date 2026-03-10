# EdSteward Complete Manual Testing Script
**Version:** 1.2.5 (BETA)  
**Role Required:** Admin  
**Estimated Time:** 2-3 hours for complete walkthrough

---

## Pre-Test Setup

### Environment
- [ ] Clear browser cache and cookies
- [ ] Open browser in incognito/private mode
- [ ] Have a second email account ready for attestation testing
- [ ] Navigate to: `https://moravian.edsteward.ai` (or `http://localhost:3000` for dev)

---

## PART 1: Authentication (15 min)

### 1.1 Login Page Elements
- [ ] **Logo** - Verify Moravian University logo displays
- [ ] **Page Title** - Shows "Moravian University Compliance Portal"
- [ ] **Login Tab** - Click to ensure it's selected
- [ ] **Register Tab** - Click to switch to registration form
- [ ] **Username Field** - Click, type test text, clear
- [ ] **Password Field** - Click, type test text, verify masked
- [ ] **Login Button** - Visible and styled correctly
- [ ] **SSO Button** - "Sign in with Moravian University SSO" visible
- [ ] **Okta Logo** - Displays next to SSO button

### 1.2 Login Flow
- [ ] Enter invalid username → Click Login → Verify error message
- [ ] Enter valid username, wrong password → Click Login → Verify error
- [ ] Enter valid credentials (username: `dvdbrnds`, password: `gabadhgabadh`)
- [ ] Click **Login** button
- [ ] Verify redirect to Dashboard

### 1.3 SSO Login (if available)
- [ ] Click **"Sign in with Moravian University SSO"**
- [ ] Verify redirect to Okta login page
- [ ] Complete Okta login
- [ ] Verify redirect back to Dashboard

---

## PART 2: Navigation Bar (10 min)

### 2.1 Navigation Elements
- [ ] **Logo** (left) - Click → Should go to Dashboard
- [ ] **"Compliance Portal"** text - Visible
- [ ] **"BETA v1.2.5"** badge - Amber badge visible
- [ ] **Dashboard** link - Click → Verify navigation
- [ ] **Analytics** link - Click → Verify navigation
- [ ] **Notifications** link - Click → Verify navigation
- [ ] **Regulation Updates** link - Click → Verify navigation (admin/CO only)
- [ ] **System Settings** link - Click → Verify navigation (admin only)
- [ ] **Audit Trail** link - Click → Verify navigation (admin only)

### 2.2 Right Side Elements
- [ ] **Dark Mode Toggle** (sun/moon icon) - Click → Verify theme changes
- [ ] **Dark Mode Toggle** - Click again → Verify theme reverts
- [ ] **User Dropdown** - Click username → Dropdown opens
- [ ] **"My Account"** label - Visible in dropdown
- [ ] **"Account Settings"** - Click → Navigate to account settings
- [ ] Return to Dashboard via nav
- [ ] **User Dropdown** → **"Light/Dark Mode"** - Click → Theme changes
- [ ] **User Dropdown** → **"Logout"** - DO NOT CLICK YET

### 2.3 Mobile Menu (resize browser to mobile width)
- [ ] **Hamburger Menu** (☰) - Appears on mobile
- [ ] Click hamburger → Mobile menu opens
- [ ] All nav links visible in mobile menu
- [ ] Click a link → Menu closes, navigates
- [ ] **X button** - Closes mobile menu
- [ ] Resize browser back to desktop width

---

## PART 3: Dashboard - Overview Tab (25 min)

### 3.1 Page Header
- [ ] **Welcome message** - "Welcome, [username]"
- [ ] **Subtitle** - "Drag widgets to rearrange your dashboard" visible
- [ ] **Widgets Button** (top right) - Click → Dropdown opens

### 3.2 Widget Drag-and-Drop Reordering
- [ ] **Hover over any widget** - Drag handle (⠿) appears on left side
- [ ] **Drag handle visible** - 6-dot grip icon appears on hover
- [ ] **Drag a widget** - Grab handle, drag to new position
- [ ] **Visual feedback** - Widget gets shadow and slight scale during drag
- [ ] **Drop widget** - Release in new position
- [ ] **Order persists** - Refresh page, verify new order is saved
- [ ] **Drag Stats widget** - Move it below My Tasks
- [ ] **Drag it back** - Return Stats to original position
- [ ] **Try dragging multiple widgets** - Reorder several widgets
- [ ] **Verify layout adapts** - Full/half/quarter width widgets group correctly

### 3.3 Widgets Dropdown (Visibility & Reset)
- [ ] Click **"Widgets"** button (top right)
- [ ] **Show All** button - Click if widgets are hidden
- [ ] **Reset** button - Click → Order resets to default
- [ ] **Stats toggle** - Click off, verify widget hides
- [ ] **Stats toggle** - Click on, verify widget shows
- [ ] **My Tasks toggle** - Click on/off, verify widget shows/hides
- [ ] **Pending Attestations toggle** - Click on/off, verify widget shows/hides
- [ ] **Compliance Overview toggle** - Click on/off, verify widget shows/hides
- [ ] **Upcoming Deadlines toggle** - Click on/off, verify widget shows/hides
- [ ] **Notifications toggle** - Click on/off, verify widget shows/hides
- [ ] **Deadline Calendar toggle** - Click on/off, verify widget shows/hides
- [ ] **Trustees Card toggle** - Click on/off, verify widget shows/hides
- [ ] **Regulations List** - Cannot be hidden (core functionality)
- [ ] Turn all widgets back ON
- [ ] Close dropdown

### 3.5 Dashboard Tabs
- [ ] **Overview tab** - Click → Shows widgets
- [ ] **Analytics tab** - Click → Shows executive dashboard
- [ ] Switch back to **Overview tab**

### 3.6 Dashboard Stats Widget
- [ ] **Total Regulations** card - Shows number
- [ ] **Compliant** card - Shows number with percentage
- [ ] **Pending** card - Shows number
- [ ] **Overdue** card - Shows number (red if > 0)

### 3.7 My Tasks Widget
- [ ] **"My Tasks"** header visible
- [ ] **View All** button - Click → Opens task list
- [ ] Task items show name, status, due date
- [ ] Click on a task → Opens task detail or navigates

### 3.8 Pending Attestations Widget
- [ ] **"Pending Attestations"** header visible
- [ ] List of pending attestation requests
- [ ] **Quick Attest** button on each item
- [ ] Click **Quick Attest** → Attestation dialog opens
- [ ] Cancel/close the dialog

### 3.9 Compliance Overview Widget
- [ ] **Pie chart** displays
- [ ] **Legend** shows categories
- [ ] Hover over pie slice → Tooltip shows details
- [ ] Click pie slice → Filters regulation list below

### 3.10 Upcoming Deadlines Widget
- [ ] **List of deadlines** displays
- [ ] **Date** shown for each
- [ ] **Color coding** - Red (overdue), Yellow (soon), Green (OK)
- [ ] Click deadline → Navigates to regulation

### 3.11 Recent Notifications Widget
- [ ] **Bell icon** in header
- [ ] List of recent notifications
- [ ] Click notification → Navigates to regulation
- [ ] **Status icons** (green checkmark for sent)

### 3.12 Deadline Calendar Widget (if enabled)
- [ ] **Calendar view** displays
- [ ] **Month/week navigation** arrows
- [ ] **Deadlines marked** on calendar
- [ ] Click date with deadline → Shows details

### 3.13 All Regulations Table
- [ ] **Table displays** with columns
- [ ] **Column headers**: Name, Category, Status, Actions, etc.
- [ ] **Column visibility** (gear icon) - Click → Show column toggles
- [ ] Toggle columns on/off → Table updates
- [ ] **Sort** - Click column header → Sorts ascending
- [ ] Click again → Sorts descending
- [ ] **Search/filter** - Type in search box → Table filters
- [ ] Clear search
- [ ] **Action icons** on each row (checkmarks, attestation status)
- [ ] **Click regulation row** → Navigates to detail page

---

## PART 4: Dashboard - Analytics Tab (10 min)

### 4.1 Executive Dashboard
- [ ] Click **Analytics tab**
- [ ] **Compliance Score** - Large percentage display
- [ ] **Summary Cards** - Multiple metric cards
- [ ] **Charts** - Bar/line charts display
- [ ] **Time Range Selector** (if present) - Change range
- [ ] Hover over chart elements → Tooltips show
- [ ] Return to **Overview tab**

---

## PART 5: Regulation Detail Page (30 min)

### 5.1 Navigate to a Regulation
- [ ] From Dashboard, click on any regulation (e.g., "Clery Act")
- [ ] **Page loads** without errors

### 5.2 Hero Section
- [ ] **Regulation name** displays prominently
- [ ] **Category badge** shows
- [ ] **Compliance progress** - "X/Y Tasks" with percentage
- [ ] **Progress bar** visualization
- [ ] **Primary DRI** - Shows assigned person or "Unassigned"
- [ ] **"Assign DRI"** button - Click → Opens assignment dialog
- [ ] Select a user from dropdown
- [ ] **Cancel** button - Close without saving
- [ ] **"Request Attestation"** button - Click → Opens attestation dialog
- [ ] **Cancel** attestation dialog

### 5.3 Compliance Tasks Accordion
- [ ] **"Compliance Tasks"** section visible
- [ ] **Expand/collapse** accordion header
- [ ] **Task list** displays hierarchically
- [ ] **Parent tasks** with expand arrows
- [ ] Click expand arrow → Shows subtasks
- [ ] **Task checkbox** - Click → Toggles complete/incomplete
- [ ] Click checkbox again → Toggles back
- [ ] **Task name** displays
- [ ] **"Bulk Operations"** button - Click → Shows options
- [ ] **"Complete All"** button - DO NOT CLICK (or click and undo)
- [ ] **"Reset All"** button - Available
- [ ] **Task detail** - Click task name → Opens detail dialog

### 5.4 Task Detail Dialog
- [ ] **Task name** in header
- [ ] **Description** section
- [ ] **Status** indicator
- [ ] **Due date** shown
- [ ] **Assigned to** shown
- [ ] **Evidence Upload** section
- [ ] **Choose File** button - Click → File picker opens
- [ ] Cancel file picker
- [ ] **Existing evidence** list (if any)
- [ ] **Download** button on evidence
- [ ] **Delete** button on evidence
- [ ] **Close** dialog button (X or Cancel)

### 5.5 Evidence Files Section (in accordion)
- [ ] **"Evidence Files"** accordion section
- [ ] Expand section
- [ ] **Upload area** - "Drag & drop or click"
- [ ] Click upload area → File picker opens
- [ ] Select a test file (PDF, image, etc.)
- [ ] **Upload progress** shows
- [ ] **File appears** in list
- [ ] **File name** displayed
- [ ] **Download** icon - Click → File downloads
- [ ] **Delete** icon - Click → Confirmation appears
- [ ] Confirm delete → File removed
- [ ] **Signature** - Shows uploader name and timestamp

### 5.6 Notes Section (in accordion)
- [ ] **"Notes"** accordion section
- [ ] Expand section
- [ ] **"Add Note"** button - Click → Note form opens
- [ ] **Title field** - Type test title
- [ ] **Content field** - Type test content
- [ ] **Category dropdown** - Click → Options show
- [ ] Select a category
- [ ] **Private toggle** - Click → Toggles
- [ ] **"Save"** button - Click → Note saves
- [ ] **Note appears** in list
- [ ] **Edit** icon on note - Click → Edit form opens
- [ ] Make a change
- [ ] **"Update"** button - Click → Changes save
- [ ] **Delete** icon on note - Click → Confirmation
- [ ] Cancel deletion (or confirm and re-add)

### 5.7 Status History Tab
- [ ] **"Status History"** tab - Click
- [ ] **Timeline view** displays
- [ ] **Entries** show date, action, user
- [ ] **Entry types**: Update Received, Update Accepted, Attestation Requested, Attested By
- [ ] Scroll through history

### 5.8 Full Text & Details
- [ ] **"Full Text"** accordion section
- [ ] Expand → Full regulation text shows
- [ ] **Scroll** through text
- [ ] **"Requirements"** section - Shows requirements summary
- [ ] **"Filing Deadlines"** section - Shows deadline info
- [ ] **ECFR link** (if present) - Click → Opens in new tab

### 5.9 Request Attestation Flow
- [ ] Click **"Request Attestation"** button
- [ ] **Dialog opens** with form
- [ ] **Select recipient** dropdown - Click → Users list
- [ ] Select a user with email
- [ ] **Message field** - Type custom message
- [ ] **"Send Request"** button - Click → Email sent
- [ ] **Success toast** appears
- [ ] **Close dialog**

### 5.10 Escalate Issue
- [ ] **"Escalate Issue"** button - Click
- [ ] **Dialog opens**
- [ ] **Reason field** - Type escalation reason
- [ ] **Priority dropdown** - Select priority
- [ ] **Cancel** button - Close dialog

---

## PART 6: Regulation Updates Page (15 min)

### 6.1 Navigate
- [ ] Click **"Regulation Updates"** in nav

### 6.2 Updates List
- [ ] **Page title** "Pending Updates"
- [ ] **Refresh** button - Click → List refreshes
- [ ] **Last updated** timestamp shows
- [ ] **Updates list** displays cards/rows
- [ ] **Checkbox** on each update - Click → Selects
- [ ] **Select multiple** updates
- [ ] **"Accept Selected"** button - Appears when selected
- [ ] **"Delete Selected"** button - Appears when selected
- [ ] Deselect all

### 6.3 Individual Update Card
- [ ] **Regulation name** displayed
- [ ] **Update date** shown
- [ ] **Change stats** - Added/removed percentages
- [ ] **Status badge** - Pending/Accepted
- [ ] **"View Diff"** button - Click → Opens differential view
- [ ] **"Accept"** button - Click → Accepts update
- [ ] **"Delete"** button - Click → Deletes update

### 6.4 Differential View
- [ ] Click **"View Diff"** on an update
- [ ] **Page loads** differential view
- [ ] **Side-by-side comparison** - Original vs Updated
- [ ] **Color coding** - Green (added), Red (removed)
- [ ] **Scroll** through changes
- [ ] **"Accept Update"** button at bottom
- [ ] **"Back"** button - Return to list

---

## PART 7: Analytics Page (10 min)

### 7.1 Navigate
- [ ] Click **"Analytics"** in nav

### 7.2 Analytics Dashboard
- [ ] **Page loads** without errors
- [ ] **Compliance overview** metrics
- [ ] **Charts** display (bar, line, pie)
- [ ] **Hover** over chart elements → Tooltips
- [ ] **Time range** selector (if present)
- [ ] **Category breakdown** section
- [ ] **Export** button (if present)

---

## PART 8: Notifications Page (15 min)

### 8.1 Navigate
- [ ] Click **"Notifications"** in nav

### 8.2 Page Elements
- [ ] **Page title** "Notifications"
- [ ] **Filter buttons** - All, Sent, Pending, Failed
- [ ] Click **"All"** → Shows all notifications
- [ ] Click **"Sent"** → Filters to sent only
- [ ] Click **"Pending"** → Filters to pending
- [ ] Click **"Failed"** → Filters to failed
- [ ] Click **"All"** again

### 8.3 Sort Options
- [ ] **Sort dropdown** or column headers
- [ ] Click **Date** column → Sorts by date
- [ ] Click again → Reverses sort
- [ ] Click **Type** column → Sorts by type
- [ ] Click **Status** column → Sorts by status
- [ ] Click **Priority** column → Sorts by priority

### 8.4 Notification List
- [ ] **Notification cards/rows** display
- [ ] **Type** shown (deadline, update, attestation)
- [ ] **Status badge** - Sent (green), Pending (yellow), Failed (red)
- [ ] **Priority badge** - High, Normal, Low
- [ ] **Date/time** displayed
- [ ] **Recipient** name shown
- [ ] **Regulation** name (if applicable)

### 8.5 Create Notification (Admin)
- [ ] **"Create Notification"** button - Click
- [ ] **Dialog opens**
- [ ] **Notification type** dropdown - Select type
- [ ] **Recipient** selector - Select user(s)
- [ ] **Priority** dropdown - Select priority
- [ ] **Message** field - Type message
- [ ] **Cancel** button - Close dialog
- [ ] Reopen and fill all fields
- [ ] **"Send"** button - Click → Notification created
- [ ] **Success toast** appears

### 8.6 Notification Details
- [ ] Click on a notification row
- [ ] **Details** expand or dialog opens
- [ ] **Full content** visible
- [ ] **Retry** button on failed notifications

---

## PART 9: Audit Trail Page (15 min)

### 9.1 Navigate
- [ ] Click **"Audit Trail"** in nav

### 9.2 Page Elements
- [ ] **Page title** "Audit Trail"
- [ ] **Search field** - Type to search
- [ ] **Entity Type filter** dropdown - Select type
- [ ] **Action filter** dropdown - Select action
- [ ] **Risk Level filter** dropdown - Select level
- [ ] **Clear filters** button

### 9.3 Audit Log Table
- [ ] **Table displays** with columns
- [ ] **Timestamp** column
- [ ] **User** column (email)
- [ ] **Action** column
- [ ] **Entity** column
- [ ] **Risk Level** badge
- [ ] **IP Address** column

### 9.4 Filtering & Sorting
- [ ] Type in **search** → Table filters
- [ ] Clear search
- [ ] Select **Entity Type** → Table filters
- [ ] Clear filter
- [ ] Select **Action** → Table filters
- [ ] Clear filter
- [ ] Click **column header** → Sorts
- [ ] Click again → Reverses

### 9.5 View Details
- [ ] Click **"View"** icon on a log entry
- [ ] **Details panel/dialog** opens
- [ ] **Previous values** shown (if applicable)
- [ ] **New values** shown (if applicable)
- [ ] **Changes** highlighted
- [ ] **Close** details

### 9.6 Export
- [ ] **"Export CSV"** button - Click
- [ ] **File downloads** (compliance-audit-report-DATE.csv)
- [ ] Open CSV → Verify data

---

## PART 10: System Settings (Admin) (25 min)

### 10.1 Navigate
- [ ] Click **"System Settings"** in nav

### 10.2 Institution Tab
- [ ] **"Institution"** tab active by default (or click it)
- [ ] **Institution Name** field - View current value
- [ ] Edit institution name
- [ ] **Institution Type** dropdown - Click → Options show
- [ ] Select different type
- [ ] **Contact Email** field - Edit
- [ ] **Contact Phone** field - Edit
- [ ] **Address** field - Edit
- [ ] **"Save"** button - Click
- [ ] **Success toast** appears
- [ ] Revert changes if needed

### 10.3 Branding Tab
- [ ] Click **"Branding"** tab
- [ ] **Current logo** preview
- [ ] **"Upload Logo"** button - Click → File picker
- [ ] Select a logo image
- [ ] **Logo preview** updates
- [ ] **Primary Color** picker - Click → Color picker opens
- [ ] Select a color
- [ ] **Preview** shows color change
- [ ] **"Save"** button - Click → Changes save
- [ ] **Navigation bar** updates with new color
- [ ] Revert to original color

### 10.4 Notifications Tab
- [ ] Click **"Notifications"** tab
- [ ] **Scheduler enabled** toggle - View state
- [ ] Toggle **ON** → Scheduler activates
- [ ] Toggle **OFF** → Scheduler deactivates
- [ ] **Notification rules** list
- [ ] View/edit rule settings
- [ ] **Save changes**

### 10.5 Email Tab
- [ ] Click **"Email"** tab
- [ ] **SMTP Host** field - View/edit
- [ ] **SMTP Port** field - View/edit (typically 587)
- [ ] **Secure** toggle (TLS)
- [ ] **Username** field - View/edit
- [ ] **Password** field - Type to edit (masked)
- [ ] **From Address** field - View/edit
- [ ] **"Test Email"** button - Click
- [ ] Enter test email address
- [ ] **Send test** → Verify email received
- [ ] **"Save"** button - Save settings

### 10.6 SMS Tab
- [ ] Click **"SMS"** tab
- [ ] **Twilio Account SID** field
- [ ] **Twilio Auth Token** field (masked)
- [ ] **Phone Number** field
- [ ] **"Save"** button

### 10.7 Users Tab
- [ ] Click **"Users"** tab
- [ ] **Users table** displays
- [ ] **Columns**: Username, Email, Role, Department, Actions
- [ ] **Search** users - Type in search box
- [ ] Clear search
- [ ] **"Add User"** button - Click → Form opens
- [ ] **Username** field - Type
- [ ] **Email** field - Type
- [ ] **Password** field - Type
- [ ] **First Name** field - Type
- [ ] **Last Name** field - Type
- [ ] **Role** dropdown - Select role
- [ ] **Department** dropdown - Select department
- [ ] **"Cancel"** button - Close form
- [ ] Reopen and create test user
- [ ] **"Create"** button - Click
- [ ] **User appears** in list
- [ ] **Edit** icon on user - Click → Edit form opens
- [ ] Change a field
- [ ] **"Save"** button
- [ ] **Reset Password** button - Click
- [ ] **Confirmation dialog** - Confirm
- [ ] **Delete** icon on user - Click
- [ ] **Confirmation dialog** - Confirm or cancel
- [ ] Delete test user if created

### 10.8 Backups Tab
- [ ] Click **"Backups"** tab
- [ ] **Existing backups** list
- [ ] **Backup name/date** shown
- [ ] **"Create Backup"** button - Click
- [ ] **Backup starts** → Progress shows
- [ ] **Backup completes** → Appears in list
- [ ] **Download** icon - Click → Backup downloads
- [ ] **Delete** icon - Click → Confirmation
- [ ] Cancel deletion
- [ ] **"Restore"** button (if present) - DO NOT CLICK in production

### 10.9 Logs Tab
- [ ] Click **"Logs"** tab
- [ ] **Log entries** display
- [ ] **Level filter** dropdown - Select level
- [ ] **Facility filter** dropdown - Select facility
- [ ] **Date range** picker (if present)
- [ ] **Search** logs
- [ ] **Refresh** button
- [ ] **Log details** - Timestamp, level, message

---

## PART 11: Account Settings (10 min)

### 11.1 Navigate
- [ ] Click **User dropdown** → **"Account Settings"**

### 11.2 Profile Information
- [ ] **Profile card** displays
- [ ] **Username** shown
- [ ] **Email** shown
- [ ] **First Name** shown
- [ ] **Last Name** shown
- [ ] **Department** shown
- [ ] **Role** badge shown
- [ ] **Identity Provider** shown (Local or SSO)

### 11.3 MFA Settings
- [ ] **MFA section** visible
- [ ] **Current status** - Enabled/Disabled
- [ ] If disabled: **"Enable MFA"** button
- [ ] Click **"Enable MFA"**
- [ ] **QR Code** displays
- [ ] **Secret key** shown (for manual entry)
- [ ] **Verification code** field
- [ ] Enter code from authenticator app
- [ ] **"Verify"** button - Click
- [ ] **MFA enabled** confirmation
- [ ] If enabled: **"Disable MFA"** button
- [ ] Click **"Disable MFA"**
- [ ] **Confirmation** dialog
- [ ] Confirm → MFA disabled

### 11.4 Email Preferences
- [ ] **Email Preferences** section
- [ ] **Email Enabled** toggle - Click on/off
- [ ] **Email Frequency** dropdown - Select instant/daily/weekly
- [ ] **Deadline Reminders** toggle - Click on/off
- [ ] **Update Notifications** toggle - Click on/off
- [ ] **Attestation Reminders** toggle - Click on/off
- [ ] **"Save Preferences"** button - Click
- [ ] **Success toast** appears

---

## PART 12: Email Attestation Flow (15 min)

### 12.1 Send Attestation Request
- [ ] Navigate to a regulation detail page
- [ ] Click **"Request Attestation"**
- [ ] Select recipient with valid email
- [ ] Add custom message
- [ ] Click **"Send Request"**
- [ ] Verify **success toast**

### 12.2 Check Email (use second email account)
- [ ] Open recipient's email inbox
- [ ] Find **attestation email**
- [ ] Verify **sender** is correct
- [ ] Verify **subject line** appropriate
- [ ] Verify **email body** contains:
  - [ ] Regulation name
  - [ ] Custom message
  - [ ] **"Complete Attestation"** button

### 12.3 Complete Attestation (in new incognito window)
- [ ] Click **"Complete Attestation"** link in email
- [ ] **New browser tab** opens
- [ ] **Attestation page** loads (no login required)
- [ ] **Regulation name** displayed
- [ ] **Instructions** visible
- [ ] **"I Attest"** button - Click
- [ ] **Confirmation** message appears
- [ ] **Thank you** page displays

### 12.4 Verify in App
- [ ] Return to main browser window
- [ ] Navigate to the regulation
- [ ] Check **attestation status** updated
- [ ] Check **Status History** tab → "Attested By [user]"
- [ ] Check **Audit Trail** → Attestation logged

---

## PART 13: Dark Mode Testing (5 min)

### 13.1 Toggle Dark Mode
- [ ] Click **sun/moon icon** in nav
- [ ] **Entire UI** switches to dark theme
- [ ] Verify all pages look correct:
  - [ ] Dashboard
  - [ ] Regulation Detail
  - [ ] Analytics
  - [ ] Notifications
  - [ ] Audit Trail
  - [ ] System Settings
  - [ ] Account Settings

### 13.2 Verify Elements
- [ ] **Navigation bar** - Dark background
- [ ] **Cards** - Dark backgrounds
- [ ] **Text** - Light colored, readable
- [ ] **Buttons** - Appropriate contrast
- [ ] **Forms** - Inputs visible
- [ ] **Charts** - Colors visible
- [ ] **Tables** - Rows distinguishable

### 13.3 Switch Back
- [ ] Click **sun/moon icon** → Light mode
- [ ] Verify UI reverts correctly

---

## PART 14: Keyboard Shortcuts (5 min)

### 14.1 Test Shortcuts
- [ ] Press **⌘/Ctrl + K** → Search/command palette opens
- [ ] Type search term → Results show
- [ ] Press **Escape** → Closes
- [ ] Press **⌘/Ctrl + /** → Shortcuts help opens (if implemented)

---

## PART 15: Mobile Responsiveness (10 min)

### 15.1 Resize Browser
- [ ] Resize browser to mobile width (~375px)

### 15.2 Test Mobile Elements
- [ ] **Hamburger menu** appears
- [ ] Click hamburger → Menu opens
- [ ] All nav links visible
- [ ] Close menu
- [ ] **Dashboard** - Widgets stack vertically
- [ ] **Tables** - Horizontal scroll works
- [ ] **Buttons** - Touch-friendly size
- [ ] **Forms** - Inputs fill width
- [ ] **Modals** - Fit on screen

### 15.3 Test Key Pages
- [ ] Dashboard mobile view
- [ ] Regulation detail mobile view
- [ ] System settings mobile view
- [ ] Navigate between pages
- [ ] Resize back to desktop

---

## PART 16: Logout (2 min)

### 16.1 Logout Flow
- [ ] Click **User dropdown**
- [ ] Click **"Logout"**
- [ ] **Loading state** shows
- [ ] **Redirect** to login page
- [ ] Try to access protected page → Redirect to login
- [ ] **Session cleared** - Login required

---

## PART 17: Edge Cases & Error Handling (15 min)

### 17.1 Invalid URLs
- [ ] Navigate to `/nonexistent-page`
- [ ] **404 page** displays
- [ ] **Home link** works

### 17.2 Form Validation
- [ ] Try to submit forms with empty required fields
- [ ] **Validation messages** appear
- [ ] Try invalid email format → Error shown
- [ ] Try password too short → Error shown

### 17.3 Network Errors (Developer Tools)
- [ ] Open DevTools → Network tab
- [ ] Enable "Offline" mode
- [ ] Try to load data → Error handling works
- [ ] Disable "Offline" mode
- [ ] **Refresh** → Data loads

### 17.4 Large Data
- [ ] Upload large file (5MB+) → Progress shows
- [ ] Cancel upload → Upload cancels
- [ ] View regulation with many tasks → Performance OK

### 17.5 Session Timeout
- [ ] Leave browser idle for 30+ minutes
- [ ] Try action → Appropriate handling (re-login or refresh)

---

## Test Completion Checklist

### All Tests Passed?
- [ ] Authentication
- [ ] Navigation
- [ ] Dashboard
- [ ] Regulation Details
- [ ] Regulation Updates
- [ ] Analytics
- [ ] Notifications
- [ ] Audit Trail
- [ ] System Settings
- [ ] Account Settings
- [ ] Email Attestation
- [ ] Dark Mode
- [ ] Keyboard Shortcuts
- [ ] Mobile Responsiveness
- [ ] Logout
- [ ] Error Handling

### Issues Found
| Issue # | Page | Description | Severity |
|---------|------|-------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Notes
_Additional observations:_




---

**Testing completed by:** _______________  
**Date:** _______________  
**Browser/Version:** _______________  
**Device:** _______________
