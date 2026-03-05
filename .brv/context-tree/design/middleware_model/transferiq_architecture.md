## TransferIQ Architecture - Middleware Model

TransferIQ is **middleware for schools**, NOT a student-facing platform.

### User Flow (Production)
1. Prospective transfer student visits **school's website** (e.g., moravian.edu/transfer)
2. School has TransferIQ **embedded widget** on their page
3. Student uploads transcript via widget
4. Gets instant credit evaluation results
5. Clicks "Apply Now" → redirects to school's enrollment system
6. Results delivered to admissions staff (webhook, email, PDF)

### URL Structure

| URL | Purpose | Audience |
|-----|---------|----------|
| `/` | B2B landing page | Admissions officers (sales) |
| `/demo` | Internal demo/testing | TransferIQ staff, sales demos |
| `/embed/[slug]` | Embeddable widget | Students on school's site |
| `/admin` | TransferIQ admin | Internal staff |
| `/widget-demo.html` | Widget embedding examples | Sales demos |

### Key Distinction
- **OLD (Wrong)**: Students come to TransferIQ.com, upload transcripts
- **NEW (Correct)**: Students use widget embedded on school's transfer page

### Homepage (B2B)
Target: Admissions teams at universities
- Headline: "Convert More Transfer Students Instantly"
- CTAs: "Schedule Demo", "Try Demo Now"
- Shows widget embed code examples
- Testimonials from enrollment leaders