## TransferIQ - GitHub Repository & Tech Stack

**Repository**: https://github.com/dvdbrnds/TransferIQ (private)
**Workspace**: /Users/dvdbrnds/Desktop/XferIQ

**Tech Stack**:
- Next.js 14 (App Router) with TypeScript
- Tailwind CSS with custom brand colors (teal/coral palette)
- PostgreSQL + Prisma ORM
- NextAuth.js for authentication
- pdf-parse + Tesseract.js for PDF/OCR
- Framer Motion for animations
- Lucide React for icons

**Database Schema** (prisma/schema.prisma):
- User (multi-role: STUDENT, ADMISSIONS_STAFF, REGISTRAR, INSTITUTION_ADMIN, SYSTEM_ADMIN)
- Institution (multi-tenant, FTE tiers for pricing)
- Equivalency (two-tier: global best-practices + institution-specific)
- Evaluation (transcript processing results)
- TranscriptCourse (individual courses from transcripts)
- ManualReview (review queue for flagged courses)
- SendingInstitution / InstitutionCourse (course catalogs)

**Key Commands**:
```zsh
npm run dev          # Start dev server (port 3000)
npm run db:push      # Push Prisma schema to DB
npm run db:studio    # Open Prisma Studio
npm run db:migrate   # Run migrations
```

**Environment Variables**: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET