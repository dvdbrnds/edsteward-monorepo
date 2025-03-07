import { storage } from "./storage";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import type { Regulation } from "@shared/schema";
import { format } from "date-fns";

function normalizeTopic(topic: string): string {
  const normalized = topic
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/act|law|regulation|disclosure|requirements?/gi, '')  // Remove common suffixes
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\b(the|and|or|of|for|to|in|on|at|by|with)\b/g, '') // Remove stop words
    .replace(/\s+/g, ' ')
    .trim();

  const commonAbbreviations: Record<string, string> = {
    'clery': 'jeanne clery',
    'vawa': 'violence against women',
    'ferpa': 'family educational rights privacy',
    'ada': 'americans disabilities',
    'title ix': 'title nine',
    'campus safety': 'clery',
    'campus security': 'clery',
    'crime statistics': 'clery',
    'annual security report': 'clery'
  };

  let normalizedText = normalized;
  Object.entries(commonAbbreviations).forEach(([abbr, full]) => {
    const pattern = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalizedText = normalizedText.replace(pattern, full);
  });

  return normalizedText;
}

function areSimilarRegulations(reg1: Regulation, reg2: Regulation): boolean {
  // Don't compare a regulation with itself
  if (reg1.id === reg2.id) return false;

  // Compare topics
  const topic1 = normalizeTopic(reg1.topic);
  const topic2 = normalizeTopic(reg2.topic);

  // Exact match after normalization
  if (topic1 === topic2) return true;

  // One contains the other
  if (topic1.includes(topic2) || topic2.includes(topic1)) return true;

  // Calculate similarity score
  const words1 = topic1.split(/\s+/);
  const words2 = topic2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  const uniqueWords = new Set([...words1, ...words2]);
  const similarity = commonWords.length / uniqueWords.size;

  // Compare statute references
  if (reg1.statute && reg2.statute) {
    const statute1 = reg1.statute.toLowerCase();
    const statute2 = reg2.statute.toLowerCase();
    if (statute1 === statute2 || statute1.includes(statute2) || statute2.includes(statute1)) {
      return true;
    }
  }

  // Key phrases that indicate same topic
  const keyPhrases = [
    'clery', 'campus safety', 'security report', 'crime statistics',
    'title ix', 'vawa', 'ferpa', 'ada', 'drug free', 'disability'
  ];
  
  const hasCommonKeyPhrase = keyPhrases.some(phrase =>
    topic1.includes(phrase) && topic2.includes(phrase)
  );

  if (hasCommonKeyPhrase) return true;

  // High similarity score threshold
  return similarity > 0.4;
}

function mergeRegulations(primary: Regulation, secondary: Regulation): Partial<Regulation> {
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
    `Merging regulations: ${primary.itemId} <- ${secondary.itemId}`);

  return {
    summary: primary.summary && secondary.summary
      ? `${primary.summary}\n\nAdditional Information:\n${secondary.summary}`
      : primary.summary || secondary.summary,

    requirements: primary.requirements && secondary.requirements
      ? `${primary.requirements}\n\nAdditional Requirements:\n${secondary.requirements}`
      : primary.requirements || secondary.requirements,

    lastUpdated: new Date(Math.max(
      primary.lastUpdated ? new Date(primary.lastUpdated).getTime() : 0,
      secondary.lastUpdated ? new Date(secondary.lastUpdated).getTime() : 0
    )),

    // Keep existing IDs and references
    statuteIds: primary.statuteIds || secondary.statuteIds,
    statute: primary.statute || secondary.statute,
    
    // Merge URLs
    regulationUrl: secondary.regulationUrl || primary.regulationUrl,
    requirementsUrl: secondary.requirementsUrl || primary.requirementsUrl,
    
    // Combine any arrays of related items
    filingDeadlines: [
      ...(primary.filingDeadlines || []),
      ...(secondary.filingDeadlines || [])
    ],

    // Keep additional metadata
    compliance_notes: primary.compliance_notes && secondary.compliance_notes
      ? `${primary.compliance_notes}\n\nAdditional Notes:\n${secondary.compliance_notes}`
      : primary.compliance_notes || secondary.compliance_notes,

    // Keep the more recent verification
    lastVerified: new Date(Math.max(
      primary.lastVerified ? new Date(primary.lastVerified).getTime() : 0,
      secondary.lastVerified ? new Date(secondary.lastVerified).getTime() : 0
    ))
  };
}

async function deduplicateRegulations() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting regulation deduplication process");
    
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} total regulations`);
    
    const duplicateSets: Set<Regulation>[] = [];
    const processedIds = new Set<number>();

    // Find sets of duplicate regulations
    for (let i = 0; i < regulations.length; i++) {
      const reg1 = regulations[i];
      if (processedIds.has(reg1.id)) continue;

      const duplicates = new Set<Regulation>([reg1]);
      for (let j = i + 1; j < regulations.length; j++) {
        const reg2 = regulations[j];
        if (processedIds.has(reg2.id)) continue;

        if (areSimilarRegulations(reg1, reg2)) {
          duplicates.add(reg2);
          processedIds.add(reg2.id);
        }
      }

      if (duplicates.size > 1) {
        duplicateSets.push(duplicates);
      }
    }

    console.log(`Found ${duplicateSets.length} sets of duplicate regulations`);
    
    // Process each set of duplicates
    for (const duplicateSet of duplicateSets) {
      const duplicates = Array.from(duplicateSet);
      
      // Use the most recently updated regulation as primary
      const primary = duplicates.reduce((prev, current) => {
        const prevDate = new Date(prev.lastUpdated || 0);
        const currDate = new Date(current.lastUpdated || 0);
        return prevDate > currDate ? prev : current;
      });

      // Merge all others into the primary
      for (const duplicate of duplicates) {
        if (duplicate.id === primary.id) continue;

        const mergedData = mergeRegulations(primary, duplicate);
        await storage.updateRegulation(primary.id, mergedData);

        // Log the merge
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Merged regulation ${duplicate.itemId} into ${primary.itemId}`, {
            primary: primary.topic,
            duplicate: duplicate.topic,
            timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
          });
      }
    }

    const summary = {
      totalRegulations: regulations.length,
      duplicateSets: duplicateSets.length,
      mergedRegulations: processedIds.size - duplicateSets.length,
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
