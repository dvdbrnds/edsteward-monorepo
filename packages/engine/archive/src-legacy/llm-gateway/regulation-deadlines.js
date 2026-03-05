/**
 * Deadline mapping for top 10 demo regulations
 * Extracted from compmat.csv and official sources
 */

export const regulationDeadlines = {
  'clery-act': {
    edStewardId: 55,
    itemId: 2041,
    deadlines: [
      { type: 'Annual', description: 'Annual Security Report', date: 'October 1', recurring: true },
      { type: 'Daily', description: 'Crime Log Updates', date: 'Within 2 business days', recurring: true },
      { type: 'Timely', description: 'Timely Warnings', date: 'As incidents occur', recurring: true }
    ]
  },
  'family-educational-rights-and-privacy-act-ferpa': {
    edStewardId: 51,
    itemId: 2029,
    deadlines: [
      { type: 'Annual', description: 'Annual Notification', date: 'Beginning of each academic year', recurring: true },
      { type: 'On Request', description: 'Record Access', date: 'Within 45 days of request', recurring: false }
    ]
  },
  'title-ix-of-the-education-amendment-of-1972': {
    edStewardId: 61,
    itemId: 2042,
    deadlines: [
      { type: 'Ongoing', description: 'Complaint Investigation', date: 'Within reasonable time (typically 60-90 days)', recurring: false },
      { type: 'Annual', description: 'Training Requirements', date: 'Annually for Title IX Coordinator and investigators', recurring: true }
    ]
  },
  'higher-education-act-title-iv-student-financial-a': {
    edStewardId: 26,
    itemId: 1605,
    deadlines: [
      { type: 'Annual', description: 'Financial Aid Disclosures', date: 'October 1', recurring: true },
      { type: 'Annual', description: 'FISAP Submission', date: 'September 30', recurring: true }
    ]
  },
  'violence-against-women-reauthorization-act': {
    edStewardId: 55,
    itemId: 2041,
    deadlines: [
      { type: 'Annual', description: 'VAWA Statistics in ASR', date: 'October 1', recurring: true },
      { type: 'Ongoing', description: 'Policy Compliance', date: 'Ongoing', recurring: true }
    ]
  },
  'americans-with-disabilities-act-of-1990': {
    edStewardId: 2,
    itemId: 1786,
    deadlines: [
      { type: 'Ongoing', description: 'Accommodation Requests', date: 'Within reasonable time of request', recurring: false },
      { type: 'Annual', description: 'ADA Compliance Review', date: 'Annually', recurring: true }
    ]
  },
  'section-504-of-the-rehabilitation-act-of-1973': {
    edStewardId: 2,
    itemId: 1898,
    deadlines: [
      { type: 'Ongoing', description: 'Section 504 Accommodation Requests', date: 'Within reasonable time', recurring: false },
      { type: 'Annual', description: 'Section 504 Compliance Review', date: 'Annually', recurring: true }
    ]
  },
  'title-vi-of-the-civil-rights-act-of-1964': {
    edStewardId: 62,
    itemId: 2043,
    deadlines: [
      { type: 'Ongoing', description: 'Non-Discrimination Compliance', date: 'Ongoing', recurring: true },
      { type: 'Annual', description: 'Title VI Compliance Review', date: 'Annually', recurring: true }
    ]
  },
  'technology-education-and-copyright-harmonization-a': {
    edStewardId: 25,
    itemId: null, // Not in compmat
    deadlines: [
      { type: 'Ongoing', description: 'Copyright Policy Compliance', date: 'Ongoing', recurring: true },
      { type: 'Annual', description: 'Faculty Copyright Training', date: 'Annually', recurring: true }
    ]
  },
  'drug-free-schools-and-communities-act': {
    edStewardId: 60,
    itemId: 1807,
    deadlines: [
      { type: 'Biennial', description: 'Biennial Review', date: 'Every 2 years', recurring: true },
      { type: 'Annual', description: 'Drug-Free Policy Distribution', date: 'Annually', recurring: true }
    ]
  },
  'higher-education-opportunity-act-sections-152-and-': {
    edStewardId: 5,
    itemId: 3392,
    deadlines: [
      { type: 'Annual', description: 'Transfer Credit Policy Disclosure', date: 'October 1', recurring: true },
      { type: 'Annual', description: 'Textbook Information', date: 'October 1', recurring: true }
    ]
  }
};

export function getDeadlines(regulationSlug) {
  return regulationDeadlines[regulationSlug] || {
    edStewardId: null,
    itemId: null,
    deadlines: []
  };
}

export default regulationDeadlines;
