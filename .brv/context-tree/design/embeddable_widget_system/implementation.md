## TransferIQ Widget System - Embeddable Middleware

Built the complete embeddable widget system that schools embed on their websites:

### Components Built

1. **Widget Configuration** (`WidgetConfig` model in Prisma)
   - Per-school branding (logo, colors, fonts)
   - CTA configuration (text, URL, secondary CTA)
   - Custom messaging (welcome, success)
   - Webhook settings (URL, secret, enabled)
   - Analytics IDs (GA, Facebook Pixel)

2. **Embeddable Widget** (`/embed/[slug]`)
   - Self-contained page at `/embed/moravian`, `/embed/lehigh`
   - Dark theme with school branding
   - Drag-and-drop file upload
   - Real-time evaluation results
   - Course-by-course breakdown with expand/collapse
   - "Apply Now" CTA that redirects to school's application

3. **Widget Loader Script** (`/public/widget.js`)
   - Schools embed: `<div id="transferiq-widget" data-school="moravian"></div>`
   - Configurable height, width, theme, border
   - PostMessage API for parent page communication
   - Custom events for evaluation completion

4. **PDF Report** (`/report/[id]`)
   - Print-ready evaluation report
   - School branding header
   - Student/institution info
   - Summary cards
   - Course-by-course table
   - Disclaimer section
   - "Print / Save as PDF" button

5. **Webhook Service** (`/lib/services/webhook-service.ts`)
   - HMAC SHA-256 signature verification
   - Sends `evaluation.completed` events
   - Includes full evaluation data + report URL
   - 10-second timeout with error handling

### Usage Example

```html
<!-- On school's transfer admission page -->
<div id="transferiq-widget" 
     data-school="moravian"
     data-height="700">
</div>
<script src="https://transferiq.com/widget.js"></script>
```

### Webhook Payload Structure
```json
{
  "event": "evaluation.completed",
  "timestamp": "2026-01-10T...",
  "data": {
    "evaluationId": "...",
    "student": { "name": "...", "email": "..." },
    "fromSchool": { "name": "..." },
    "toSchool": { "id": "...", "name": "..." },
    "summary": { "totalCourses": 5, "creditsAwarded": 15 },
    "courses": [...],
    "reportUrl": "https://transferiq.com/report/..."
  }
}
```