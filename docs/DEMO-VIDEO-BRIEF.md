# EdSteward — Demo Video Brief

> **Purpose:** Short product demo for prospective customers (compliance officers and administrators at higher-ed institutions)
> **Target length:** ~2 min 30 sec
> **Tone:** Empathetic first (we get the pain), then calm and confident (here's the fix)
> **Audience:** Higher-ed compliance officers, CCOs, VP of Administration

---

## Overview

The video opens with a cartoon animated hook that captures the pain of managing compliance manually, then transitions into a clean screen-recording demo of EdSteward solving each problem. Every scene has post-production animation overlays: lower-thirds, callout zooms, cursor highlights, and scene transitions.

---

## Video Structure

| Timecode    | Section                              |
|-------------|--------------------------------------|
| 0:00–0:15   | Cartoon animated hook — the problem  |
| 0:15–0:20   | EdSteward logo reveal / transition   |
| 0:20–0:40   | Scene 1 — Dashboard                  |
| 0:40–1:00   | Scene 2 — Scheduled Deadlines        |
| 1:00–1:35   | Scene 3 — Attestation                |
| 1:35–2:05   | Scene 4 — MCP Engine Regulation Packets |
| 2:05–2:25   | Scene 5 — Executive Orders           |
| 2:25–2:30   | Branded outro card                   |

---

## Part 1 — Animated Hook (0:00–0:15)

### Concept

A cartoon compliance officer — frazzled, coffee-stained shirt, glasses askew — is sitting at a desk.

**The chaos builds:**
- Papers fly in from all directions and pile on top of him
- A counter in the corner rapidly ticks up: *"47 regulations... 312 tasks... 2,000 deadlines..."*
- His phone rings, email pings, Post-it notes cover the monitor
- He lets out a silent cartoon scream

**The resolution:**
- The EdSteward shield logo drops in calmly from above, lands on the desk
- The chaos organizes itself into neat stacks
- The screen clears

**Voiceover (or on-screen text card):**
> "Managing higher-ed compliance shouldn't feel like this."

**Transition:**
The cartoon desk morphs or wipes into the live EdSteward dashboard — cartoon world becomes the real product.

### Animation Tool Options

| Option | Notes |
|--------|-------|
| **Vyond** | Purpose-built explainer cartoon tool, drag-and-drop character animation, ~$99/mo |
| **Adobe Character Animator** | More control, pairs with After Effects for the transition |
| **Fiverr** | Commission a 15-sec explainer from an animator using this brief (~$150–300) |

---

## Part 2 — Screen Demo (0:20–2:25)

**Recording setup:**
- Use the **Moravian tenant** at `moravian.edsteward.ai` — it has real-looking production data
- Record at 1440px wide, 2x resolution if possible (for sharp callout zooms in post)
- Pre-stage all data before recording (see setup notes at the end)

---

### Scene 1 — The Dashboard (0:20–0:40)

**What's on screen:** Dashboard landing page

**Click path:** Log in → land on dashboard

**What to show:**
- Stats cards: Upcoming Deadlines, Overdue Items, Pending Attestations
- My Tasks widget
- Compliance Overview category breakdown widget

**Animation overlays:**
- Lower-third slides in from left: **"Everything in one place"**
- Callout circle pulses on the "Overdue Items" and "Pending Attestations" stat cards
- Animated cursor highlight ring follows mouse to guide the viewer's eye

**Narration:**
> "Everything your team needs to see is right here. Overdue items, pending attestations, upcoming deadlines — at a glance, no digging."

---

### Scene 2 — Scheduled Compliance Deadlines (0:40–1:00)

**What's on screen:** Regulation detail page (e.g., GLBA or Clery Act)

**Click path:** Dashboard → click a regulation → expand the Deadlines accordion → Create Deadline → fill form → save → cut back to dashboard → Deadline Calendar widget

**What to show:**
- Expand the "Deadlines" accordion section
- Click "Create Deadline" — fill in: description, due date picker, assignee dropdown
- Watch the new deadline appear in the list with a Pending badge
- Cut back to the dashboard — show the Deadline Calendar widget

**Animation overlays:**
- Lower-third: **"Automated deadline tracking"**
- Zoom-in callout on the "Create Deadline" button before clicking
- After creating, zoom-in on the new deadline row and its Pending badge
- Animated notification timeline overlaid briefly on screen:
  `90 days → 60 days → 30 days → Daily → Hourly (final day)`

**Narration:**
> "Set a deadline, assign it to the right person — and EdSteward takes it from there. Automated reminders at 90, 60, 30 days out, then daily in the final week."

---

### Scene 3 — Attestation (1:00–1:35)

**What's on screen:** Compliance task → attestation request → email inbox → attestation page

**Click path:** Click into a compliance task → three-dot menu → "Request Attestation" → fill form → send → cut to email inbox → click magic link → upload file → type signature → submit → success screen

**What to show:**

1. **Sending the request:**
   - Open the three-dot menu on a compliance task → click "Request Attestation"
   - Fill the form: email address, recipient name, optional personal message, expiry set to 7 days
   - Click send

2. **Recipient's experience (cut to email inbox):**
   - Show a real email inbox tab — email subject: *"Attestation Required: [Task Title]"*
   - Show the CTA button: "Upload Evidence & Attest"

3. **The attestation page** (no login required):
   - Click the magic link — land on `/attest/:token`
   - Show the task details card: priority badge, description, due date
   - Drag and drop a file → it auto-uploads, section collapses smoothly
   - Type full legal name in the "Type your full legal name" signature field
   - Click "Submit Attestation"

4. **Success:**
   - Green "Attestation Complete" screen with checkmark

**Animation overlays:**
- Lower-third: **"Frictionless attestation — no account needed"**
- Zoom callout on the "Request Attestation" menu item
- Animated split-screen or cut transition when switching to the email view
- Callout bubble on the signature field: *"No account. No password. Just a link."*
- Green checkmark burst animation on the success screen

**Narration:**
> "Need an attestation? Send a link. The recipient doesn't need an account — they open it, upload their evidence, sign their name, and they're done. The audit trail is automatic."

---

### Scene 4 — MCP Engine Regulation Packets (1:35–2:05)

**What's on screen:** Regulation detail page (MCP-synced) → regulation updates list → diff view

**Click path:** Navigate to a regulation synced from MCP Engine → scroll through detail → navigate to `/regulations/updates` → open a pending update → view diff → show Approve/Reject buttons

**What to show:**
- Regulation detail page: Risk Score/Level badge (e.g., "HIGH 72")
- Summary and Requirements sections populated from the MCP payload
- Compliance Tasks panel showing tasks auto-created by the sync
- Navigate to `/regulations/updates` — the pending updates list
- Open one update → show the diff view (what changed vs. what's live)
- Show "Approve Update" and "Reject Update" buttons

**Animation overlays:**
- Lower-third: **"AI-powered regulation intelligence"**
- Callout zoom on the Risk Score badge
- Brief 2-sec animated connector graphic overlaid on screen: `MCP Engine → EdSteward`
- Zoom on the diff view highlighting the changed text
- Callout highlight on "Approve Update" button

**Narration:**
> "EdSteward connects to your MCP Engine. When a regulation changes, the full packet comes in automatically — risk score, updated requirements, new compliance tasks. Your CCO reviews the diff before anything goes live."

---

### Scene 5 — Executive Orders (2:05–2:25)

**What's on screen:** `/executive-orders` page → EO detail view

**Click path:** Navigate to Executive Orders → show stats → search for an EO → expand card → click "View Details & Impacts" → show impacted regulations → show status history timeline

**What to show:**
- Stats cards: Total EOs, Critical Impacts, High Impacts, Pending Review, Regulations Affected
- Search or filter for a specific EO number
- Expand the EO card — show status badge (Active/Enjoined), signed date, president, summary
- Click "View Details & Impacts" — list of impacted regulations with severity badges (Critical, High, Medium, Low)
- Status history timeline at the bottom

**Animation overlays:**
- Lower-third: **"Executive Order monitoring"**
- Callout zooms on the Critical Impacts and Pending Review stat cards
- Animated severity bars next to each impacted regulation on the detail view
- Callout bubble on the status history timeline: *"Tracked from signing to legal status"*

**Narration:**
> "Every Executive Order is tracked — which of your regulations it touches, the severity, and where it stands legally. Your team always knows what to act on first."

---

## Part 3 — Branded Outro Card (2:25–2:30)

**Animation sequence:**
1. EdSteward shield logo animates in from center
2. "EdSteward" wordmark fades in below
3. Subtitle appears: *"Compliance management that actually keeps up."*
4. URL: `edsteward.ai`
5. Optional CTA line: *"Request a demo"* or *"Talk to us"*

---

## Post-Production Checklist

| Element | Description |
|---------|-------------|
| Cartoon intro | 15-sec animated hook (Vyond, Character Animator, or Fiverr commission) |
| Logo reveal transition | Cartoon desk morphs/wipes into live dashboard |
| Lower-thirds | Slide in from left per scene — white text on dark pill/bar background |
| Callout zooms | Smooth zoom-in on key UI elements before clicking them |
| Cursor highlight | Animated ring around cursor throughout the product demo |
| Scene transitions | Quick wipe or morph between scenes — no hard cuts |
| Narration | Calm, confident voiceover — not upbeat or salesy |
| Background music | Soft neutral underscore that drops out during key spoken moments |
| Branded intro/outro | EdSteward shield logo, brand color palette |

---

## Pre-Recording Setup Checklist

Before hitting record on the screen demo, ensure the following are in place:

- [ ] Log in to `moravian.edsteward.ai` — real production data visible
- [ ] Dashboard widgets rearranged: Upcoming Deadlines, Pending Attestations, My Tasks all above the fold
- [ ] A compliance task exists with evidence required (e.g., GLBA Annual Training)
- [ ] An email inbox is open in a separate browser tab (to receive the attestation email live)
- [ ] At least one Executive Order exists with multiple regulation impacts on the detail view
- [ ] At least one pending regulation update is queued at `/regulations/updates` with a visible diff
- [ ] Screen resolution set to 1440px wide
- [ ] Screen recorder set to 2x resolution (Retina) for sharp post-production zooms
- [ ] Notifications, Slack, and other desktop alerts silenced

---

## Narration Script (Full, in Order)

**[Hook voiceover]**
> "Managing higher-ed compliance shouldn't feel like this."

**[Scene 1 — Dashboard]**
> "Everything your team needs to see is right here. Overdue items, pending attestations, upcoming deadlines — at a glance, no digging."

**[Scene 2 — Deadlines]**
> "Set a deadline, assign it to the right person — and EdSteward takes it from there. Automated reminders at 90, 60, 30 days out, then daily in the final week."

**[Scene 3 — Attestation]**
> "Need an attestation? Send a link. The recipient doesn't need an account — they open it, upload their evidence, sign their name, and they're done. The audit trail is automatic."

**[Scene 4 — MCP Engine]**
> "EdSteward connects to your MCP Engine. When a regulation changes, the full packet comes in automatically — risk score, updated requirements, new compliance tasks. Your CCO reviews the diff before anything goes live."

**[Scene 5 — Executive Orders]**
> "Every Executive Order is tracked — which of your regulations it touches, the severity, and where it stands legally. Your team always knows what to act on first."

**[Outro]**
> "EdSteward. Compliance management that actually keeps up."

---

## Fiverr Animator Brief (for the cartoon hook)

If commissioning the cartoon hook externally, share this brief:

---

**Title:** 15-second animated explainer intro for a SaaS product video

**Style:** 2D cartoon / explainer animation (think classic explainer video style — not anime, not 3D)

**Characters:** One main character — a compliance officer. Think mid-30s, business casual, glasses, looks stressed. Coffee mug on desk.

**Scene description:**
The character is sitting at a desk. Papers start flying in from off-screen and pile up on top of him. A counter in the top corner of the screen ticks up rapidly: "47 regulations... 312 tasks... 2,000 deadlines..." His phone rings, email notification pings appear, Post-it notes cover his monitor. He looks at the camera with a panicked expression and opens his mouth in a silent scream.

Then — a shield logo (to be provided as an SVG) drops down from above the screen and lands gently on the desk. The papers organise themselves into neat stacks. The character sits up, straightens his glasses, and looks calm and in control.

**Duration:** 12–15 seconds

**Deliverable:** MP4 with transparent background if possible, or on a white/light background. No audio needed — we will add voiceover in post.

**Brand asset:** EdSteward shield logo SVG will be provided.

---

*Brief ends — attach EdSteward logo SVG before sending.*
