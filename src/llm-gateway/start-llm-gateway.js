#!/usr/bin/env node

/**
 * Start LLM Gateway Service
 * 
 * This script starts the LLM Gateway Service that allows LLMs (Claude, ChatGPT, Gemini)
 * to interact with the regulation MCP servers.
 * 
 * Usage: node start-llm-gateway.js [port]
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { processComplianceQuery } from './compliance-processor.js';
import { setupLogger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('llm-gateway');

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server configuration
const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Store regulations in memory
let regulations = [];

// Load regulations from CSV file
async function loadRegulations() {
  try {
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

// API Endpoints

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'llm-gateway',
    timestamp: new Date().toISOString()
  });
});

// Get all regulations
app.get('/api/regulations', (req, res) => {
  res.json({
    count: regulations.length,
    regulations
  });
});

// Get regulations by category
app.get('/api/regulations/category/:category', (req, res) => {
  const categoryRegulations = regulations.filter(
    reg => reg.category.toLowerCase() === req.params.category.toLowerCase()
  );
  
  res.json({
    count: categoryRegulations.length,
    regulations: categoryRegulations
  });
});

// Compliance processing endpoint
app.post('/compliance/query', async (req, res) => {
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
app.post('/api/validate', (req, res) => {
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
app.post('/api/detect-changes', (req, res) => {
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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Initialize and start the server
async function startServer() {
  try {
    // Load regulations from CSV
    await loadRegulations();
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`LLM Gateway server started on port ${PORT}`);
      logger.info(`Health check endpoint: http://localhost:${PORT}/health`);
      logger.info(`Compliance query endpoint: http://localhost:${PORT}/compliance/query`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();

export default app; 