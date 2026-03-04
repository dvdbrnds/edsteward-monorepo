import { storage } from "./storage";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import type { Regulation } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { regulations } from "@shared/schema";

/**
 * Checks if a regulation is related to the Clery Act by examining its content
 * across multiple fields (name, topic, summary) for relevant keywords.
 */
function isCleryActRegulation(regulation: Regulation): boolean {
  const text = [
    regulation.name,
    regulation.topic,
    regulation.summary
  ].map(s => (s || '').toLowerCase()).join(' ');

  return text.includes('clery') || 
         text.includes('campus security') || 
         text.includes('campus safety') ||
         text.includes('crime statistics');
}

// Core Clery Act regulation information template
const baseCleryRegulation = {
  name: "Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act",
  topic: "Campus Safety and Security",
  summary: "The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (Clery Act) is a federal law that requires colleges and universities to disclose certain timely and annual information about campus crime and security policies. The law, originally enacted by Congress in 1990 as the Campus Security Act, was championed by Howard and Connie Clery after their daughter Jeanne was murdered at Lehigh University in 1986.",
  requirements: "Institutions must collect and report crime statistics, maintain a daily crime log, provide timely warnings of crimes that pose a serious threat to students and employees, publish an annual security report, and maintain crime statistics for crimes committed on campus, in unobstructed public areas immediately adjacent to or running through the campus, and at certain non-campus facilities.",
  submission_guidelines: "By October 1st of each year, institutions must publish and distribute their Annual Security Report to current students and employees. The report must include statistics of campus crime for the preceding 3 calendar years, plus details about efforts taken to improve campus safety.",
  statute: "20 U.S.C. § 1092(f)",
  category: "Campus Safety",
  jurisdiction: "federal",
  agency_url: "https://clerycenter.org",
  agency_name: "Clery Center",
  agency_department: "Campus Safety",
  regulation_url: "https://www.law.cornell.edu/uscode/text/20/1092",
  requirements_url: "https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46",
  submission_guide_url: "https://www.clerycenter.org/policy-resources",
  forms_url: "https://surveys.ope.ed.gov/campussafety"
};

/**
 * Counts the number of Clery Act regulations currently in the database.
 * Uses a broad search across name, topic, and content fields to ensure
 * all variations are captured.
 */
async function countCleryRegulations(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM regulations 
    WHERE LOWER(name) LIKE LOWER('%clery%')
       OR LOWER(name) LIKE LOWER('%campus security%')
       OR LOWER(name) LIKE LOWER('%campus safety%')
       OR LOWER(topic) LIKE LOWER('%clery%')
       OR LOWER(topic) LIKE LOWER('%campus security%')
       OR LOWER(summary) LIKE LOWER('%clery%');
  `);
  return Number(result.rows[0].count);
}

/**
 * Deduplicates Clery Act regulations by consolidating all records into a single,
 * authoritative record. The process:
 * 1. Identifies all Clery Act-related regulations
 * 2. Keeps only the most recently updated record
 * 3. Updates that record with the standardized base content
 * 4. Removes all other duplicate records
 * 
 * This function is idempotent and can be safely run multiple times.
 * It should be run:
 * - After bulk data imports
 * - During scheduled maintenance
 * - When duplicate records are detected
 * 
 * @returns Summary of the deduplication process
 */
async function deduplicateRegulations() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting regulation deduplication process");

    // Count initial Clery Act regulations
    const initialCount = await countCleryRegulations();

    if (initialCount > 1) {
      // Delete all but the most recent Clery Act regulation
      const deleteCount = await db.execute(sql`
        WITH latest_reg AS (
          SELECT id
          FROM regulations
          WHERE LOWER(name) LIKE LOWER('%clery%')
             OR LOWER(name) LIKE LOWER('%campus security%')
             OR LOWER(name) LIKE LOWER('%campus safety%')
             OR LOWER(topic) LIKE LOWER('%clery%')
             OR LOWER(summary) LIKE LOWER('%clery%')
          ORDER BY last_updated DESC
          LIMIT 1
        )
        DELETE FROM regulations 
        WHERE (
          LOWER(name) LIKE LOWER('%clery%')
          OR LOWER(name) LIKE LOWER('%campus security%')
          OR LOWER(name) LIKE LOWER('%campus safety%')
          OR LOWER(topic) LIKE LOWER('%clery%')
          OR LOWER(summary) LIKE LOWER('%clery%')
        )
        AND id NOT IN (SELECT id FROM latest_reg)
        RETURNING id;
      `);


      // Update the remaining record with consolidated information
      await db.execute(sql`
        UPDATE regulations 
        SET name = ${baseCleryRegulation.name},
            topic = ${baseCleryRegulation.topic},
            summary = ${baseCleryRegulation.summary},
            requirements = ${baseCleryRegulation.requirements},
            submission_guidelines = ${baseCleryRegulation.submission_guidelines},
            statute = ${baseCleryRegulation.statute},
            category = ${baseCleryRegulation.category},
            jurisdiction = ${baseCleryRegulation.jurisdiction},
            agency_url = ${baseCleryRegulation.agency_url},
            agency_name = ${baseCleryRegulation.agency_name},
            agency_department = ${baseCleryRegulation.agency_department},
            regulation_url = ${baseCleryRegulation.regulation_url},
            requirements_url = ${baseCleryRegulation.requirements_url},
            submission_guide_url = ${baseCleryRegulation.submission_guide_url},
            forms_url = ${baseCleryRegulation.forms_url},
            version_number = 1,
            is_current = true,
            previous_version_id = null,
            last_updated = now(),
            version_date = now(),
            change_summary = 'Consolidated all Clery Act regulations into single record'
        WHERE LOWER(name) LIKE LOWER('%clery%')
           OR LOWER(name) LIKE LOWER('%campus security%')
           OR LOWER(name) LIKE LOWER('%campus safety%')
           OR LOWER(topic) LIKE LOWER('%clery%')
           OR LOWER(summary) LIKE LOWER('%clery%');
      `);

      // Verify final state
      const finalCount = await countCleryRegulations();

      if (finalCount !== 1) {
        throw new Error(`Expected 1 Clery Act regulation after deduplication, but found ${finalCount}`);
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Successfully consolidated ${initialCount} Clery Act regulations into one record`);
    }

    return {
      initialCount,
      finalCount: await countCleryRegulations(),
      deletedCount: initialCount - 1,
      timestamp: new Date()
    };

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      "Error during regulation deduplication", {
        error: error instanceof Error ? error.message : String(error)
      });
    throw error;
  }
}

// Export for use in import process and testing
export { deduplicateRegulations, isCleryActRegulation, countCleryRegulations };