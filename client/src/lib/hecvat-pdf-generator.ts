/**
 * HECVAT PDF Report Generator
 * 
 * Generates professional PDF compliance reports using jsPDF and jspdf-autotable.
 * Supports both HECVAT Full and HECVAT Lite report formats.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types matching the server-side HECVAT data
interface HecvatQuestion {
  id: string;
  question: string;
  response: string;
  status: 'compliant' | 'partially_compliant' | 'in_progress' | 'not_applicable';
  evidence?: string;
  notes?: string;
  liteIncluded: boolean;
}

interface HecvatSection {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'partially_compliant' | 'in_progress';
  questions: HecvatQuestion[];
}

interface HecvatReport {
  vendor: {
    name: string;
    website: string;
    contactEmail: string;
    contactName: string;
    productName: string;
    productDescription: string;
    completedDate: string;
    version: string;
  };
  sections: HecvatSection[];
  thirdPartyCertifications: {
    provider: string;
    service: string;
    certifications: string[];
  }[];
  metadata: {
    hecvatVersion: string;
    documentVersion: string;
    lastUpdated: string;
    nextReview: string;
    approvedBy: string;
  };
}

// Color palette
const COLORS = {
  primary: [15, 82, 186] as [number, number, number],       // EdSteward blue
  primaryLight: [230, 240, 255] as [number, number, number], // Light blue
  dark: [30, 30, 30] as [number, number, number],            // Near black
  gray: [100, 100, 100] as [number, number, number],         // Dark gray
  lightGray: [200, 200, 200] as [number, number, number],    // Light gray
  bgGray: [245, 245, 245] as [number, number, number],       // Background gray
  success: [22, 163, 74] as [number, number, number],        // Green
  warning: [217, 119, 6] as [number, number, number],        // Amber
  white: [255, 255, 255] as [number, number, number],
};

const PAGE_MARGIN = 20;
const PAGE_WIDTH = 210; // A4 width in mm
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function getStatusLabel(status: string): string {
  switch (status) {
    case 'compliant': return 'Compliant';
    case 'partially_compliant': return 'Partially Compliant';
    case 'in_progress': return 'In Progress';
    case 'not_applicable': return 'N/A';
    default: return status;
  }
}

function getStatusColor(status: string): [number, number, number] {
  switch (status) {
    case 'compliant': return COLORS.success;
    case 'partially_compliant':
    case 'in_progress': return COLORS.warning;
    default: return COLORS.gray;
  }
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = 285;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.lightGray);
  doc.line(PAGE_MARGIN, y - 3, PAGE_WIDTH - PAGE_MARGIN, y - 3);
  doc.text('EdSteward HECVAT Compliance Report', PAGE_MARGIN, y);
  doc.text('CONFIDENTIAL', PAGE_WIDTH / 2, y, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
}

function addPageHeader(doc: jsPDF, title: string) {
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text('EdSteward', PAGE_MARGIN, 10);
  doc.text(title, PAGE_WIDTH - PAGE_MARGIN, 10, { align: 'right' });
  doc.setDrawColor(...COLORS.primaryLight);
  doc.line(PAGE_MARGIN, 12, PAGE_WIDTH - PAGE_MARGIN, 12);
}

function checkPageBreak(doc: jsPDF, currentY: number, neededSpace: number): number {
  if (currentY + neededSpace > 270) {
    doc.addPage();
    addPageHeader(doc, 'HECVAT Compliance Report');
    return 20;
  }
  return currentY;
}

/**
 * Generate a HECVAT Full Compliance Report PDF
 */
