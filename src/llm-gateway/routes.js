/**
 * LLM Gateway Routes
 * Routes for LLM interaction with regulation MCP servers
 */
import express from 'express';
import { processComplianceQuery } from './compliance-processor.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('llm-gateway-routes');
const router = express.Router();

// Store regulations in memory (TODO: Move to proper service/repository)
let regulations = [];

/**
 * Load regulations from CSV file
 */
export async function loadRegulations() {
  try {
    const { parse } = await import('csv-parse/sync');
    const fs = await import('fs');
    const path = await import('path');
    
    const csvFilePath = path.resolve(process.cwd(), 'compmat.csv');
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    regulations = records.map((record, index) => ({
      id: index + 1,
      category: record.Category || 'Uncategorized',
      name: record.Name || 'Unnamed',
      description: record.Description || '',
      statute: record.Statute || '',
      regulation: record.Regulation || '',
      deadline: record.Deadline || '',
      reportingRequirements: record['Reporting Requirements'] || '',
      ...record
    }));
    
    logger.info(`Loaded ${regulations.length} regulations from CSV`);
  } catch (error) {
    logger.error(`Failed to load regulations: ${error.message}`);
    regulations = [];
  }
}

// Get all regulations
router.get('/regulations', (req, res) => {
  res.json({
    count: regulations.length,
    regulations
  });
});

// Get regulations by category
router.get('/regulations/category/:category', (req, res) => {
  const categoryRegulations = regulations.filter(
    reg => reg.category.toLowerCase() === req.params.category.toLowerCase()
  );
  
  res.json({
    count: categoryRegulations.length,
    regulations: categoryRegulations
  });
});

// Compliance processing endpoint
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      logger.warn('Missing query parameter');
      return res.status(400).json({
        error: 'Missing required parameter: query'
      });
    }

    logger.info(`Processing compliance query: "${query}"`);
    
    // Process the query
    const result = await processComplianceQuery(query);
    
    // Return the result
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error processing query: ${error.message}`);
    res.status(500).json({
      error: 'Error processing query',
      message: error.message
    });
  }
});

// Simulate LLM validation request
router.post('/validate', (req, res) => {
  const { text, regulationIds } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Text content is required' });
  }
  
  let regsToCheck = regulations;
  
  // Filter by specified regulations if provided
  if (regulationIds && Array.isArray(regulationIds) && regulationIds.length > 0) {
    regsToCheck = regulations.filter(reg => regulationIds.includes(reg.id));
  }
  
  // Simulate validation processing
  const results = regsToCheck.map(reg => {
    // Simple simulation: random compliance status based on keyword matching
    const keywords = [reg.name, reg.category, reg.statute].filter(Boolean);
    const hasKeywords = keywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const compliant = hasKeywords ? Math.random() > 0.3 : Math.random() > 0.7;
    
    return {
      regulationId: reg.id,
      name: reg.name,
      category: reg.category,
      compliant,
      confidence: Math.random() * 0.5 + 0.5, // Random confidence between 0.5 and 1.0
      issues: compliant ? [] : [`Potential non-compliance with ${reg.name}`],
      recommendations: compliant ? [] : [`Review and update to comply with ${reg.name}`]
    };
  });
  
  // Log validation request
  logger.info(`Processed validation request with ${regsToCheck.length} regulations`);
  
  res.json({
    timestamp: new Date().toISOString(),
    results
  });
});

// Simulate change detection request
router.post('/detect-changes', (req, res) => {
  const { previousText, currentText, categories } = req.body;
  
  if (!previousText || !currentText) {
    return res.status(400).json({ error: 'Both previous and current text content are required' });
  }
  
  let regsToCheck = regulations;
  
  // Filter by specified categories if provided
  if (categories && Array.isArray(categories) && categories.length > 0) {
    regsToCheck = regulations.filter(reg => 
      categories.some(cat => reg.category.toLowerCase() === cat.toLowerCase())
    );
  }
  
  // Simulate change detection processing
  const changesDetected = Math.random() > 0.5;
  const results = changesDetected ? 
    regsToCheck.slice(0, Math.floor(Math.random() * 3) + 1).map(reg => ({
      regulationId: reg.id,
      name: reg.name,
      category: reg.category,
      changeDetected: true,
      confidence: Math.random() * 0.3 + 0.7, // Random confidence between 0.7 and 1.0
      details: `Detected changes related to ${reg.name} requirements`
    })) : [];
  
  // Log change detection request
  logger.info(`Processed change detection request with ${regsToCheck.length} regulations`);
  
  res.json({
    timestamp: new Date().toISOString(),
    changesDetected,
    results
  });
});

export default router; 