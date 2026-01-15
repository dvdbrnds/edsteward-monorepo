# EdSteward Beta Testing Feature List
**Version:** 1.2.5 (BETA)  
**Last Updated:** January 15, 2026

---

## 🔐 Authentication & User Management

### Login Methods
- [ ] **Username/Password Login** - Standard credential-based authentication
- [ ] **Okta SSO** - Single Sign-On via Moravian University Okta
- [ ] **Session Persistence** - Stay logged in across browser sessions

### Multi-Factor Authentication (MFA)
- [ ] **MFA Setup** - Enable/disable TOTP-based MFA in Account Settings
- [ ] **MFA Login Challenge** - Enter TOTP code when MFA is enabled
- [ ] **Emergency Access** - Backup codes for account recovery

### User Roles
- [ ] **Admin** - Full access to all features including system settings
- [ ] **Compliance Officer** - Access to assigned regulations and tasks
- [ ] **Field Officer** - Limited access, can complete assigned tasks

---

## 📊 Dashboard (Home Page)

### Overview Tab
- [ ] **Welcome Message** - Personalized greeting with username
- [ ] **Dashboard Statistics** - Summary cards showing key metrics
- [ ] **My Tasks Widget** - List of tasks assigned to current user
- [ ] **Pending Attestations Widget** - Quick action for attestation requests
- [ ] **Compliance Overview Widget** - Pie chart of compliance status by category
- [ ] **Upcoming Deadlines Widget** - List of approaching due dates
- [ ] **Recent Notifications Widget** - Latest sent notifications
- [ ] **Widget Customization** - Show/hide widgets via settings gear

### Analytics Tab
- [ ] **Executive Dashboard** - High-level compliance metrics
- [ ] **Charts and Graphs** - Visual representation of compliance data

### Regulation List
- [ ] **All Regulations Table** - Sortable, filterable list of all regulations
- [ ] **Category Filtering** - Filter by regulation category
- [ ] **Search** - Find regulations by name or keyword
- [ ] **Column Visibility** - Show/hide columns (gear icon)
- [ ] **Action Status Icons** - Visual indicators for compliance actions

---

## 📋 Regulation Detail Page

### Hero Section
- [ ] **Regulation Name and Category** - Clear identification
- [ ] **Compliance Progress** - X/Y tasks completed percentage
- [ ] **Primary DRI** - Directly Responsible Individual assignment
- [ ] **Quick Actions** - Assign DRI, Request Attestation buttons

### Compliance Tasks Accordion
- [ ] **Hierarchical Task List** - Nested task/subtask structure
- [ ] **Task Status Toggles** - Mark tasks complete/incomplete
- [ ] **Task Progress Tracking** - Visual progress indicators
- [ ] **Bulk Task Operations** - Complete all, reset all buttons
- [ ] **Auto-Expand Incomplete** - Automatically show pending items

### Task Detail Dialog
- [ ] **Task Description** - Full task details and instructions
- [ ] **Evidence Upload** - Attach supporting documents
- [ ] **Evidence Preview** - Hover to preview uploaded files
- [ ] **Due Date** - Task deadline with status indicator
- [ ] **Assigned User** - Who is responsible

### Evidence Files Section
- [ ] **Upload Files** - Drag & drop or click to upload
- [ ] **File List** - View all uploaded evidence
- [ ] **Download Files** - Download individual files
- [ ] **Delete Files** - Remove uploaded evidence
- [ ] **Signature Display** - Show who uploaded and when

### Notes Section
- [ ] **Add Notes** - Create new notes on regulations
- [ ] **Edit Notes** - Modify existing notes
- [ ] **Delete Notes** - Remove notes
- [ ] **Note Categories** - Organize notes by type
- [ ] **Private Notes** - Notes only visible to creator

### Status History Tab
- [ ] **Timeline View** - Chronological list of status changes
- [ ] **Update Received** - When new regulation updates arrive
- [ ] **Update Accepted** - When updates are approved
- [ ] **Attestation Requested** - When attestation is sent
- [ ] **Attested By** - Who completed attestation and when

