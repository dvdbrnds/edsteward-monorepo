## Critical Discovery: Regulation-Topic Mappings (January 2026)

### Why Regulations Appear Multiple Times in Compliance Matrix

The original compliance-matrix.xlsx has 295 rows but only 237 unique regulations. This is INTENTIONAL:
- Each row represents a regulation-to-topic (department) mapping
- Title IX appears 8 times: Academic Programs, Admissions, Athletics, Discrimination, Diversity, Employee Benefits, Financial Aid, Housing
- ADA appears 6 times across different departments
- Section 504 appears 6 times

### What This Data Represents
- Which DEPARTMENTS must comply with each regulation
- Department-specific compliance TASKS
- RESPONSIBLE PARTIES in each department
- The organizational structure of compliance

### Solution: regulation_topics Junction Table

```sql
CREATE TABLE regulation_topics (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER REFERENCES regulations(id),
    topic VARCHAR(100) NOT NULL,
    topic_id INTEGER,
    department VARCHAR(100),
    responsible_role VARCHAR(100),
    UNIQUE(regulation_id, topic)
);
```

This preserves:
- Unique regulations (237 federal, deduplicated)
- Multiple topic/department mappings (295 relationships)
- Department-specific accountability

### Data Counts Clarified
- Original Excel: 295 rows, 237 unique statutes
- MCP Engine: 251 regulations (237 federal + 14 state) - CORRECT
- EdSteward: 356 regulations - HAS 105 EXTRA (need investigation)

The 105 extra EdSteward regulations are NOT from original source and should be investigated before alignment.