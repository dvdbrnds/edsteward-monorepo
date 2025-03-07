import { storage } from "./storage";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import type { Regulation } from "@shared/schema";

// Core Clery Act regulation information
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

async function deduplicateRegulations() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting regulation deduplication process");

    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} total regulations`);

    // Find all Clery Act regulations
    const cleryRegulations = regulations.filter(isCleryActRegulation);
    console.log(`Found ${cleryRegulations.length} Clery Act regulations`);

    if (cleryRegulations.length > 1) {
      // Sort by last_updated, oldest first
      const sortedRegs = cleryRegulations.sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
        const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`Processing ${sortedRegs.length} Clery Act regulations`);

      // First, mark all as non-current
      for (const reg of sortedRegs) {
        await storage.updateRegulation(reg.id, { 
          is_current: false,
          name: baseCleryRegulation.name // Ensure consistent naming
        });
      }

      // Now update each regulation in order
      for (let i = 0; i < sortedRegs.length; i++) {
        const reg = sortedRegs[i];
        const isLatest = i === sortedRegs.length - 1;

        // For the last (newest) regulation, use all the base information
        const updateData = {
          ...(isLatest ? baseCleryRegulation : {}),
          version_number: i + 1,
          is_current: isLatest,
          previous_version_id: i > 0 ? sortedRegs[i - 1].id : null,
          version_date: reg.lastUpdated || new Date(),
          change_summary: i === 0 
            ? "Initial Clery Act regulation" 
            : `Version ${i + 1} of Clery Act regulation`,
          last_updated: new Date()
        };

        await storage.updateRegulation(reg.id, updateData);

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Updated Clery Act regulation version ${i + 1}`, {
            regulation_id: reg.id,
            version_number: i + 1,
            is_current: isLatest
          });
      }
    }

    return {
      totalRegulations: regulations.length,
      cleryActRegulations: cleryRegulations.length,
      mergedCleryRegulations: cleryRegulations.length > 1 ? cleryRegulations.length - 1 : 0,
      timestamp: new Date()
    };

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      "Error during regulation deduplication", {
        parameters: {
          message: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}

export { deduplicateRegulations };