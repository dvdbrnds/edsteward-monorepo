# EdSteward Accessibility Conformance Report
## Based on VPAT 2.4 Rev (February 2026)

**Product Name:** EdSteward Compliance Management Platform
**Product Version:** 1.0
**Report Date:** February 2026
**Contact:** support@edsteward.ai
**Evaluation Methods Used:** Code review, static analysis (eslint-plugin-jsx-a11y), manual keyboard navigation testing, heading structure audit

---

## Applicable Standards/Guidelines

This report covers the degree of conformance for the following accessibility standard:

| Standard | Included in Report |
|----------|--------------------|
| **WCAG 2.1 Level AA** | Yes |
| Section 508 (2017) | Included via WCAG 2.1 mapping |
| EN 301 549 (2018) | Included via WCAG 2.1 mapping |

---

## Terms

| Term | Definition |
|------|-----------|
| **Supports** | The functionality of the product has at least one method that meets the criterion without known defects or meets with equivalent facilitation. |
| **Partially Supports** | Some functionality of the product does not meet the criterion. |
| **Does Not Support** | The majority of product functionality does not meet the criterion. |
| **Not Applicable** | The criterion is not relevant to the product. |
| **Not Evaluated** | The product has not been evaluated against this criterion. |

---

## WCAG 2.1 Level A Conformance

### Principle 1: Perceivable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **1.1.1 Non-text Content** | Supports | All informational images have alt text. Decorative images use empty alt attributes. Icons are paired with text labels or aria-labels. |
| **1.2.1 Audio-only and Video-only** | Not Applicable | EdSteward does not include audio or video content. |
| **1.2.2 Captions (Prerecorded)** | Not Applicable | No prerecorded audio/video content. |
| **1.2.3 Audio Description or Media Alternative** | Not Applicable | No multimedia content. |
| **1.3.1 Info and Relationships** | Supports | Semantic HTML is used throughout (headings, lists, tables, forms with labels). ARIA attributes convey relationships for dynamic content. CardTitle component supports configurable heading levels via `as` prop. |
| **1.3.2 Meaningful Sequence** | Supports | DOM order matches visual presentation. CSS layout does not reorder content in a way that changes meaning. |
| **1.3.3 Sensory Characteristics** | Supports | Instructions do not rely solely on shape, size, or visual location. Status indicators include text labels alongside color coding. |
| **1.4.1 Use of Color** | Supports | Color is not the sole means of conveying information. Compliance badges include text labels (Compliant, Partial, In Progress). |
| **1.4.2 Audio Control** | Not Applicable | No audio content. |

### Principle 2: Operable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **2.1.1 Keyboard** | Supports | All interactive elements are keyboard-accessible. Custom interactive elements include tabIndex and keyboard event handlers (Enter/Space activation). File upload drop zones support keyboard activation. |
| **2.1.2 No Keyboard Trap** | Supports | Dialog components (Radix UI) properly manage focus trapping and allow Escape to close. No keyboard traps identified in testing. |
| **2.1.4 Character Key Shortcuts** | Not Applicable | No single-character key shortcuts implemented. |
| **2.2.1 Timing Adjustable** | Supports | Session timeouts provide sufficient duration. No timed interactions in core compliance workflows. |
| **2.2.2 Pause, Stop, Hide** | Supports | Auto-refresh in system logs can be toggled on/off. No auto-playing or auto-scrolling content. |
| **2.3.1 Three Flashes or Below Threshold** | Supports | No flashing or strobing content exists in the interface. |
| **2.4.1 Bypass Blocks** | Supports | Navigation component provides consistent page structure. Focus management allows keyboard users to skip to main content. |
| **2.4.2 Page Titled** | Supports | Each page has a descriptive, unique title. |
| **2.4.3 Focus Order** | Supports | Tab order follows logical reading order (left-to-right, top-to-bottom). |
| **2.4.4 Link Purpose (In Context)** | Supports | Links and buttons have descriptive text or aria-labels indicating their purpose. Icon-only buttons include aria-label attributes. |
| **2.5.1 Pointer Gestures** | Supports | No multi-point or path-based gestures required. All actions achievable with single pointer click. |
| **2.5.2 Pointer Cancellation** | Supports | Click actions fire on pointer up. No actions triggered on pointer down alone. |
| **2.5.3 Label in Name** | Supports | Visible labels match accessible names for form controls. |
| **2.5.4 Motion Actuation** | Not Applicable | No motion-activated features. |

### Principle 3: Understandable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **3.1.1 Language of Page** | Supports | HTML `lang` attribute is set to `"en"`. |
| **3.2.1 On Focus** | Supports | No context changes occur on focus alone. |
| **3.2.2 On Input** | Supports | Form submissions require explicit action (button click). Select changes that trigger navigation are clearly labeled. |
| **3.3.1 Error Identification** | Supports | Form validation errors are identified with text descriptions adjacent to the relevant field. Toast notifications announce errors with descriptive messages. |
| **3.3.2 Labels or Instructions** | Supports | All form inputs have associated labels (visible or via aria-label). Required fields are indicated. |

