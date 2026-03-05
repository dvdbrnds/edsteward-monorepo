## TransferIQ Project Status - Code Checkpoint (Jan 10, 2026)

### Architecture
- **Monorepo**: Turborepo with Next.js 14 web app + Python FastAPI OCR engine
- **Database**: PostgreSQL via Prisma with 5,753 US schools, 365 CIP codes, 4,301 Lehigh courses
- **Docker**: PostgreSQL (port 5433), Redis, MinIO for local dev

### Completed Features
1. **PESC XML Parser** - Instant transcript extraction without OCR
2. **Equivalency Engine** - Multi-tier matching with accreditation checks, age-based confidence for degree completion students
3. **Catalog Scraper System** - Parsers for Acalog, CourseLeaf, Kuali, CourseDog, CSV, generic HTML
4. **Lehigh University Catalog** - 4,301 courses imported from CourseLeaf (107 departments)
5. **School Database** - 5,753 US schools from College Scorecard API with IPEDS, accreditation data
6. **CIP Codes** - 365 classification codes for course auto-matching
7. **State Adjacency** - Regional lookup optimization for tiered search

### Key Files
- `apps/web/src/lib/services/equivalency-engine.ts` - Core matching logic
- `apps/web/src/lib/scraper/` - Catalog parsing system (6 parsers)
- `apps/web/prisma/schema.prisma` - Database schema with School, Course, Equivalency models
- `apps/ocr-engine/src/parsers/pesc_xml.py` - PESC transcript parser

### Database Schema Highlights
- Unified `School` model (both customers and sources)
- `FeederSchool`, `TransferStats`, `StateAdjacency` for tiered lookup
- `CipCode` for federal course classification
- Age-based confidence via `TransferPolicy.maxCourseAgeYears`

### Pending Tasks
- NCCC catalog (CourseDog format needs refinement)
- Moravian catalog (custom HTML)
- AI Equivalency Generator (Claude-based suggestions)
- Equivalency CRUD UI
- Authentication (deferred)

### Network Effect Model
Every school is both source and destination. Equivalencies are directional (NCCC→Lehigh, NCCC→Moravian, Lehigh→Moravian, Moravian→Lehigh all supported).