import { storage } from "./storage";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import type { Regulation } from "@shared/schema";
import { format } from "date-fns";

function isCleryActRegulation(regulation: Regulation): boolean {
  const topic = regulation.topic.toLowerCase();
  const name = regulation.name.toLowerCase();
  return topic.includes('clery') || 
         name.includes('clery') ||
         topic.includes('campus security') || 
         topic.includes('campus safety') ||
         (topic.includes('crime') && topic.includes('statistics'));
}

function isCleryActContent(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return lowerText.includes('clery') ||
         lowerText.includes('campus security') ||
         lowerText.includes('crime statistics') ||
         lowerText.includes('annual security report');
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
      // Sort by lastUpdated to maintain proper version history
      const sortedRegs = cleryRegulations.sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
        const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      // Latest version should be the basis for merging
      const latestReg = sortedRegs[sortedRegs.length - 1];

      // Core Clery Act regulation information
      const baseRegulation = {
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

      // Update latest version with core information
      await storage.updateRegulation(latestReg.id, {
        ...baseRegulation,
        version_number: sortedRegs.length,
        is_current: true,
        last_updated: new Date(),
        version_date: new Date(),
        change_summary: "Consolidated Clery Act regulations"
      });

      // Mark all other versions as non-current and link them in version history
      for (let i = sortedRegs.length - 2; i >= 0; i--) {
        const oldReg = sortedRegs[i];
        const nextReg = sortedRegs[i + 1];

        await storage.updateRegulation(oldReg.id, {
          is_current: false,
          version_number: i + 1,
          previous_version_id: i > 0 ? sortedRegs[i - 1].id : null
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Linked Clery Act regulation version ${i + 1}`, {
            regulation_id: oldReg.id,
            next_version_id: nextReg.id,
            version_number: i + 1
          });
      }
    }

    const summary = {
      totalRegulations: regulations.length,
      cleryActRegulations: cleryRegulations.length,
      mergedCleryRegulations: cleryRegulations.length > 1 ? cleryRegulations.length - 1 : 0,
      timestamp: new Date()
    };

    console.log("Deduplication summary:", summary);
    return summary;

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      "Error during regulation deduplication:", {
        error: error instanceof Error ? error.message : String(error)
      });
    throw error;
  }
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  deduplicateRegulations().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { deduplicateRegulations };