export function generateHecvatFullPDF(report: HecvatReport): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  let currentPage = 1;

  // =========================================================================
  // COVER PAGE
  // =========================================================================
  
  // Blue header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 80, 'F');
  
  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('HECVAT', PAGE_MARGIN, 35);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Higher Education Community Vendor Assessment Toolkit', PAGE_MARGIN, 45);
  doc.setFontSize(14);
  doc.text('Full Compliance Report', PAGE_MARGIN, 55);
  
  // Version badge
  doc.setFontSize(10);
  doc.text(`Version ${report.metadata.hecvatVersion}`, PAGE_MARGIN, 70);

  // Vendor info block
  let y = 100;
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(report.vendor.name, PAGE_MARGIN, y);
  
  y += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(report.vendor.productName, PAGE_MARGIN, y);
  
  y += 15;
  doc.setFontSize(10);
  const infoItems = [
    ['Product:', report.vendor.productDescription],
    ['Website:', report.vendor.website],
    ['Contact:', `${report.vendor.contactName} (${report.vendor.contactEmail})`],
    ['Completed:', report.vendor.completedDate],
    ['Document Version:', report.metadata.documentVersion],
    ['Last Updated:', report.metadata.lastUpdated],
    ['Next Review:', report.metadata.nextReview],
    ['Approved By:', report.metadata.approvedBy],
  ];

  for (const [label, value] of infoItems) {
    y = checkPageBreak(doc, y, 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(label, PAGE_MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    
    if (label === 'Product:') {
      const lines = doc.splitTextToSize(value, CONTENT_WIDTH - 25);
      doc.text(lines, PAGE_MARGIN + 25, y);
      y += (lines.length - 1) * 5;
    } else {
      doc.text(value, PAGE_MARGIN + 35, y);
    }
    y += 7;
  }

  // Confidentiality notice
  y = 245;
  doc.setFillColor(...COLORS.bgGray);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 25, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIALITY NOTICE', PAGE_MARGIN + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  const confText = 'This document contains confidential information about EdSteward\'s security posture and compliance status. It is intended solely for the use of the receiving institution\'s authorized personnel for vendor assessment purposes. Do not distribute without authorization.';
  const confLines = doc.splitTextToSize(confText, CONTENT_WIDTH - 10);
  doc.text(confLines, PAGE_MARGIN + 5, y + 13);

  // =========================================================================
  // TABLE OF CONTENTS
  // =========================================================================
  doc.addPage();
  currentPage++;
  addPageHeader(doc, 'HECVAT Compliance Report');

  y = 25;
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', PAGE_MARGIN, y);
  
  y += 15;
  doc.setFontSize(11);
  
  const tocItems = [
    'Executive Summary',
    'Compliance Overview',
    ...report.sections.map((s, i) => `Section ${i + 1}: ${s.name}`),
    'Third-Party Certifications',
    'Policy Document References',
  ];

  for (let i = 0; i < tocItems.length; i++) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    doc.text(`${i + 1}.`, PAGE_MARGIN, y);
    doc.text(tocItems[i], PAGE_MARGIN + 10, y);
    
    // Dotted line
    doc.setTextColor(...COLORS.lightGray);
    const dotsWidth = PAGE_WIDTH - PAGE_MARGIN * 2 - 10 - doc.getTextWidth(tocItems[i]) - 10;
    if (dotsWidth > 10) {
      const dots = '.'.repeat(Math.floor(dotsWidth / 1.5));
      doc.text(dots, PAGE_MARGIN + 10 + doc.getTextWidth(tocItems[i]) + 2, y);
    }
    y += 8;
  }

  // =========================================================================
  // EXECUTIVE SUMMARY
  // =========================================================================
  doc.addPage();
  currentPage++;
  addPageHeader(doc, 'HECVAT Compliance Report');

  y = 25;
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Executive Summary', PAGE_MARGIN, y);

  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  
  const execSummary = `EdSteward is a regulatory compliance management platform purpose-built for higher education institutions. This document presents EdSteward's comprehensive responses to the HECVAT ${report.metadata.hecvatVersion} questionnaire, demonstrating our commitment to security, privacy, and compliance.

EdSteward employs a multi-tenant, database-per-tenant architecture hosted on AWS infrastructure, ensuring complete data isolation between institutions. The platform supports enterprise authentication (SAML 2.0, OIDC, CAS), multi-factor authentication, role-based access control, and comprehensive audit logging.

Our AI-powered features analyze only public regulatory text and never process personal information or education records. All AI outputs require human review before action, and AI features can be fully disabled by administrators.

EdSteward maintains compliance with FERPA, supports GDPR (where applicable), and aligns with HECVAT Lite, HECVAT Full, and HECVAT 4.0 standards including the AI governance section.`;

  const summaryLines = doc.splitTextToSize(execSummary, CONTENT_WIDTH);
  doc.text(summaryLines, PAGE_MARGIN, y);
  y += summaryLines.length * 4.5 + 10;

  // Key highlights
  y = checkPageBreak(doc, y, 60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Key Highlights', PAGE_MARGIN, y);
  y += 8;

  const highlights = [
    'Database-per-tenant architecture for complete data isolation',
    'AES-256 encryption at rest, TLS 1.2+ encryption in transit',
    'SSO support (SAML 2.0, OIDC, CAS) with MFA',
    'Comprehensive audit logging with 7-year retention',
    'AI governance: no PII processing, human oversight required',
    'FERPA compliant: operates as School Official',
    'AWS hosted with SOC 2, ISO 27001, FedRAMP certified infrastructure',
    'Incident response plan with defined SLAs and playbooks',
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  for (const hl of highlights) {
    y = checkPageBreak(doc, y, 7);
    doc.setTextColor(...COLORS.success);
    doc.text('\u2713', PAGE_MARGIN + 2, y);
    doc.setTextColor(...COLORS.gray);
    doc.text(hl, PAGE_MARGIN + 10, y);
    y += 6;
  }

  // =========================================================================
  // COMPLIANCE OVERVIEW TABLE
  // =========================================================================
  y += 10;
  y = checkPageBreak(doc, y, 80);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('2. Compliance Overview', PAGE_MARGIN, y);
  y += 10;

  const overviewData = report.sections.map(section => {
    const compliant = section.questions.filter(q => q.status === 'compliant').length;
    const total = section.questions.length;
    return [
      section.name,
      getStatusLabel(section.status),
      `${compliant}/${total}`,
      `${Math.round((compliant / total) * 100)}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Section', 'Status', 'Compliant', 'Score']],
    body: overviewData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
    },
    alternateRowStyles: {
      fillColor: COLORS.bgGray,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = data.cell.raw as string;
        if (val === 'Compliant') {
          data.cell.styles.textColor = COLORS.success;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'In Progress') {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // =========================================================================
  // SECTION-BY-SECTION RESPONSES
  // =========================================================================
  for (let sIdx = 0; sIdx < report.sections.length; sIdx++) {
    const section = report.sections[sIdx];
    
    doc.addPage();
    currentPage++;
    addPageHeader(doc, 'HECVAT Compliance Report');

    y = 25;
    
    // Section header
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(PAGE_MARGIN, y - 5, CONTENT_WIDTH, 18, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Section ${sIdx + 3}: ${section.name}`, PAGE_MARGIN + 5, y + 5);
    
    // Status badge
    const statusColor = getStatusColor(section.status);
    const statusLabel = getStatusLabel(section.status);
    doc.setFontSize(9);
    doc.text(statusLabel, PAGE_WIDTH - PAGE_MARGIN - 5 - doc.getTextWidth(statusLabel), y + 5);

    y += 20;
    
    // Section description
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.gray);
    const descLines = doc.splitTextToSize(section.description, CONTENT_WIDTH);
    doc.text(descLines, PAGE_MARGIN, y);
    y += descLines.length * 4 + 8;

    // Questions and responses
    for (const question of section.questions) {
      // Calculate space needed
      const responseLines = doc.splitTextToSize(question.response, CONTENT_WIDTH - 10);
      const evidenceLines = question.evidence ? doc.splitTextToSize(`Evidence: ${question.evidence}`, CONTENT_WIDTH - 10) : [];
      const notesLines = question.notes ? doc.splitTextToSize(`Note: ${question.notes}`, CONTENT_WIDTH - 10) : [];
      const neededSpace = 15 + responseLines.length * 4 + evidenceLines.length * 3.5 + notesLines.length * 3.5 + 10;
      
      y = checkPageBreak(doc, y, Math.min(neededSpace, 80));

      // Question ID and status
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text(question.id, PAGE_MARGIN, y);
      
      // Status indicator
      const qStatusColor = getStatusColor(question.status);
      doc.setFillColor(...qStatusColor);
      doc.circle(PAGE_WIDTH - PAGE_MARGIN - 3, y - 1, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...qStatusColor);
      doc.text(getStatusLabel(question.status), PAGE_WIDTH - PAGE_MARGIN - 7 - doc.getTextWidth(getStatusLabel(question.status)), y);
      
      y += 5;
      
      // Question text
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.setFontSize(9);
      const qLines = doc.splitTextToSize(question.question, CONTENT_WIDTH - 10);
      doc.text(qLines, PAGE_MARGIN + 5, y);
      y += qLines.length * 4 + 3;

      // Response
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(9);
      doc.text(responseLines, PAGE_MARGIN + 5, y);
      y += responseLines.length * 4 + 2;

      // Evidence reference
      if (question.evidence) {
        y = checkPageBreak(doc, y, 8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.primary);
        doc.text(evidenceLines, PAGE_MARGIN + 5, y);
        y += evidenceLines.length * 3.5 + 1;
      }

      // Notes
      if (question.notes) {
        y = checkPageBreak(doc, y, 8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.warning);
        doc.text(notesLines, PAGE_MARGIN + 5, y);
        y += notesLines.length * 3.5 + 1;
      }

      // Divider line
      y += 3;
      doc.setDrawColor(...COLORS.bgGray);
      doc.line(PAGE_MARGIN + 5, y, PAGE_WIDTH - PAGE_MARGIN - 5, y);
      y += 5;
    }
  }

  // =========================================================================
  // THIRD-PARTY CERTIFICATIONS
  // =========================================================================
  doc.addPage();
  currentPage++;
  addPageHeader(doc, 'HECVAT Compliance Report');

  y = 25;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`${report.sections.length + 3}. Third-Party Certifications`, PAGE_MARGIN, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('EdSteward leverages infrastructure and services from certified providers:', PAGE_MARGIN, y);
  y += 8;

  const certData = report.thirdPartyCertifications.map(cert => [
    cert.provider,
    cert.service,
    cert.certifications.join(', '),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Provider', 'Service', 'Certifications']],
    body: certData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
    },
    alternateRowStyles: {
      fillColor: COLORS.bgGray,
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  // @ts-ignore - autoTable sets finalY on doc
  y = (doc as any).lastAutoTable.finalY + 15;

  // =========================================================================
  // POLICY DOCUMENT REFERENCES
  // =========================================================================
  y = checkPageBreak(doc, y, 80);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`${report.sections.length + 4}. Policy Document References`, PAGE_MARGIN, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('The following policy documents support this HECVAT report and are available upon request:', PAGE_MARGIN, y);
  y += 8;

  const policyDocs = [
    ['Information Security Policy', 'Annual', 'February 2026', 'February 2027'],
    ['Incident Response Plan', 'Semi-annual', 'February 2026', 'August 2026'],
    ['Data Retention Policy', 'Annual', 'February 2026', 'February 2027'],
    ['Privacy Policy', 'Annual', 'February 2026', 'February 2027'],
    ['AI Governance Policy', 'Semi-annual', 'February 2026', 'August 2026'],
    ['Emergency Access Procedure', 'Annual', 'February 2026', 'February 2027'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Document', 'Review Frequency', 'Last Reviewed', 'Next Review']],
    body: policyDocs,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
    },
    alternateRowStyles: {
      fillColor: COLORS.bgGray,
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 15;

  // Contact information
  y = checkPageBreak(doc, y, 40);
  doc.setFillColor(...COLORS.primaryLight);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 30, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('For Compliance Inquiries', PAGE_MARGIN + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.text(`General Support: ${report.vendor.contactEmail}`, PAGE_MARGIN + 5, y + 15);
  doc.text(`${report.vendor.contactName}: david@edsteward.ai`, PAGE_MARGIN + 5, y + 21);
  doc.text(`Website: ${report.vendor.website}`, PAGE_MARGIN + 5, y + 27);

  // =========================================================================
  // ADD PAGE NUMBERS
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  // Save
  doc.save(`EdSteward_HECVAT_Full_Report_${report.vendor.completedDate}.pdf`);
}

/**
 * Generate a HECVAT Lite Summary PDF (condensed version)
 */
export function generateHecvatLitePDF(report: HecvatReport): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');

  // =========================================================================
  // COVER / HEADER
  // =========================================================================
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 50, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('HECVAT Lite', PAGE_MARGIN, 25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Compliance Summary Report', PAGE_MARGIN, 35);
  doc.setFontSize(9);
  doc.text(`${report.vendor.name} | ${report.vendor.completedDate} | Version ${report.metadata.hecvatVersion}`, PAGE_MARGIN, 45);

  let y = 60;

  // Vendor info
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Vendor:', PAGE_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(report.vendor.name, PAGE_MARGIN + 25, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Product:', PAGE_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(report.vendor.productName, PAGE_MARGIN + 25, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Contact:', PAGE_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.vendor.contactName} (${report.vendor.contactEmail})`, PAGE_MARGIN + 25, y);
  y += 12;

  // Compliance overview table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Compliance Overview', PAGE_MARGIN, y);
  y += 8;

  const overviewData = report.sections.map(section => {
    const compliant = section.questions.filter(q => q.status === 'compliant').length;
    const total = section.questions.length;
    return [
      section.name,
      getStatusLabel(section.status),
      `${Math.round((compliant / total) * 100)}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Section', 'Status', 'Score']],
    body: overviewData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
    },
    alternateRowStyles: {
      fillColor: COLORS.bgGray,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 50 },
      2: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = data.cell.raw as string;
        if (val === 'Compliant') {
          data.cell.styles.textColor = COLORS.success;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'In Progress') {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 12;

  // =========================================================================
  // LITE QUESTIONS (only liteIncluded = true)
  // =========================================================================
  for (const section of report.sections) {
    const liteQuestions = section.questions.filter(q => q.liteIncluded);
    if (liteQuestions.length === 0) continue;

    y = checkPageBreak(doc, y, 25);

    // Section header
    doc.setFillColor(...COLORS.primaryLight);
    doc.roundedRect(PAGE_MARGIN, y - 3, CONTENT_WIDTH, 10, 1, 1, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(section.name, PAGE_MARGIN + 3, y + 4);
    y += 12;

    for (const question of liteQuestions) {
      const responseLines = doc.splitTextToSize(question.response, CONTENT_WIDTH - 5);
      const neededSpace = 10 + responseLines.length * 3.8 + 5;
      y = checkPageBreak(doc, y, Math.min(neededSpace, 60));

      // Question
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      
      const qText = `${question.id}: ${question.question}`;
      const qLines = doc.splitTextToSize(qText, CONTENT_WIDTH - 5);
      doc.text(qLines, PAGE_MARGIN + 3, y);
      y += qLines.length * 3.8 + 2;

      // Response
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(8.5);
      doc.text(responseLines, PAGE_MARGIN + 3, y);
      y += responseLines.length * 3.8 + 2;

      // Status badge inline
      const statusColor = getStatusColor(question.status);
      doc.setFillColor(...statusColor);
      doc.circle(PAGE_MARGIN + 5, y, 1.5, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...statusColor);
      doc.text(getStatusLabel(question.status), PAGE_MARGIN + 9, y + 0.5);
      y += 6;
    }
  }

  // =========================================================================
  // THIRD-PARTY CERTIFICATIONS (compact)
  // =========================================================================
  y = checkPageBreak(doc, y, 50);
  y += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Third-Party Certifications', PAGE_MARGIN, y);
  y += 8;

  const certData = report.thirdPartyCertifications.map(cert => [
    cert.provider,
    cert.certifications.join(', '),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Provider', 'Certifications']],
    body: certData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bgGray },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 10;

  // Contact footer
  y = checkPageBreak(doc, y, 20);
  doc.setFillColor(...COLORS.primaryLight);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 15, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.primary);
  doc.text(`For the full HECVAT report or compliance inquiries: ${report.vendor.contactEmail} | ${report.vendor.website}`, PAGE_MARGIN + 5, y + 9);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  // Save
  doc.save(`EdSteward_HECVAT_Lite_Summary_${report.vendor.completedDate}.pdf`);
}
