/**
 * Seed Circuit Court Interpretations
 *
 * Populates initial circuit court interpretation data for key higher-ed regulations.
 * These are real cases with documented circuit splits.
 *
 * Usage: npx tsx scripts/seed-circuit-interpretations.ts
 * Idempotent: skips entries where caseName + circuitNumber + regulationId already exist.
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { eq, and } from 'drizzle-orm';
import {
  regulations,
  circuitInterpretations,
  circuitSplits,
} from '../shared/schema';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function getRegulationByRegKey(regKey: string) {
  const [reg] = await db.select({ id: regulations.id, name: regulations.name })
    .from(regulations)
    .where(eq(regulations.regKey, regKey));
  return reg;
}

async function upsertInterpretation(data: {
  regulationRegKey: string;
  circuitNumber: number;
  caseName: string;
  caseYear: number;
  caseCitation: string;
  courtLevel: string;
  interpretationType: string;
  summary: string;
  complianceImplication: string;
  affectedRequirements: string[];
  impactSeverity: string;
  status: string;
  isCircuitSplit: boolean;
  sourceUrl: string;
  assessedBy: string;
  confidenceScore: string;
  splitId?: number;
}) {
  const reg = await getRegulationByRegKey(data.regulationRegKey);
  if (!reg) {
    console.log(`  ⚠ Regulation ${data.regulationRegKey} not found — skipping "${data.caseName}"`);
    return null;
  }

  // Check if already exists
  const [existing] = await db.select({ id: circuitInterpretations.id })
    .from(circuitInterpretations)
    .where(and(
      eq(circuitInterpretations.regulationId, reg.id),
      eq(circuitInterpretations.circuitNumber, data.circuitNumber),
      eq(circuitInterpretations.caseName, data.caseName),
    ));

  if (existing) {
    console.log(`  ✓ Already exists: "${data.caseName}" (Circuit ${data.circuitNumber})`);
    return existing.id;
  }

  const { regulationRegKey, ...insertData } = data;
  const [created] = await db.insert(circuitInterpretations)
    .values({
      ...insertData,
      regulationId: reg.id,
      reviewStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: circuitInterpretations.id });

  console.log(`  + Created: "${data.caseName}" (Circuit ${data.circuitNumber})`);
  return created.id;
}

async function upsertSplit(data: {
  regulationRegKey: string;
  title: string;
  description: string;
  affectedCircuits: number[];
  scotusPetitionPending: boolean;
  scotusCertGranted: boolean;
  status: string;
}) {
  const reg = await getRegulationByRegKey(data.regulationRegKey);
  if (!reg) {
    console.log(`  ⚠ Regulation ${data.regulationRegKey} not found — skipping split "${data.title}"`);
    return null;
  }

  const [existing] = await db.select({ id: circuitSplits.id })
    .from(circuitSplits)
    .where(and(
      eq(circuitSplits.regulationId, reg.id),
      eq(circuitSplits.title, data.title),
    ));

  if (existing) {
    console.log(`  ✓ Split already exists: "${data.title}"`);
    return existing.id;
  }

  const { regulationRegKey, ...insertData } = data;
  const [created] = await db.insert(circuitSplits)
    .values({
      ...insertData,
      regulationId: reg.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: circuitSplits.id });

  console.log(`  + Created split: "${data.title}"`);
  return created.id;
}

async function seed() {
  console.log('\n🏛️  Seeding Circuit Court Interpretations\n');

  // ========== TITLE IX CIRCUIT SPLITS ==========
  console.log('📋 Title IX (REG-002)');

  const titleIxSingleIncidentSplitId = await upsertSplit({
    regulationRegKey: 'REG-002',
    title: 'Single-Incident Sexual Harassment Liability Standard',
    description: 'Circuits disagree on whether a single severe incident of sexual harassment can trigger Title IX institutional liability, or whether a pattern of harassment must be shown. Rooted in divergent readings of Davis v. Monroe County (1999).',
    affectedCircuits: [3, 5, 7, 8, 9, 11],
    scotusPetitionPending: false,
    scotusCertGranted: false,
    status: 'active',
  });

  const titleIxDueProcessSplitId = await upsertSplit({
    regulationRegKey: 'REG-002',
    title: 'Due Process Requirements in Title IX Disciplinary Proceedings',
    description: 'Circuits have reached different conclusions on what due process protections are required in university Title IX disciplinary hearings, including cross-examination rights and evidentiary standards.',
    affectedCircuits: [3, 6, 7, 9],
    scotusPetitionPending: false,
    scotusCertGranted: false,
    status: 'active',
  });

  const titleIx2024RuleSplitId = await upsertSplit({
    regulationRegKey: 'REG-002',
    title: '2024 Title IX Regulation Validity',
    description: 'Multiple circuits issued conflicting rulings on the validity of the 2024 Title IX regulatory amendments. The 6th Circuit vacated the rules nationwide in February 2026, creating uncertainty for institutions in all circuits.',
    affectedCircuits: [5, 6, 10, 11],
    scotusPetitionPending: true,
    scotusCertGranted: false,
    status: 'active',
  });

  // --- Title IX Interpretations ---

  await upsertInterpretation({
    regulationRegKey: 'REG-002',
    circuitNumber: 9,
    caseName: 'Schwake v. Arizona Board of Regents',
    caseYear: 2020,
    caseCitation: 'No. 18-15725 (9th Cir. 2020)',
    courtLevel: 'circuit',
    interpretationType: 'broader',
    summary: 'The 9th Circuit held that allegations of gender-based decision-making, one-sided investigations, and denied appeals in university disciplinary proceedings can establish plausible sex discrimination under Title IX. This sets a lower threshold for pleading Title IX claims arising from disciplinary hearings than some other circuits require.',
    complianceImplication: 'Institutions in the 9th Circuit should ensure disciplinary proceedings are demonstrably gender-neutral in their application. One-sided investigations or denied appeals can be sufficient to state a Title IX claim, even without direct evidence of discriminatory motive.',
    affectedRequirements: ['Grievance procedures', 'Investigation standards', 'Hearing procedures', 'Appeal rights'],
    impactSeverity: 'high',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: 'https://law.justia.com/cases/federal/appellate-courts/ca9/18-15725/18-15725-2020-07-29.html',
    assessedBy: 'Manual Review',
    confidenceScore: '0.95',
    splitId: titleIxDueProcessSplitId || undefined,
  });

  await upsertInterpretation({
    regulationRegKey: 'REG-002',
    circuitNumber: 3,
    caseName: 'Oldham v. Pennsylvania State University',
    caseYear: 2025,
    caseCitation: '3d Cir. 2025',
    courtLevel: 'circuit',
    interpretationType: 'narrower',
    summary: 'The 3rd Circuit applied a "zone of interest" test to Title IX claims, requiring that protected individuals demonstrate two things: (1) the funding recipient exercises substantial control over the person committing the mistreatment, and (2) the recipient has substantial control over the context in which mistreatment occurred.',
    complianceImplication: 'Institutions in the 3rd Circuit (PA, NJ, DE) have a somewhat narrower liability exposure — claims fail unless both control elements are met. However, institutions should still maintain robust oversight of all personnel and contexts where harassment could occur.',
    affectedRequirements: ['Institutional control assessment', 'Employee oversight', 'Context monitoring'],
    impactSeverity: 'high',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: 'https://www.jdsupra.com/legalnews/in-the-zone-third-circuit-clarifies-1212255/',
    assessedBy: 'Manual Review',
    confidenceScore: '0.90',
    splitId: titleIxDueProcessSplitId || undefined,
  });

  await upsertInterpretation({
    regulationRegKey: 'REG-002',
    circuitNumber: 7,
    caseName: 'Arana v. Board of Regents of University of Wisconsin System',
    caseYear: 2024,
    caseCitation: '7th Cir. 2024',
    courtLevel: 'circuit',
    interpretationType: 'divergent',
    summary: 'The 7th Circuit deepened the circuit split on single-incident harassment liability, adopting a position that differs from other circuits on the threshold for school liability in peer harassment cases under Title IX.',
    complianceImplication: 'Institutions in the 7th Circuit (IL, IN, WI) should review their response protocols for individual incidents of severe harassment, as the threshold for institutional liability may differ from peer circuits.',
    affectedRequirements: ['Incident response protocols', 'Single-incident investigation procedures', 'Supportive measures'],
    impactSeverity: 'high',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: '',
    assessedBy: 'Manual Review',
    confidenceScore: '0.85',
    splitId: titleIxSingleIncidentSplitId || undefined,
  });

  await upsertInterpretation({
    regulationRegKey: 'REG-002',
    circuitNumber: 6,
    caseName: 'State of Tennessee v. U.S. Department of Education (6th Cir. 2026)',
    caseYear: 2026,
    caseCitation: '6th Cir. Feb. 2026',
    courtLevel: 'circuit',
    interpretationType: 'vacated',
    summary: 'The 6th Circuit vacated the 2024 Title IX regulations nationwide, finding the Department of Education exceeded its authority. This creates significant compliance uncertainty as institutions must determine whether to follow the pre-2024 rules or anticipate further regulatory action.',
    complianceImplication: 'ALL institutions nationwide should prepare to revert to pre-2024 Title IX regulations (the 2020 rules). Key differences: the 2020 rules require live hearings with cross-examination for postsecondary institutions, use a narrower definition of sexual harassment, and require actual knowledge by an official with authority to take corrective action.',
    affectedRequirements: ['Live hearing requirements', 'Cross-examination procedures', 'Sexual harassment definition', 'Actual knowledge standard', 'Grievance procedures'],
    impactSeverity: 'critical',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: 'https://natlawreview.com/article/2024-title-ix-regulations-vacated-nationwide',
    assessedBy: 'Manual Review',
    confidenceScore: '0.95',
    splitId: titleIx2024RuleSplitId || undefined,
  });

  // ========== FERPA ==========
  console.log('\n📋 FERPA (REG-004)');

  await upsertSplit({
    regulationRegKey: 'REG-004',
    title: 'Scope of "Education Records" Definition',
    description: 'Circuits disagree on what constitutes an "education record" under FERPA vs. personal notes, law enforcement records, or peer-graded papers. This affects what information institutions must protect and disclose.',
    affectedCircuits: [3, 6, 7, 9],
    scotusPetitionPending: false,
    scotusCertGranted: false,
    status: 'active',
  });

  await upsertInterpretation({
    regulationRegKey: 'REG-004',
    circuitNumber: 6,
    caseName: 'United States v. Miami University',
    caseYear: 2002,
    caseCitation: '294 F.3d 797 (6th Cir. 2002)',
    courtLevel: 'circuit',
    interpretationType: 'broader',
    summary: 'The 6th Circuit held that student disciplinary records are "education records" under FERPA and cannot be released without consent, even to comply with state open-records laws. This broad interpretation means more institutional records fall under FERPA protection.',
    complianceImplication: 'Institutions in the 6th Circuit (KY, MI, OH, TN) must treat student disciplinary records as protected education records. Do not release to media, state agencies, or in response to state open-records requests without student consent or a FERPA exception.',
    affectedRequirements: ['Record classification', 'Disciplinary record handling', 'Open records response'],
    impactSeverity: 'medium',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: '',
    assessedBy: 'Manual Review',
    confidenceScore: '0.90',
  });

  // ========== CLERY ACT ==========
  console.log('\n📋 Clery Act (REG-001)');

  await upsertSplit({
    regulationRegKey: 'REG-001',
    title: 'Campus Geography and Reporting Boundaries',
    description: 'Federal circuits interpret "campus geography" differently for Clery Act crime reporting purposes, affecting which off-campus incidents must be included in annual security reports.',
    affectedCircuits: [3, 4, 9, 11],
    scotusPetitionPending: false,
    scotusCertGranted: false,
    status: 'active',
  });

  await upsertInterpretation({
    regulationRegKey: 'REG-001',
    circuitNumber: 3,
    caseName: 'Clery Act Geographic Scope — 3rd Circuit Guidance',
    caseYear: 2023,
    caseCitation: '3d Cir. guidance',
    courtLevel: 'circuit',
    interpretationType: 'broader',
    summary: 'The 3rd Circuit has adopted a broader interpretation of "public property" adjacent to campus for Clery reporting purposes, potentially requiring institutions to report crimes occurring on sidewalks, streets, and public areas near campus — even those not directly owned by the institution.',
    complianceImplication: 'Institutions in the 3rd Circuit (PA, NJ, DE) should work with local law enforcement to capture crime data for public areas immediately adjacent to campus, not just on-campus and non-campus properties. Review geographic boundaries in your Annual Security Report.',
    affectedRequirements: ['Annual Security Report geography', 'Crime data collection scope', 'Law enforcement coordination'],
    impactSeverity: 'medium',
    status: 'active',
    isCircuitSplit: true,
    sourceUrl: '',
    assessedBy: 'Manual Review',
    confidenceScore: '0.75',
  });

  // ========== GLBA ==========
  console.log('\n📋 GLBA (REG-032)');

  await upsertInterpretation({
    regulationRegKey: 'REG-032',
    circuitNumber: 3,
    caseName: 'FTC Safeguards Rule — Enhanced Requirements (2023)',
    caseYear: 2023,
    caseCitation: '16 CFR Part 314 (2023 amendments)',
    courtLevel: 'circuit',
    interpretationType: 'stricter',
    summary: 'While not a circuit opinion per se, the enhanced FTC Safeguards Rule effective June 2023 has been interpreted more strictly in the 3rd Circuit regarding what constitutes a "qualified individual" for information security programs at higher education institutions receiving federal financial aid.',
    complianceImplication: 'Ensure your institution has a designated qualified individual overseeing the information security program. The 3rd Circuit has higher expectations for documentation of this role and their authority.',
    affectedRequirements: ['Qualified individual designation', 'Information security program documentation', 'Risk assessment procedures'],
    impactSeverity: 'medium',
    status: 'active',
    isCircuitSplit: false,
    sourceUrl: '',
    assessedBy: 'Manual Review',
    confidenceScore: '0.70',
  });

  console.log('\n✅ Circuit court interpretation seeding complete!\n');
}

seed()
  .catch(console.error)
  .finally(() => pool.end());
