/**
 * REGULATION CONFIG TEMPLATE
 * 
 * Each regulation console has a companion config file following this structure.
 * Every task, deadline, penalty, and role MUST cite a specific statutory section.
 * 
 * AUDIT STANDARD: "Can I point to a specific section/paragraph in the statute that requires this?"
 * If yes, it stays. If no, it gets removed.
 * 
 * Copy this file as {regulation-slug}-config.js and fill in the bespoke content.
 */

// ============================================
// BESPOKE GLOBALS (read by shared/console-ui.js)
// ============================================
window.REGULATION_SLUG = '';          // e.g., 'family-educational-rights-and-privacy-act-ferpa'
window.REG_KEY = '';                  // e.g., 'REG-004'
window.JURISDICTION_SOURCE = '';      // 'federal' or 'state'
window.STATE_CODE = '';               // 'PA', 'NJ', etc. (empty for federal)
window.ENFORCING_AGENCY = '';         // State enforcing agency (empty for federal)
window.REGULATION_NAME = '';          // e.g., 'Family Educational Rights and Privacy Act (FERPA)'

// ============================================
// FULL BESPOKE CONFIG
// ============================================
window.REGULATION_CONFIG = {
  // --- IDENTITY ---
  id: '',
  name: '',
  shortName: '',
  statute: '',           // USC citation, e.g., '20 U.S.C. § 1232g'
  cfr: '',               // CFR citation, e.g., '34 CFR Part 99'
  publicLaw: '',         // e.g., 'Public Law 93-380'
  jurisdiction: '',      // 'federal' or state code

  // --- SOURCE COORDINATES ---
  // Exact government URLs for the real statute text
  sources: {
    primary: {
      type: '',          // 'ecfr' | 'state_legislature' | 'state_admin_code' | 'uscode'
      url: '',           // API URL for fetching full text
      citation: '',      // Human-readable citation
      humanUrl: '',      // URL a human can visit to read the text
    },
    secondary: null,     // Optional second source (e.g., admin code for state regs)
  },

  // --- COMPLIANCE TASKS ---
  // Each task MUST have a statutoryCitation traceable to the source text
  tasks: [
    /*
    {
      title: '',
      description: '',
      statutoryCitation: '',       // e.g., '§ 99.7' — REQUIRED
      statutoryLanguage: '',       // Verbatim quote from statute (first ~100 chars)
      category: '',                // Grouping label
      priority: '',                // 'critical' | 'high' | 'medium'
      assignedRole: '',            // Who is responsible per the statute
      deadline: {
        type: '',                  // 'annual' | 'quarterly' | 'monthly' | 'event-triggered' | 'ongoing' | 'one-time'
        date: null,                // 'MM-DD' for fixed dates, null for event-triggered
        description: '',           // When exactly, per the statute
      },
      evidenceRequired: '',        // What documentation proves compliance
      subtasks: [
        {
          title: '',
          description: '',
          statutoryCitation: '',   // REQUIRED
          priority: '',
        }
      ]
    }
    */
  ],

  // --- DEADLINES ---
  // Standalone deadlines (not attached to a specific task)
  deadlines: [
    /*
    {
      name: '',
      description: '',
      statutoryCitation: '',       // REQUIRED
      frequency: '',               // 'annual' | 'quarterly' | etc.
      recurringMonth: null,        // 1-12 for annual
      recurringDay: null,          // 1-31 for annual
    }
    */
  ],

  // --- PENALTIES ---
  // Non-compliance consequences from the statute
  penalties: [
    /*
    {
      type: '',                    // 'monetary' | 'funding' | 'administrative' | 'criminal' | 'accreditation' | 'operational'
      description: '',
      statutoryCitation: '',       // REQUIRED
      statutoryLanguage: '',       // Verbatim quote
      severity: '',                // 'critical' | 'high' | 'medium' | 'low'
      amount: null,                // '$X' or null
      enforcingAgency: '',         // e.g., 'U.S. Department of Education'
    }
    */
  ],

  // --- RESPONSIBLE ROLES ---
  // Who is accountable per the statute
  responsibleRoles: [
    /*
    {
      role: '',                    // e.g., 'Clery Compliance Officer'
      statutoryCitation: '',       // Where the statute defines this role
      responsibilities: '',        // What the statute says they must do
    }
    */
  ],

  // --- RELATED REGULATIONS ---
  // Informational cross-links only — NEVER import content
  relatedRegulations: [
    /*
    {
      id: '',                      // Slug of the related regulation
      relationship: '',            // How they relate
      type: '',                    // 'dependency' | 'overlap' | 'parent' | 'supplement'
    }
    */
  ],
};
