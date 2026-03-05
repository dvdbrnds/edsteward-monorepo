/**
 * Davegulations Creator
 * 
 * This script creates 10 randomized test regulations (Davegulations) 
 * to help test the MCP client integration features.
 */

import { db } from './db';
import { regulations, type InsertRegulation } from '@shared/schema';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { like } from 'drizzle-orm';

// Sample data for generating random regulations
const titles = [
  "Educational Data Privacy Protocol",
  "Campus Safety Standards Initiative",
  "Student Financial Aid Reporting Framework",
  "Faculty Tenure Review Guidelines",
  "Distance Learning Compliance Requirements",
  "Academic Research Ethics Standards",
  "Campus Sustainability Mandate",
  "Student Athlete Eligibility Protocol",
  "Inclusive Campus Access Regulations",
  "Higher Education Technology Security Standards",
  "International Student Visa Documentation Rules",
  "Academic Program Accreditation Standards",
  "Student Mental Health Services Requirements",
  "Campus Housing Safety Protocols",
  "Educational Resource Copyright Guidelines"
];

const topics = [
  "Data Privacy",
  "Campus Safety",
  "Financial Aid",
  "Faculty Affairs",
  "Online Education",
  "Research Ethics",
  "Environmental Compliance",
  "Athletic Programs",
  "Accessibility",
  "Cybersecurity",
  "International Programs",
  "Academic Quality",
  "Student Wellness",
  "Residential Life",
  "Intellectual Property"
];

const statutes = [
  "Davegulation Act of 2025 (DA-2025)",
  "Higher Education Davegulation Framework (HEDF)",
  "Academic Davegulations and Standards Act (ADSA)",
  "Campus Davegulation Compliance Code (CDCC)",
  "University Data Protection Davegulation (UDPD)",
  "Educational Davegulation Omnibus Act (EDOA)",
  "Student Davegulation Protection Act (SDPA)",
  "Faculty and Academic Davegulation Standards (FADS)",
  "Institutional Davegulation Compliance Law (IDCL)",
  "Educational Research Davegulation Code (ERDC)"
];

const categories = [
  "Administrative",
  "Academic",
  "Financial",
  "Safety",
  "Technology",
  "Student Affairs",
  "Human Resources",
  "Research",
  "Facilities",
  "Compliance"
];

const jurisdictions = [
  "federal",
  "state"
];

// Generate random date within the past 5 years
function randomPastDate(maxYearsAgo = 5): Date {
  const now = new Date();
  const yearsAgo = Math.random() * maxYearsAgo;
  const pastDate = new Date(now);
  pastDate.setFullYear(now.getFullYear() - yearsAgo);
  return pastDate;
}

// Generate random future date within the next 3 years
function randomFutureDate(maxYearsAhead = 3): Date {
  const now = new Date();
  const yearsAhead = Math.random() * maxYearsAhead;
  const futureDate = new Date(now);
  futureDate.setFullYear(now.getFullYear() + yearsAhead);
  return futureDate;
}

// Generate random paragraph of text
function randomParagraph(wordCount = 50): string {
  const words = [
    "academic", "compliance", "regulations", "students", "faculty", "campus", 
    "education", "university", "college", "requirements", "standards", "policy", 
    "guidelines", "procedures", "institutions", "reporting", "documentation", 
    "verification", "assessment", "implementation", "review", "approval", 
    "submission", "certification", "evaluation", "accreditation", "transparency", 
    "accountability", "administration", "governance", "oversight", "monitoring", 
    "verification", "validation", "auditing", "inspection", "investigation", 
    "enforcement", "penalties", "sanctions", "compliance", "adherence", "conformity",
    "davegulation", "educational", "institutional", "regulatory", "mandatory",
    "protocol", "framework", "system", "process", "method", "approach", "strategy",
    "initiative", "program", "project", "effort", "endeavor", "undertaking"
  ];
  
  let paragraph = "";
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    paragraph += words[randomIndex];
    
    // Add period at the end of sentences (roughly every 10-15 words)
    if (i % (10 + Math.floor(Math.random() * 5)) === 0 && i > 0) {
      paragraph += ". ";
    } else {
      paragraph += " ";
    }
  }
  
  return paragraph.trim() + ".";
}

