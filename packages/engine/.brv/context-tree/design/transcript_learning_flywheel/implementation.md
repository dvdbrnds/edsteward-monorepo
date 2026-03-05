## TransferIQ - Transcript Learning Flywheel (Jan 11, 2026)

### Core Concept
Every transcript we process automatically builds our course database. The more transcripts we see from a school, the better we get at evaluating future transcripts from that school.

### Implementation

**Schema additions to Course model:**
```prisma
dataSource       CourseDataSource @default(UNKNOWN)  // CATALOG, TRANSCRIPT, MANUAL, IMPORT
transcriptCount  Int       @default(0)  // Times seen in transcripts
lastTranscriptAt DateTime?              // Last time seen
firstLearnedAt   DateTime?              // When we first learned this
verifiedAt       DateTime?              // When admin verified
```

**Service: `transcript-learning.ts`**
```typescript
export async function learnFromTranscript(
  sourceSchoolId: string,
  courses: ExtractedCourse[]
): Promise<{ learned: LearnedCourseResult[], newCourses: number, updatedCourses: number }>
```

**Integration in evaluate route:**
```typescript
// After equivalency evaluation, learn from transcript (non-blocking)
if (evaluationResult.sendingInstitution.id) {
  learnFromTranscript(sourceSchoolId, ocrResult.courses)
    .catch(err => console.error('Failed to learn:', err))
}
```

### LVAIC Schools Network
7 Lehigh Valley schools now active:
- Moravian, Lehigh, Millersville (existing)
- Cedar Crest, DeSales, Muhlenberg, LCCC (new)
- 240 cross-registration equivalencies between them

### Data Maturity Tiers
- COMPLETE: 500+ courses or 100+ verified
- SUBSTANTIAL: 100+ courses or 25+ verified  
- GROWING: 25+ courses or 10+ high-confidence
- MINIMAL: 5+ courses
- NONE: No data yet