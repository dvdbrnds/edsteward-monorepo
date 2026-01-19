const AWS = require('aws-sdk');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Constants
const REGULATIONS_TABLE = process.env.REGULATIONS_TABLE || 'Regulations';
const BASELINES_BUCKET = process.env.BASELINES_BUCKET || 'mcp-validation-baselines';

/**
 * Collects data from a website using Puppeteer (headless Chrome)
 */
async function collectWithPuppeteer(url, selectors = {}) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    console.log(`Collecting data from ${url} using Puppeteer`);
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract content based on selectors
    const result = await page.evaluate((sel) => {
      const data = {};
      
      for (const [key, selector] of Object.entries(sel)) {
        const elements = document.querySelectorAll(selector);
        data[key] = Array.from(elements).map(el => el.textContent.trim());
      }
      
      // Get page title and metadata
      data.title = document.title;
      
      // Get all text content
      data.fullText = document.body.innerText;
      
      return data;
    }, selectors || {
      paragraphs: 'p',
      headings: 'h1, h2, h3, h4, h5, h6',
      lists: 'li',
      tables: 'table'
    });
    
    // Add metadata
    result.url = url;
    result.timestamp = new Date().toISOString();
    result.method = 'puppeteer';
    
    return result;
  } finally {
    await browser.close();
  }
}

/**
 * Fallback method using axios and cheerio
 */
async function collectWithCheerio(url, selectors = {}) {
  try {
    console.log(`Collecting data from ${url} using Cheerio`);
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const result = {};
    
    // Extract content based on selectors
    for (const [key, selector] of Object.entries(selectors || {
      paragraphs: 'p',
      headings: 'h1, h2, h3, h4, h5, h6',
      lists: 'li',
      tables: 'table'
    })) {
      result[key] = [];
      $(selector).each((_, el) => {
        result[key].push($(el).text().trim());
      });
    }
    
    // Get page title
    result.title = $('title').text().trim();
    
    // Get all text content
    result.fullText = $('body').text().trim();
    
    // Add metadata
    result.url = url;
    result.timestamp = new Date().toISOString();
    result.method = 'cheerio';
    
    return result;
  } catch (error) {
    console.error(`Error collecting data with Cheerio: ${error.message}`);
    throw error;
  }
}

/**
 * Collects data from a single URL
 */
async function collectDataFromUrl(url, selectors) {
  try {
    return await collectWithPuppeteer(url, selectors);
  } catch (error) {
    console.warn(`Puppeteer collection failed, falling back to Cheerio: ${error.message}`);
    return await collectWithCheerio(url, selectors);
  }
}

/**
 * Stores the collected data in S3
 */
async function storeDataInS3(regulationId, data) {
  const baselineId = `${String(regulationId || '').toLowerCase()}-${uuidv4()}`;
  const key = `${regulationId}/${baselineId}.json`;
  
  await s3.putObject({
    Bucket: BASELINES_BUCKET,
    Key: key,
    Body: JSON.stringify({
      baselineId,
      regulationId,
      created: new Date().toISOString(),
      sources: data.map(item => item.url),
      data
    }, null, 2),
    ContentType: 'application/json'
  }).promise();
  
  return {
    baselineId,
    s3Key: key,
    s3Bucket: BASELINES_BUCKET
  };
}

/**
 * Updates the regulation record in DynamoDB
 */
async function updateRegulationRecord(regulationId, baselineInfo) {
  await dynamoDB.update({
    TableName: REGULATIONS_TABLE,
    Key: {
      regulationId
    },
    UpdateExpression: 'set lastBaseline = :baseline, lastCollected = :timestamp',
    ExpressionAttributeValues: {
      ':baseline': baselineInfo.baselineId,
      ':timestamp': new Date().toISOString()
    }
  }).promise();
}

/**
 * Lambda handler function
 */
exports.handler = async (event) => {
  try {
    console.log('Data collection event:', JSON.stringify(event));
    
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { regulationId, sources } = body;
    
    if (!regulationId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'regulationId is required' })
      };
    }
    
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'sources array is required and must not be empty' })
      };
    }
    
    // Collect data from each source URL
    const results = [];
    for (const url of sources) {
      const data = await collectDataFromUrl(url);
      results.push(data);
    }
    
    // Store the collected data in S3
    const baselineInfo = await storeDataInS3(regulationId, results);
    
    // Update the regulation record in DynamoDB
    await updateRegulationRecord(regulationId, baselineInfo);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Data collection completed successfully',
        regulationId,
        baseline: baselineInfo,
        sourceCount: results.length
      })
    };
  } catch (error) {
    console.error('Error in data collection:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error processing the data collection request',
        error: error.message
      })
    };
  }
}; 