# EdSteward Release Email — v1.5.11

**Subject: Welcome to the EdSteward Beta Group + Latest Updates**

Hi everyone,

Welcome to the EdSteward beta update group! If this is your first email from us, a quick intro: this is where we share product updates, new features, and progress as we build out EdSteward's compliance platform together.

A few of you are joining for the first time — welcome aboard to Almora, Edinger, and Maus. Glad to have you in the fold.

You'll also be seeing some familiar faces from our **LVAIC partner institutions** in this group. We're building EdSteward to serve the full consortium, and having cross-institutional perspective as we develop the product is invaluable. Don't be strangers — feel free to share feedback, ask questions, or flag anything that would make the platform more useful for your team.

With that, here's a rundown of what we've shipped since the last update:

**State Regulation Tracking (NEW)**
- EdSteward now includes **17 Pennsylvania and New Jersey state regulations** — PA Sexual Violence Education Act, PA Graduation Rates Reporting, NJ Campus Sex Assault Victim Bill of Rights, NJ Hazing Prevention, and more
- Use the **Jurisdiction filter** to toggle between Federal, State, and International regulations
- State regulations show the applicable state code (PA, NJ) and are categorized and risk-rated just like federal regulations

**Email Delivery Tracking & Bounce Handling (NEW)**
- Every outbound email (attestation requests, reminders, nudges, escalations) is now logged with full SMTP delivery status
- When an email to a DRI bounces, the system **automatically notifies the CCO and admins** and flags the user's email as unreachable
- New **Email Delivery Issues** panel in Admin Settings → Notifications shows delivered/bounced/failed counts with a filterable issues table
- Task detail dialog shows a **red "bounced" badge** next to any assigned user whose email is flagged — so you immediately see when a DRI is unreachable
- Pre-flight email verification probes the recipient's mail server before sending to catch bad domains and invalid addresses upfront

**Deadline Timeline Indicators (NEW)**
- The regulation list now shows a **color-coded progress bar** for each regulation's next deadline — green (30+ days), yellow (15–30), orange (7–14), red (<7), pulsing red when overdue
- Day count label underneath so you can scan deadlines at a glance

**Confidential Evidence Handling**
- Tasks involving protected data (FERPA records, conduct reports, health info) now automatically show a **"Where is this evidence maintained?"** prompt instead of a file upload — so sensitive documents stay in their secure systems

**Disable Regulation Per Institution**
- Admins can now **disable regulations that don't apply** to your institution, with a required reason — disabled regulations are filtered out of the main list

**Regulation Feedback**
- Any user can now submit corrections, clarifications, or additional context about a regulation directly from its detail page via the **Feedback button**

**Interactive Product Tour**
- First-time users are now greeted with a **guided spotlight tour** that highlights key navigation elements

**Circuit Court Interpretation Tracking**
- Each regulation page now has a **Circuit Court Interpretations** panel showing how different federal circuits interpret the regulation
- **Active circuit split alerts** when circuits disagree, so you know where compliance risk is highest
- Initial data covers Title IX, FERPA, Clery Act, and GLBA

**Office vs. DRI Separation**
- Tasks now distinguish between the **responsible office** (e.g., "Office of General Counsel") and the **DRI** (the person who signs attestations)
- Attestation completion emails CC the responsible office

**Other Improvements**
- Backup/restore system rewritten for safety — automatic safety backup before restore, auto-recovery on failure
- Smart compliance action detection — auto-identifies which of the 4 compliance steps each regulation requires
- "What's New" changelog page accessible from the version badge
- Statutory framework viewer, risk scores in the regulation list
- Various stability and performance improvements

Please reach out with any questions or feedback — we'd love to hear how these features are working for you.

Best,
Dave
x