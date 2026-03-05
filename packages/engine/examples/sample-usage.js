/**
 * Sample script demonstrating how to use the MCP SDK
 */

// Import the MCP SDK
const MCPClient = require('./src/mcp-sdk');

// Sample regulation text
const regulationText = `
§ 1026.19 Certain mortgage and variable-rate transactions.
(a) Mortgage transactions subject to RESPA -
(1) Time of disclosures. In a mortgage transaction subject to the Real Estate Settlement Procedures Act (12 U.S.C. 2601 et seq.) that is secured by the consumer's dwelling, other than a home equity line of credit subject to § 1026.40 or mortgage transaction subject to paragraph (e) of this section, the creditor shall make good faith estimates of the disclosures required by § 1026.18 and shall deliver or place them in the mail not later than the third business day after the creditor receives the consumer's written application.
(2) Imposition of fees. Except as provided in paragraph (a)(2)(ii) of this section, neither a creditor nor any other person may impose a fee on a consumer in connection with the consumer's application for a mortgage transaction subject to paragraph (a)(1) of this section before the consumer has received the disclosures required by paragraph (a)(1) of this section. If the disclosures are mailed to the consumer, the consumer is considered to have received them three business days after they are mailed.
`;

// Example function to demonstrate SDK usage
async function runExample() {
  try {
    // Initialize the MCP client
    const client = new MCPClient({
      serverUrl: 'http://localhost:3000/mcp',
      timeout: 30000 // 30 seconds
    });
    
    console.log('Initializing MCP client...');
    await client.initialize();
    console.log('Client initialized successfully!');
    
    // Example 1: Fetch a regulation by document number
    try {
      console.log('\n---- Fetching regulation ----');
      const regulation = await client.fetchRegulation({
        document_number: '2021-14671'
      });
      console.log('Regulation title:', regulation.title);
    } catch (error) {
      console.error('Error fetching regulation:', error.message);
    }
    
    // Example 2: Extract requirements from regulation text
    try {
      console.log('\n---- Extracting requirements ----');
      const requirements = await client.extractRequirements({
        text: regulationText
      });
      console.log('Extracted requirements:', JSON.stringify(requirements, null, 2));
    } catch (error) {
      console.error('Error extracting requirements:', error.message);
    }
    
    // Example 3: Summarize regulation
    try {
      console.log('\n---- Summarizing regulation ----');
      const summary = await client.summarizeRegulation({
        text: regulationText
      });
      console.log('Regulation summary:', JSON.stringify(summary, null, 2));
    } catch (error) {
      console.error('Error summarizing regulation:', error.message);
    }
    
    // Example 4: Classify regulation
    try {
      console.log('\n---- Classifying regulation ----');
      const classification = await client.classifyRegulation({
        text: regulationText
      });
      console.log('Classification:', JSON.stringify(classification, null, 2));
    } catch (error) {
      console.error('Error classifying regulation:', error.message);
    }
    
    // Example 5: Detect changes
    const updatedText = regulationText.replace(
      'three business days',
      'four business days'
    );
    
    try {
      console.log('\n---- Detecting changes ----');
      const changes = await client.detectRegulationChanges({
        old_text: regulationText,
        new_text: updatedText
      });
      console.log('Detected changes:', JSON.stringify(changes, null, 2));
    } catch (error) {
      console.error('Error detecting changes:', error.message);
    }
    
  } catch (error) {
    console.error('Error in example:', error.message);
  }
}

// Run the example if this script is executed directly
if (require.main === module) {
  console.log('Starting MCP SDK example...');
  runExample().then(() => {
    console.log('\nExample completed!');
  }).catch(err => {
    console.error('Example failed:', err);
    process.exit(1);
  });
}

module.exports = { runExample };