// Generate a set of requirements
function generateRequirements(): string {
  let requirements = "## Key Requirements\n\n";
  
  // Generate 3-7 random sections
  const sectionCount = 3 + Math.floor(Math.random() * 5);
  
  for (let i = 1; i <= sectionCount; i++) {
    requirements += `### Section ${i}: ${titles[Math.floor(Math.random() * titles.length)]}\n\n`;
    requirements += randomParagraph(30) + "\n\n";
    
    // Add bullet points
    const bulletCount = 3 + Math.floor(Math.random() * 4);
    for (let j = 1; j <= bulletCount; j++) {
      requirements += `- ${randomParagraph(10)}\n`;
    }
    
    requirements += "\n";
  }
  
  requirements += "## Compliance Deadlines\n\n";
  requirements += `Initial documentation submission: ${randomFutureDate(1).toLocaleDateString()}\n`;
  requirements += `Full implementation required by: ${randomFutureDate(2).toLocaleDateString()}\n`;
  requirements += `First compliance audit: ${randomFutureDate(3).toLocaleDateString()}\n`;
  
  return requirements;
}

// Generate randomized Davegulation
function generateDavegulation(index: number): InsertRegulation {
  const originationDate = randomPastDate(5);
  const effectiveDate = new Date(originationDate);
  effectiveDate.setMonth(originationDate.getMonth() + Math.floor(Math.random() * 6) + 1);
  
  const nextReviewDate = randomFutureDate(2);
  
  const titleIndex = Math.floor(Math.random() * titles.length);
  const title = titles[titleIndex];
  
  return {
    itemId: `DV-${Date.now()}-${index}`,
    name: `Davegulation ${index}: ${title}`,
    topic: topics[Math.floor(Math.random() * topics.length)],
    statute: statutes[Math.floor(Math.random() * statutes.length)],
    summary: randomParagraph(100),
    requirements: generateRequirements(),
    category: categories[Math.floor(Math.random() * categories.length)],
    jurisdiction: jurisdictions[Math.floor(Math.random() * jurisdictions.length)] as "federal" | "state",
    dro: "dave@example.com",
    isApplicable: Math.random() > 0.2, // 80% are applicable
    originationDate,
    effectiveDate,
    lastUpdated: new Date(),
    nextReviewDate,
    versionNumber: 1,
    versionDate: new Date(),
    isCurrent: true,
    agency_name: "Dave Regulatory Authority (DRA)",
    agency_contact: "contact@daveregs.example.com",
    regulationUrl: `https://daveregs.example.com/regulations/dv-${index}`,
    actions: [
      {
        type: 'attestation',
        enabled: true,
        required: Math.random() > 0.3,
        status: 'pending'
      },
      {
        type: 'website_publish',
        enabled: true,
        required: Math.random() > 0.5,
        status: 'pending'
      },
      {
        type: 'community_communication',
        enabled: true,
        required: Math.random() > 0.7,
        status: 'pending'
      },
      {
        type: 'agency_submission',
        enabled: true,
        required: Math.random() > 0.4,
        status: 'pending'
      }
    ]
  };
}

// Create the specified number of Davegulations
async function createDavegulations(count: number = 10) {
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Starting creation of ${count} Davegulations`);
  
  try {
    // Check if Davegulations already exist
    const existingRegs = await db.select().from(regulations)
      .where(like(regulations.name, 'Davegulation %'));
    
    const existingCount = existingRegs.length;
    
    if (existingCount >= count) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Already have ${existingCount} Davegulations, skipping creation`);
      return;
    }
    
    const davegulations: InsertRegulation[] = [];
    
    // Generate the required number of Davegulations
    for (let i = 1; i <= count; i++) {
      davegulations.push(generateDavegulation(i));
    }
    
    // Insert all Davegulations into the database
    const result = await db.insert(regulations).values(davegulations).returning();
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully created ${result.length} Davegulations`);
    
    return result;
  } catch (error) {
    console.error('Error creating Davegulations:', error);
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error creating Davegulations", {
      error: String(error)
    });
    throw error;
  }
}

// Run if this file is executed directly
if (process.argv[1] === import.meta.url) {
  createDavegulations()
    .then((result) => {
      if (result) {
        result.forEach(reg => {
        });
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Davegulations creation failed:', error);
      process.exit(1);
    });
}

export { createDavegulations };