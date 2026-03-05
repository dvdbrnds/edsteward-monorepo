# EdSteward Beta Testing Plan

**Version:** 1.4.3  
**Date:** February 11, 2026  
**Audience:** Initial Beta Testers (Institution Administrators)

---

## Welcome

Thank you for being one of our first beta testers for EdSteward — a regulatory compliance platform built specifically for higher education institutions. Your institution has been provisioned as a new tenant, and this guide will walk you through setting up your environment, exploring every feature, and reporting any issues you find.

**Your feedback is critical.** We want you to break things, find edge cases, and tell us what feels wrong, confusing, or missing.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Phase 1: Institution Setup & Branding](#2-phase-1-institution-setup--branding)
3. [Phase 2: User Management & Roles](#3-phase-2-user-management--roles)
4. [Phase 3: Dashboard Exploration](#4-phase-3-dashboard-exploration)
5. [Phase 4: Regulation Management](#5-phase-4-regulation-management)
6. [Phase 5: Compliance Tasks](#6-phase-5-compliance-tasks)
7. [Phase 6: Evidence & Documentation](#7-phase-6-evidence--documentation)
8. [Phase 7: Attestation Workflow](#8-phase-7-attestation-workflow)
9. [Phase 8: Reports & Analytics](#9-phase-8-reports--analytics)
10. [Phase 9: Notifications & Preferences](#10-phase-9-notifications--preferences)
11. [Phase 10: Executive Orders & AI Features](#11-phase-10-executive-orders--ai-features)
12. [Phase 11: Audit Trail](#12-phase-11-audit-trail)
13. [Phase 12: Edge Cases & Stress Testing](#13-phase-12-edge-cases--stress-testing)
14. [Reporting Issues](#14-reporting-issues)
15. [Known Limitations](#15-known-limitations)

---

## 1. Getting Started

### Accessing Your Tenant

Your institution has been provisioned with its own subdomain:

```
https://[your-institution].edsteward.ai
```

You will receive an email with:
- Your subdomain URL
- Your initial admin account credentials (email + temporary password)

### First Login

1. Navigate to your subdomain URL
2. Log in with the admin credentials provided
3. You will be prompted to change your password on first login
4. You will be guided through the **Setup Wizard**

### Setup Wizard

The setup wizard walks you through initial configuration:
- **Admin Account Confirmation** — Verify your name, email, and role
- **Office/Role Assignments** — Define your institution's compliance offices
- **Distribution Lists** — Configure who gets notified for what
- **SSO Configuration** (optional) — Set up your Okta/SAML redirect URI if applicable

> **Test this:** Try completing the wizard fully. Then try skipping optional steps. Note if anything is confusing or unclear.

---

## 2. Phase 1: Institution Setup & Branding

**Goal:** Make EdSteward look and feel like it belongs to your institution.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 1.1 | Go to **Admin Settings > Branding** | Upload your institution's logo |
| 1.2 | Set your primary brand color | Verify the color applies across the UI consistently |
| 1.3 | Check the login page | Does it show your branding? |
| 1.4 | Check the public dashboard | Does it reflect your institution's identity? |
| 1.5 | Try uploading different logo formats | PNG, JPG, SVG — which work? Any size issues? |

### Questions to Answer
- [ ] Branding feels professional and complete
- [ ] Institution name/logo appears everywhere it should
- [ ] Color contrast is readable with your brand color

---

## 3. Phase 2: User Management & Roles

**Goal:** Set up your team and verify role-based access works correctly.

### Roles Available
| Role | Access Level |
|------|-------------|
| **Admin** | Full access — settings, users, all compliance data |
| **Compliance Officer** | Manage regulations, tasks, evidence, attestations |
| **Department Head** | View and manage tasks assigned to their department |
| **Viewer** | Read-only access to dashboards and reports |

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 2.1 | Go to **Admin Settings > Users** | Create at least one user for each role |
| 2.2 | Create a Compliance Officer account | Use a real email — they'll get an invitation |
| 2.3 | Create a Department Head account | Assign them to a specific department/office |
| 2.4 | Create a Viewer account | Verify they truly can only view, not edit |
| 2.5 | Edit an existing user | Change their role, name, or email |
| 2.6 | Reset a user's password | Does the password reset flow work? |
| 2.7 | Log in as each role | Verify the correct pages and actions are visible/hidden |

### Questions to Answer
- [ ] It is clear what each role can and cannot do
- [ ] User creation flow is intuitive
- [ ] All invitation emails arrived promptly
- [ ] Viewer role cannot accidentally modify anything

---

## 4. Phase 3: Dashboard Exploration

**Goal:** Familiarize yourself with the main dashboard and its widgets.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 3.1 | Explore the **main dashboard** | Identify all widgets available |
| 3.2 | Drag and drop widgets | Rearrange the dashboard layout |
| 3.3 | Review **Dashboard Stats** | Do the numbers make sense? |
| 3.4 | Check **My Tasks** widget | Are your assigned tasks showing? |
| 3.5 | Check **Pending Attestations** | Accurate count? |
| 3.6 | Review **Compliance Overview** (pie chart) | Is the visualization clear? |
| 3.7 | Check **Upcoming Deadlines** | Do they reflect real dates? |
| 3.8 | Open the **Deadline Calendar** | Navigate between months. Any issues? |
| 3.9 | Check **Recent Notifications** | Are they relevant and timely? |
| 3.10 | Toggle **Dark Mode** | Does the entire UI switch cleanly? |
| 3.11 | Try **keyboard shortcuts** | Do they work as expected? |

### Questions to Answer
- [ ] Dashboard is useful at a glance
- [ ] Widget selection covers everything you need
- [ ] Dashboard layout persists after page refresh
- [ ] Dark mode is fully supported (no unreadable text or missing styles)

---

## 5. Phase 4: Regulation Management

**Goal:** Explore the regulations pre-loaded for your institution and understand how they're organized.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 4.1 | Browse the **Regulations** list | Review the pre-loaded regulations (FERPA, Title IX, etc.) |
| 4.2 | Open a regulation detail page | Review the full regulation information |
| 4.3 | Check regulation metadata | Filing deadlines, agency contacts, related regulations |
| 4.4 | Review **version history** for a regulation | Can you see past versions? |
| 4.5 | Check for **regulation updates** | Are there any pending updates to review? |
| 4.6 | Accept/reject a regulation update | Does the workflow make sense? |
| 4.7 | Review **risk scores** | Do the 1-100 risk scores feel appropriate? |
| 4.8 | Check regulation sources | Federal, state, accreditor — are they labeled correctly? |
| 4.9 | Use the **Regulation List** widget on dashboard | Quick access working? |

### Questions to Answer
- [ ] Pre-loaded regulations are relevant to your institution
- [ ] No important regulations are missing
- [ ] Regulation detail page is informative without being overwhelming
- [ ] Version control / update workflow makes sense

---

## 6. Phase 5: Compliance Tasks

**Goal:** This is the core of EdSteward. Test task assignment, status tracking, and the full task lifecycle.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 5.1 | Browse compliance tasks tied to a regulation | Are they organized hierarchically? |
| 5.2 | Open a task detail view | Review all fields: status, priority, DRI, due date |
| 5.3 | Assign a **DRI** (Direct Responsible Individual) to a task | Assign to one of the users you created |
| 5.4 | Change a task's **status** | Cycle through: pending → in_progress → completed |
| 5.5 | Set a task as **not_applicable** | Does it properly exclude from compliance calculations? |
| 5.6 | Set a task as **blocked** | Can you add a reason? |
| 5.7 | Test **priority levels** | Set tasks to low, medium, high, critical |
| 5.8 | Test **requirement type** distinction | Requirement (legally mandated) vs. best practice |
| 5.9 | Test **bulk operations** | Select multiple tasks and change status or assign at once |
| 5.10 | Check the **"My Tasks"** view | Does it filter correctly to your assigned tasks? |
| 5.11 | Review the **task activity log** | Is all activity tracked? |
| 5.12 | Test **email task links** | Click a `/task/:token` link from an email — does it work? |
| 5.13 | Test **overdue task handling** | Set a task due date in the past — does it flag as overdue? |

### Questions to Answer
- [ ] Task hierarchy is clear and navigable
- [ ] Easy to understand what needs to be done and by whom
- [ ] Bulk operations work smoothly
- [ ] Email-based task access is useful

---

## 7. Phase 6: Evidence & Documentation

**Goal:** Upload and manage compliance evidence attached to tasks.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 6.1 | Upload a **PDF document** as evidence | Attach to a specific task |
| 6.2 | Upload an **image** as evidence | Screenshot of a policy, etc. |
| 6.3 | Add a **link** as evidence | URL to an institutional policy page |
| 6.4 | Mark evidence as an **official document** | Does the flag display correctly? |
| 6.5 | Upload evidence with different **types** | document, link, screenshot, attestation, form |
| 6.6 | Try uploading a **large file** | What's the size limit? Is there an error message? |
| 6.7 | Try uploading an **unsupported file type** | Is the error message helpful? |
| 6.8 | Download/view previously uploaded evidence | Can you retrieve what you uploaded? |
| 6.9 | Delete evidence | Does removal work cleanly? |

### Questions to Answer
- [ ] Upload process is intuitive
- [ ] Evidence types are clear and useful
- [ ] Available evidence types cover your needs
- [ ] Easy to find and review evidence for a given task

---

## 8. Phase 7: Attestation Workflow

**Goal:** Test the sign-off and attestation process — this is how responsible individuals certify compliance.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 7.1 | Request an attestation for a task | Assign a DRI and trigger attestation |
| 7.2 | Check the **attestation email** | Does the magic link arrive? |
| 7.3 | Click the attestation magic link | Does it load the correct task? |
| 7.4 | Complete an **attestation** (sign off) | Full attestation workflow |
| 7.5 | Test **one-click attestation** | For low-risk regulations — is it available? |
| 7.6 | **Reject** an attestation | Does the rejection reason get captured? |
| 7.7 | Check attestation status on the task | pending → attested or rejected |
| 7.8 | Review attestations on the **dashboard** | Pending attestations widget accurate? |
| 7.9 | Test attestation with different user roles | Can a Viewer attest? (They shouldn't be able to) |

### Questions to Answer
- [ ] Attestation workflow is clear to non-technical users
- [ ] Magic link emails look professional and trustworthy
- [ ] One-click attestation feels appropriately secure
- [ ] Signature/approval workflow options are sufficient

---

## 9. Phase 8: Reports & Analytics

**Goal:** Generate reports and review compliance analytics.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 8.1 | Go to **/reports** | Review available report types |
| 8.2 | Generate a **compliance report** | Is the data accurate? |
| 8.3 | **Export to CSV** | Open in Excel/Google Sheets — is the format clean? |
| 8.4 | Export an **audit trail** | Review the exported data for completeness |
| 8.5 | Visit **/analytics** (Executive Dashboard) | Review compliance metrics and visualizations |
| 8.6 | Visit **/task-analytics** | Task-specific analytics |
| 8.7 | Test with **different date ranges** | Do filters work correctly? |

### Questions to Answer
- [ ] Reports are useful for board meetings or accreditation reviews
- [ ] Available report types cover your needs
- [ ] Analytics visualizations are clear and accurate
- [ ] CSV export format is usable in your existing workflows

---

## 10. Phase 9: Notifications & Preferences

**Goal:** Configure and test the notification system.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 9.1 | Go to **/notifications** | Review existing notifications |
| 9.2 | Configure **notification preferences** | Toggle different notification types on/off |
| 9.3 | Set up **email digest** preferences | Daily, weekly, or individual |
| 9.4 | Trigger a notification | (Assign a task, complete an attestation, etc.) |
| 9.5 | Check **deadline reminders** | Are upcoming deadlines flagged? |
| 9.6 | Test **regulation update alerts** | Are you notified when regs change? |
| 9.7 | Go to **Account Settings** | Update your profile, password, MFA |
| 9.8 | Enable **MFA** (multi-factor authentication) | Does the setup flow work? |

### Questions to Answer
- [ ] Notifications are timely and relevant (not noisy)
- [ ] Digest frequency is configurable enough
- [ ] Notification channels cover your needs (no Slack/Teams needed)
- [ ] MFA setup is smooth

---

## 11. Phase 10: Executive Orders & AI Features

**Goal:** Explore the AI-powered regulation monitoring features.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 10.1 | Go to **/executive-orders** | Browse tracked Executive Orders |
| 10.2 | Review an **EO impact analysis** | Does the AI analysis make sense? |
| 10.3 | Check **regulation validation levels** | L.O.V.V. levels A through D |
| 10.4 | Review **auto-generated compliance tasks** | Are AI-created tasks relevant? |
| 10.5 | Check for **Federal Register integration** | Are updates coming through? |

### Questions to Answer
- [ ] AI analysis is helpful and actionable
- [ ] Auto-generated tasks are reasonable starting points
- [ ] Risk scores feel trustworthy for prioritization
- [ ] AI feature set covers your current needs

---

## 12. Phase 11: Audit Trail

**Goal:** Verify that all compliance activities are being tracked for accountability.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 11.1 | Go to **/audit-trail** | Review the full activity log |
| 11.2 | Verify actions are logged | Task changes, evidence uploads, attestations, logins |
| 11.3 | Search/filter the audit trail | Can you find specific events? |
| 11.4 | **Export to CSV** | Is the export complete and well-formatted? |
| 11.5 | Check **who did what, when** | Is attribution clear? |

### Questions to Answer
- [ ] Audit trail is sufficient for an accreditation review
- [ ] All important actions are being logged
- [ ] Search/filter functionality is adequate

---

## 13. Phase 12: Edge Cases & Stress Testing

**Goal:** Try to break things. Seriously.

### Tasks to Complete

| # | Task | What to Test |
|---|------|-------------|
| 12.1 | Enter **very long text** in all fields | Names, descriptions, notes — what's the limit? |
| 12.2 | Enter **special characters** | Accented letters, emojis, HTML tags, SQL-like strings |
| 12.3 | Open the app on **mobile** (phone & tablet) | Is it responsive and usable? |
| 12.4 | Use the app in **multiple browser tabs** | Does state sync correctly? |
| 12.5 | Test with **slow internet** | Throttle your connection — does it degrade gracefully? |
| 12.6 | Try accessing pages you **shouldn't have access to** | Direct URL manipulation |
| 12.7 | Rapidly click buttons / submit forms | Double-submit protection? |
| 12.8 | Leave the app open for a long time | Does the session expire gracefully? |
| 12.9 | Use **browser back/forward** buttons | Does navigation work predictably? |
| 12.10 | Test with **keyboard only** (no mouse) | Accessibility — can you tab through everything? |
| 12.11 | Test with a **screen reader** if available | Accessibility — are elements properly labeled? |
| 12.12 | Open **many regulations/tasks** | Performance with volume |

---

## 14. Reporting Issues

### How to Report

Please report all issues, suggestions, and feedback via **email** to:

**beta@edsteward.ai** (or the designated contact you've been given)

### What to Include

For every issue, please provide:

1. **What you were trying to do** (the action)
2. **What you expected to happen** (expected behavior)
3. **What actually happened** (actual behavior)
4. **Steps to reproduce** (numbered steps)
5. **Screenshots** (if applicable)
6. **Browser & device** (e.g., Chrome 120 on MacBook, Safari on iPhone 15)
7. **Severity rating:**
   - **Critical** — Can't complete a core workflow, data loss
   - **Major** — Feature doesn't work as expected, workaround exists
   - **Minor** — Cosmetic issue, typo, minor UX improvement
   - **Enhancement** — Feature request or suggestion

### Feedback Categories

When reporting, please tag your feedback:

- `[BUG]` — Something is broken
- `[UX]` — Confusing or unintuitive experience
- `[FEATURE]` — Missing feature or enhancement request
- `[CONTENT]` — Wrong/missing regulation data, incorrect labels
- `[PERFORMANCE]` — Slow loading, lag, timeouts
- `[SECURITY]` — Potential security concern
- `[ACCESSIBILITY]` — Accessibility issue

---

## 15. Known Limitations

Please be aware of these known items — you don't need to report these:

| Item | Status |
|------|--------|
| SSO/SAML (Okta) setup requires manual configuration | In progress |
| No automated test coverage yet | Planned for Q1 2026 |
| Admin console (`admin.edsteward.ai`) not yet publicly deployed | In progress |
| Custom report builder not yet available | Planned Q2 2026 |
| AI compliance gap analysis not yet available | Planned Q2 2026 |
| Natural language regulation queries not yet available | Planned Q2 2026 |
| MSCHE-specific accreditation tracking not yet available | Planned Q3-Q4 2026 |
| Title IX compliance module (standalone) not yet available | Planned Q3-Q4 2026 |
| Clery Act reporting module not yet available | Planned Q3-Q4 2026 |
| SMS notifications require configuration | Contact us for setup |

---

## Beta Testing Timeline

| Week | Focus Area | Phases |
|------|-----------|--------|
| **Week 1** | Setup & Orientation | Phases 1-3 (Branding, Users, Dashboard) |
| **Week 2** | Core Compliance | Phases 4-6 (Regulations, Tasks, Evidence) |
| **Week 3** | Workflows & Reporting | Phases 7-9 (Attestations, Reports, Notifications) |
| **Week 4** | Advanced & Stress Testing | Phases 10-12 (AI, Audit, Edge Cases) |

> These are guidelines, not hard deadlines. Go at your own pace, but please try to cover all phases within 4 weeks.

---

## Thank You

Your participation as a beta tester is shaping the future of compliance management in higher education. Every bug you find, every suggestion you make, and every "this is confusing" moment you report helps us build a better product for institutions like yours.

**Questions?** Reach out to your EdSteward contact at any time.

---

*EdSteward — Simplifying Compliance for Higher Education*
