#!/usr/bin/env node

/**
 * Simple Mock LLM Gateway
 * Provides the exact endpoints the delivery system needs for testing
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Mock USC 17 Section 110 content
const mockUSCContent = {
  success: true,
  data: {
    title: "17 USC § 110 - Limitations on exclusive rights: Exemption of certain performances and displays",
    section: "110",
    subsection: "(2) - TEACH Act provisions", 
    content: `Notwithstanding the provisions of section 106, the following are not infringements of copyright:

(1) performance or display of a work by instructors or pupils in the course of face-to-face teaching activities of a nonprofit educational institution, in a classroom or similar place devoted to instruction, unless, in the case of a motion picture or other audiovisual work, the performance, or the display of individual images, is given by means of a copy that was not lawfully made under this title, and that the person responsible for the performance knew or had reason to believe was not lawfully made;

(2) except with respect to a work produced or marketed primarily for performance or display as part of mediated instructional activities transmitted via digital networks, or a performance or display that is given by means of a copy or phonorecord that is not lawfully made and acquired under this title, and the transmitting government body or accredited nonprofit educational institution knew or had reason to believe was not lawfully made and acquired, the performance of a nondramatic literary or musical work or reasonable and limited portions of any other work, or display of a work in an amount comparable to that which is typically displayed in the course of a live classroom session, by or in the course of a transmission, if—

(A) the performance or display is made by, at the direction of, or under the actual supervision of an instructor as an integral part of a class session offered as a regular part of the systematic mediated instructional activities of a governmental body or an accredited nonprofit educational institution;

(B) the performance or display is directly related and of material assistance to the teaching content of the transmission;

(C) the transmission is made solely for, and, to the extent technologically feasible, the reception of such transmission is limited to—
(i) students officially enrolled in the course for which the transmission is made; or
(ii) officers or employees of governmental bodies as a part of their official duties or employment; and

(D) the transmitting body or institution—
(i) institutes policies regarding copyright, provides informational materials to faculty, students, and relevant staff members that accurately describe, and promote compliance with, the laws of the United States relating to copyright, and provides notice to students that materials used in connection with the course may be subject to copyright protection; and
(ii) provides, if the transmission is digital, reasonable measures to prevent—
(I) retention of the work in accessible form by recipients of the transmission from the transmitting body or institution for longer than the class session; and
(II) unauthorized further dissemination of the work in accessible form by such recipients to others; and
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination;`,
    version: "2025.08.20",
    lastUpdated: "2025-08-20T15:00:00Z",
    source: "US House of Representatives - USC",
    sourceUrl: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section110&num=0&edition=prelim"
  }
};

// Mock CFR content
const mockCFRContent = {
  success: true,
  data: {
    title: "CFR TEACH Act Guidance",
    content: "The Copyright Office provides guidance on the TEACH Act provisions under 17 USC 110(2). Educational institutions must comply with specific requirements for digital transmissions of copyrighted works in distance education.",
    version: "2025.08.20",
    lastUpdated: "2025-08-20T15:00:00Z",
    source: "US Copyright Office"
  }
};

// Mock compliance content
const mockComplianceContent = {
  success: true,
  data: {
    title: "TEACH Act Compliance Guide",
    content: "To comply with the TEACH Act, institutions must: 1) Limit access to enrolled students, 2) Prevent retention beyond class session, 3) Implement copyright policies, 4) Use reasonable technological measures.",
    version: "2025.08.20",
    lastUpdated: "2025-08-20T15:00:00Z"
  }
};

// Mock versioning content
const mockVersioningContent = {
  success: true,
  data: {
    currentVersion: "2025.08.20",
    systemInfo: {
      lastUpdate: "2025-08-20T15:00:00Z",
      status: "active"
    }
  }
};

// Routes that the delivery system expects
app.get('/api/llm/usc/17/110', (req, res) => {
  console.log('📖 Serving USC 17 Section 110 content');
  res.json(mockUSCContent);
});

app.get('/api/llm/cfr/teach-act', (req, res) => {
  console.log('📋 Serving CFR TEACH Act content');
  res.json(mockCFRContent);
});

app.get('/api/llm/compliance/teach-act', (req, res) => {
  console.log('✅ Serving compliance guide content');
  res.json(mockComplianceContent);
});

app.get('/api/llm/versioning/system-info', (req, res) => {
  console.log('🔢 Serving versioning info');
  res.json(mockVersioningContent);
});

app.post('/api/llm/query', (req, res) => {
  console.log('🤖 Serving LLM query response');
  res.json({
    success: true,
    data: {
      response: "Mock LLM response for comprehensive analysis",
      regulation: req.body.options?.regulation || "REG-66",
      timestamp: new Date().toISOString()
    }
  });
});

// Health check
app.get('/api/llm/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Simple Mock LLM Gateway',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/llm/usc/17/110',
      '/api/llm/cfr/teach-act', 
      '/api/llm/compliance/teach-act',
      '/api/llm/versioning/system-info',
      '/api/llm/query'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple Mock LLM Gateway running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/llm/health`);
  console.log(`📖 USC endpoint: http://localhost:${PORT}/api/llm/usc/17/110`);
});

