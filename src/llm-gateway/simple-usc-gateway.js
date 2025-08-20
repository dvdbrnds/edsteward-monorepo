#!/usr/bin/env node

/**
 * Simple USC Gateway - Minimal LLM Gateway with USC/CFR endpoints
 * Provides the endpoints that the delivery system needs
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// USC 17 Section 110 (TEACH Act) endpoint
app.get('/api/llm/usc/17/110', async (req, res) => {
  try {
    console.log('📖 Fetching USC 17 Section 110 (TEACH Act) content...');
    
    // Real USC 17 Section 110 content (abbreviated for testing)
    const uscContent = {
      success: true,
      data: {
        title: "17",
        section: "110",
        fullText: `§ 110. Limitations on exclusive rights: Exemption of certain performances and displays

(1) performance or display of a work by instructors or pupils in the course of face-to-face teaching activities of a nonprofit educational institution, in a classroom or similar place devoted to instruction, unless, in the case of a motion picture or other audiovisual work, the performance, or the display of individual images, is given by means of a copy that was not lawfully made under this title, and that the person responsible for the performance knew or had reason to believe was not lawfully made;

(2) except with respect to a work produced or marketed primarily for performance or display as part of mediated instructional activities transmitted via digital networks, or a performance or display that is given by means of a copy or phonorecord that is not lawfully made and acquired under this title, and the transmitting government body or accredited nonprofit educational institution knew or had reason to believe was not lawfully made and acquired, the performance of a nondramatic literary or musical work or reasonable and limited portions of any other work, or display of a work in an amount comparable to that which is typically displayed in the course of a live classroom session, by or in the course of a transmission, if—

(A) the performance or display is made by, at the direction of, or under the actual supervision of an instructor as an integral part of a class session offered as a regular part of the systematic instructional activities of a governmental body or an accredited nonprofit educational institution;

(B) the performance or display is directly related and of material assistance to the teaching content of the transmission;

(C) the transmission is made solely for, and, to the extent technologically feasible, the reception of such transmission is limited to—
(i) students officially enrolled in the course for which the transmission is made; or
(ii) officers or employees of governmental bodies as a part of their official duties or employment; and

(D) the transmitting body or institution—
(i) institutes policies regarding copyright, provides informational materials to faculty, students, and relevant staff members that accurately describe, and promote compliance with, the laws of the United States relating to copyright, and provides notice to students that materials used in connection with the course may be subject to copyright protection; and
(ii) applies technological measures that reasonably prevent—
(I) retention of the work in accessible form by recipients of the transmission from the transmitting body or institution for longer than the class session; and
(II) unauthorized further dissemination of the work in accessible form by such recipients to others; and
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination;`,
        content: "USC 17 Section 110 - TEACH Act provisions for educational use of copyrighted materials",
        version: "2024.1",
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(uscContent);
  } catch (error) {
    console.error('❌ USC endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch USC content',
        details: error.message
      }
    });
  }
});

// CFR TEACH Act endpoint
app.get('/api/llm/cfr/teach-act', async (req, res) => {
  try {
    console.log('📖 Fetching CFR TEACH Act guidance...');
    
    const cfrContent = {
      success: true,
      data: {
        regulation: "CFR Title 37",
        topic: "TEACH Act Implementation",
        content: "CFR guidance on TEACH Act implementation for educational institutions",
        fullText: "Code of Federal Regulations guidance on the Technology, Education, and Copyright Harmonization (TEACH) Act implementation requirements for educational institutions.",
        version: "2024.1",
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(cfrContent);
  } catch (error) {
    console.error('❌ CFR endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch CFR content',
        details: error.message
      }
    });
  }
});

// Compliance endpoint
app.get('/api/llm/compliance/teach-act', async (req, res) => {
  try {
    const complianceContent = {
      success: true,
      data: {
        regulation: "TEACH Act Compliance",
        content: "Compliance requirements for educational institutions under the TEACH Act",
        requirements: [
          "Implement copyright policies",
          "Provide copyright education",
          "Apply technological measures",
          "Limit access to enrolled students"
        ],
        version: "2024.1"
      }
    };

    res.json(complianceContent);
  } catch (error) {
    console.error('❌ Compliance endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch compliance content',
        details: error.message
      }
    });
  }
});

// Versioning endpoint
app.get('/api/llm/versioning/current-regulation', async (req, res) => {
  try {
    const versioningContent = {
      success: true,
      data: {
        currentRegulation: {
          id: "REG-66",
          name: "TEACH Act",
          version: "2024.1.0",
          lastUpdated: new Date().toISOString(),
          status: "active"
        }
      }
    };

    res.json(versioningContent);
  } catch (error) {
    console.error('❌ Versioning endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch versioning content',
        details: error.message
      }
    });
  }
});

// Health check
app.get('/api/llm/health', (req, res) => {
  res.json({
    service: 'Simple USC Gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/llm/usc/17/110',
      '/api/llm/cfr/teach-act',
      '/api/llm/compliance/teach-act',
      '/api/llm/versioning/current-regulation'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple USC Gateway running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET /api/llm/usc/17/110`);
  console.log(`   GET /api/llm/cfr/teach-act`);
  console.log(`   GET /api/llm/compliance/teach-act`);
  console.log(`   GET /api/llm/versioning/current-regulation`);
  console.log(`   GET /api/llm/health`);
});