### Principle 4: Robust

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **4.1.1 Parsing** | Supports | Valid HTML output. React ensures proper DOM structure. No duplicate IDs in rendered output. |
| **4.1.2 Name, Role, Value** | Supports | Standard HTML elements and ARIA attributes convey names, roles, and values. Custom components (Radix UI) use appropriate ARIA roles, states, and properties. |
| **4.1.3 Status Messages** | Supports | Toast notifications use Radix UI Toast with `aria-live` regions. Status changes are announced to assistive technology without receiving focus. |

---

## WCAG 2.1 Level AA Conformance

### Principle 1: Perceivable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **1.3.4 Orientation** | Supports | Content is not restricted to a single display orientation. Responsive design supports both portrait and landscape. |
| **1.3.5 Identify Input Purpose** | Supports | Input fields for personal information use appropriate `autocomplete` attributes (e.g., `email`, `username`). |
| **1.4.3 Contrast (Minimum)** | Supports | Text meets 4.5:1 contrast ratio for normal text and 3:1 for large text. Tailwind CSS theme variables maintain sufficient contrast. |
| **1.4.4 Resize Text** | Supports | Text can be resized up to 200% without loss of content or functionality. Layout uses responsive units (rem, viewport units). |
| **1.4.5 Images of Text** | Supports | No images of text are used. All text content is rendered as actual text. |
| **1.4.10 Reflow** | Supports | Content reflows properly at 320px viewport width (equivalent to 400% zoom at 1280px). Responsive design implemented with Tailwind breakpoints. |
| **1.4.11 Non-text Contrast** | Supports | UI components (buttons, inputs, badges, focus indicators) maintain at least 3:1 contrast ratio against adjacent colors. |
| **1.4.12 Text Spacing** | Supports | Content and functionality are preserved when text spacing is modified per WCAG requirements. Layout does not depend on fixed heights. |
| **1.4.13 Content on Hover or Focus** | Supports | Tooltip content is dismissible (Escape key), hoverable, and persistent while pointer hovers. Implemented via Radix UI Tooltip primitive. |

### Principle 2: Operable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **2.4.5 Multiple Ways** | Supports | Multiple navigation methods: sidebar navigation, direct URL access, breadcrumbs, and keyboard navigation. |
| **2.4.6 Headings and Labels** | Supports | Headings describe content sections. Form labels describe input purpose. Heading hierarchy is maintained (h1 > h2 > h3) across all pages. |
| **2.4.7 Focus Visible** | Supports | Focus indicators are visible on all interactive elements via Tailwind's `ring` utilities and custom focus styles. |

### Principle 3: Understandable

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| **3.1.2 Language of Parts** | Not Applicable | All content is in a single language (English). |
| **3.2.3 Consistent Navigation** | Supports | Navigation component is consistent across all authenticated pages. Same sidebar structure used throughout. |
| **3.2.4 Consistent Identification** | Supports | Components serving the same function use the same labels, icons, and styling consistently across the application. |
| **3.3.3 Error Suggestion** | Supports | Form validation provides specific correction suggestions (e.g., "Password must be at least 12 characters", "Email is required"). |
| **3.3.4 Error Prevention (Legal, Financial, Data)** | Supports | Destructive actions (delete user, delete data) require confirmation dialogs. Legal exports include confirmation steps. Data submissions can be reviewed before completion. |

### Principle 4: Robust

| Criterion | Conformance Level | Remarks |
|-----------|-------------------|---------|
| *All Level AA Principle 4 criteria addressed in Level A section* | | See 4.1.1, 4.1.2, 4.1.3 above. |

---

## Summary

EdSteward **conforms** to WCAG 2.1 Level AA. The platform is built with accessibility as a core design principle:

- **Semantic HTML** with correct heading hierarchy (h1 > h2 > h3) across all pages
- **Full keyboard accessibility** for all interactive elements, including custom drop zones and modal dialogs
- **ARIA attributes** (aria-label, aria-expanded, aria-live) for dynamic content and custom components
- **Radix UI primitives** providing built-in accessibility for dialogs, toasts, switches, tooltips, and select menus
- **Color independence** -- status information conveyed through text labels alongside color coding
- **Responsive design** supporting reflow at 320px and text resizing to 200%
- **eslint-plugin-jsx-a11y** integrated into development toolchain for continuous accessibility enforcement
- **No tracking scripts, auto-play content, or motion-dependent interactions**

### Accessibility Contact

To report accessibility issues or request accommodations:
- **Email:** support@edsteward.ai
- **Response time:** Accessibility issues are triaged within 2 business days

### Continuous Improvement

EdSteward maintains ongoing accessibility through:
- `eslint-plugin-jsx-a11y` linting rules enforced during development
- Accessibility review as part of the code review process
- This VPAT is updated with each major release

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 2026 | EdSteward Development Team | Initial VPAT/ACR publication |

---

**Prepared By:** David Brandes, Founder & CEO
**Date:** February 10, 2026
**VPAT Format:** Based on ITI VPAT 2.4 Rev
