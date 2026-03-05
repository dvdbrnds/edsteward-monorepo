# EdSteward Demo Script

> **Duration:** ~10 minutes  
> **Audience:** Higher Ed Compliance Officers, IT Leadership, Board Members

---

## Opening (30 seconds)

> "EdSteward is a compliance management platform built specifically for higher
> education. It connects to MCP Engine - our regulatory intelligence system - to
> automatically keep your institution current with federal regulations like
> Title IX, FERPA, Clery Act, and more."

---

## Scene 1: The CCO Dashboard (1 min)

**Navigate to:** Dashboard/Home

> "When your Chief Compliance Officer logs in, they see their compliance posture
> at a glance:"

- Overall compliance score weighted by requirement type
- Pending regulation updates requiring review
- Upcoming task deadlines
- Tasks by status across all regulations

**Highlight:** The pending updates badge

> "We have a Title IX update from MCP Engine waiting for review."

---

## Scene 2: Reviewing Regulation Updates (2 min)

**Navigate to:** Regulations → Pending Updates → Title IX

> "MCP Engine monitors the Federal Register and regulatory guidance. When
> something changes, it pushes an update here for CCO review - never a
> surprise."

**Show the Differential View:**

> "On the left, the current regulation text. On the right, what's changing."

> "52 compliance tasks are included - each with priority, evidence requirements,
> and assigned roles."

**Scroll to Tasks section:**

> "See this badge? **'Required: Title IX Coordinator per 34 CFR 106.8'** - this
> task MUST be done by that specific role. It's not a suggestion, it's the law."

**Click Accept:**

> "When I approve this update, EdSteward automatically replaces our tasks with
> the new requirements."

---

## Scene 3: Role Assignments - The Magic (1.5 min)

**Navigate to:** Settings → Roles

> "Here's where EdSteward saves hours of work. We've mapped each compliance role
> to an actual person at the institution."

**Show the table:**

- Title IX Coordinator → Jane Smith
- Registrar → John Doe
- Campus Police Chief → Officer Martinez

> "When I approved that update, all 52 tasks were **automatically assigned** to
> the right people based on these mappings."

**Edit a role:**

> "New registrar? Change it here once. Every future task automatically goes to
> them."

---

## Scene 4: Task Management (1.5 min)

**Navigate to:** A regulation's task list

> "Each task shows:"

- Priority level (high/medium/low)
- Whether it's a legal **requirement** or **best practice**
- Due date
- Evidence requirements
- The statutory role if legally mandated

**Click on a task:**

> "Detailed instructions from MCP Engine"

> "Activity log - who did what, when"

> "Evidence already uploaded"

---

## Scene 5: The Field Officer Experience (2 min)

> "Your Title IX Coordinator or Registrar doesn't need to log into EdSteward
> daily. Here's how they complete compliance tasks:"

**Click "Request Attestation" on a task:**

> "I enter their email and click send. They receive a magic link - no login
> required."

**Show the attestation page:**

> "They see the task, instructions, and what's required."

> "They upload their evidence - a signed form, training records, whatever's
> needed."

> "They digitally sign: _'I, Jane Smith, attest that this task is complete.'_"

> "Done. Full audit trail captured."

---

## Scene 6: Audit Trail & Reports (45 sec)

**Navigate to:** Audit Trail or Reports

> "Everything is logged for your accreditors:"

- When each regulation was updated
- Who approved it
- When tasks were completed
- Digital signatures from attestations
- All evidence uploaded

> "Generate reports for the board, for auditors, for accreditation."

---

## Closing (30 seconds)

> "EdSteward transforms compliance from reactive firefighting to proactive
> management:"

1. **MCP Engine** pushes regulatory updates automatically
2. **Role mappings** assign tasks to the right people
3. **Magic links** let field officers attest without friction
4. **Everything's tracked** for audit

> "Questions?"

---

## Key Features Summary

| Feature                | Business Value                               |
| ---------------------- | -------------------------------------------- |
| MCP Engine sync        | Never miss a regulatory change               |
| Role-to-person mapping | Assign once, apply everywhere                |
| Statutory role badges  | Know what's legally required vs. recommended |
| Magic link attestation | 90% reduction in follow-up emails            |
| Evidence upload        | All documentation in one place               |
| Audit trail            | Accreditation-ready at any time              |

---

## Demo Checklist

Before the demo, ensure:

- [ ] At least one pending regulation update exists
- [ ] Role assignments are configured with real names
- [ ] Some tasks have evidence uploaded
- [ ] A sample attestation email is ready to show

---

## Troubleshooting

| Issue              | Solution                           |
| ------------------ | ---------------------------------- |
| No pending updates | Push a test update from MCP Engine |
| Login issues       | Check PM2: `pm2 status edsteward`  |
| Page not loading   | Hard refresh: Cmd+Shift+R          |

---

_Last updated: January 2026_