### Actions & Attestation
- [ ] **Request Attestation** - Send email to assigned officer
- [ ] **One-Click Attestation** - Complete attestation via email link
- [ ] **Attestation Status** - View current attestation state
- [ ] **Escalate Issue** - Flag regulation for escalation

### Full Text & Details
- [ ] **Full Regulation Text** - Complete regulatory text
- [ ] **Requirements** - Summary of what's required
- [ ] **Filing Deadlines** - Important dates and deadlines
- [ ] **ECFR Links** - Links to official regulation sources

---

## 📬 Email Attestation System

### Attestation Request Flow
- [ ] **Send Attestation Email** - Admin sends request to field officer
- [ ] **One-Click Link** - Email contains direct attestation link
- [ ] **No Login Required** - Token-based authentication
- [ ] **Attestation Completion** - Click button to confirm
- [ ] **Audit Trail Entry** - Automatically logged

### Notification Types
- [ ] **Deadline Reminders** - 90 days, weekly, daily alerts
- [ ] **Update Notifications** - When regulations change
- [ ] **Attestation Reminders** - Follow-up on pending requests
- [ ] **Assignment Notifications** - When assigned new regulations

---

## 🔄 Regulation Updates (MCP Engine)

### Updates List Page
- [ ] **Pending Updates List** - All incoming regulation changes
- [ ] **View Differential** - See what changed (diff view)
- [ ] **Accept Update** - Apply update to regulation
- [ ] **Reject Update** - Dismiss without applying
- [ ] **Bulk Accept** - Accept multiple updates at once
- [ ] **Bulk Delete** - Delete multiple updates
- [ ] **Change Statistics** - Percentage added/removed/changed

### Differential View
- [ ] **Side-by-Side Comparison** - Old vs new text
- [ ] **Highlighting** - Green for additions, red for deletions
- [ ] **Rich Field Display** - Requirements, deadlines, summary
- [ ] **Accept from Diff View** - One-click accept

---

## 📈 Analytics Page

### Compliance Metrics
- [ ] **Overall Compliance Rate** - Percentage across all regulations
- [ ] **Category Breakdown** - Compliance by regulation category
- [ ] **Trend Charts** - Historical compliance over time
- [ ] **Risk Assessment** - Identify high-risk areas

### Task Analytics
- [ ] **Task Completion Rates** - By user, regulation, category
- [ ] **Overdue Tasks** - Highlight pending items
- [ ] **Time to Completion** - Average task completion time

---

## 🔔 Notifications Page

### Notification History
- [ ] **View All Notifications** - Complete history
- [ ] **Filter by Status** - Sent, Pending, Failed
- [ ] **Sort Options** - Date, type, priority
- [ ] **Search Notifications** - Find specific items

### Notification Management
- [ ] **Create Notification** - Admin can send custom notifications
- [ ] **View Details** - See full notification content
- [ ] **Retry Failed** - Resend failed notifications

---

## 🛡️ Audit Trail (Admin Only)

### Audit Log Viewing
- [ ] **View All Actions** - Complete audit history
- [ ] **Filter by Entity** - Regulations, users, tasks
- [ ] **Filter by Action** - Create, update, delete
- [ ] **Filter by Risk Level** - High, medium, low
- [ ] **Search Logs** - Find specific audit entries

### Compliance Reporting
- [ ] **Export CSV** - Download audit report
- [ ] **View Changes** - See before/after values
- [ ] **IP Tracking** - Log source IP addresses
- [ ] **User Attribution** - Who made each change

---

## ⚙️ System Settings (Admin Only)

### Institution Settings
- [ ] **Institution Name** - Set organization name
- [ ] **Institution Type** - University, college, etc.
- [ ] **Contact Information** - Admin contact details

### Branding
- [ ] **Logo Upload** - Custom organization logo
- [ ] **Primary Color** - Navigation bar color
- [ ] **Favicon** - Custom browser tab icon

### Notifications Tab
- [ ] **Scheduler Toggle** - Enable/disable automated notifications
- [ ] **Notification Rules** - Configure when to send alerts

### Email Configuration
- [ ] **SMTP Settings** - Mail server configuration
- [ ] **From Address** - Default sender email
- [ ] **Test Email** - Send test to verify settings

### SMS Configuration
- [ ] **Twilio Settings** - SMS provider configuration
- [ ] **Phone Number** - Sending phone number

### User Management
- [ ] **View All Users** - List of system users
- [ ] **Add User** - Create new accounts
- [ ] **Edit User** - Modify user details
- [ ] **Delete User** - Remove accounts
- [ ] **Reset Password** - Admin password reset

### Backup Management
- [ ] **Create Backup** - Manual database backup
- [ ] **View Backups** - List of available backups
- [ ] **Download Backup** - Export backup file
- [ ] **Restore Backup** - Restore from backup

### System Logs
- [ ] **View Logs** - System activity logs
- [ ] **Filter by Level** - Error, warning, info, debug
- [ ] **Search Logs** - Find specific entries

---

## 👤 Account Settings

### Profile Information
- [ ] **View Profile** - Name, email, department, role
- [ ] **Identity Provider** - Local or SSO indicator

### MFA Settings
- [ ] **Enable MFA** - Turn on two-factor authentication
- [ ] **QR Code Setup** - Scan with authenticator app
- [ ] **Verify Code** - Test MFA setup
- [ ] **Disable MFA** - Turn off two-factor authentication

### Email Preferences
- [ ] **Email Enabled Toggle** - Turn notifications on/off
- [ ] **Email Frequency** - Instant, daily, or weekly digest
- [ ] **Deadline Reminders** - Toggle deadline alerts
- [ ] **Update Notifications** - Toggle regulation update alerts
- [ ] **Attestation Reminders** - Toggle attestation alerts

---

## 🎨 User Interface

### Dark Mode
- [ ] **Toggle Dark Mode** - Sun/moon icon in navigation
- [ ] **System Preference** - Follow OS setting
- [ ] **Persistent Setting** - Remember preference

### Keyboard Shortcuts
- [ ] **⌘/Ctrl + K** - Open command palette/search
- [ ] **⌘/Ctrl + /** - Toggle keyboard shortcuts help
- [ ] **Navigation Shortcuts** - Quick page navigation

### Mobile Responsiveness
- [ ] **Hamburger Menu** - Mobile navigation
- [ ] **Touch-Friendly** - Large tap targets
- [ ] **Responsive Tables** - Horizontal scroll on mobile
- [ ] **Mobile Dashboard** - Stacked widgets on small screens

### Accessibility
- [ ] **ARIA Labels** - Screen reader support
- [ ] **Keyboard Navigation** - Tab through interface
- [ ] **Focus Indicators** - Visible focus states
- [ ] **Color Contrast** - WCAG compliant colors

---

## 📱 Public Pages (No Login Required)

### Trustees Dashboard
- [ ] **Public Compliance View** - Board-level compliance summary
- [ ] **Access via /trustees-dashboard** - Direct URL access

### Email Task Completion
- [ ] **Task via Token** - Complete tasks from email link
- [ ] **No Login Required** - Token-based authentication
- [ ] **Access via /task/:token** - Direct task completion

---

## 🐛 Known Issues to Test

1. **Session Timeout** - Check behavior after extended inactivity
2. **Large File Uploads** - Test with files >10MB
3. **Concurrent Edits** - Multiple users editing same regulation
4. **Email Deliverability** - Verify emails arrive in inbox (not spam)
5. **SSO Redirect Loop** - Ensure smooth SSO authentication
6. **Mobile Safari** - Test all features on iOS Safari

---

## 📝 Feedback Requested

For each feature tested, please note:
1. ✅ **Works as expected** - Feature functions correctly
2. ⚠️ **Works with issues** - Functional but has problems
3. ❌ **Does not work** - Feature is broken
4. 💡 **Suggestion** - Ideas for improvement

Please include:
- Browser and version
- Device type (desktop/mobile)
- Steps to reproduce any issues
- Screenshots if helpful

---

*Thank you for helping test EdSteward!*
