/**
 * MCP SDK Example
 * 
 * This example demonstrates how to use the MCP SDK to interact with an MCP server.
 * Run the minimal-mcp-server.js first before running this example.
 * 
 * To run: node mcp-sdk-example.js
 */

// Import the MCP SDK
// Note: In a real application, you would install the SDK via npm
// and import it with: const MCPClient = require('mcp-sdk');
const MCPClient = require('./src/mcp-sdk');

// Sample regulation text
const sampleRegulationText = `
§ 1026.43 Minimum standards for transactions secured by a dwelling.

(a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, as defined in § 1026.2(a)(19), including any real property attached to a dwelling, other than:
(1) A home equity line of credit subject to § 1026.40;
(2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
(3) Reverse mortgages subject to § 1026.33.
`;

// Example function to demonstrate MCP SDK usage
async function runExample() {
  console.log("Starting MCP SDK Example...");
  
  try {
    // Initialize MCP client
    const client = new MCPClient({
      serverUrl: 'http://localhost:3000/mcp',
      timeout: 30000
    });
    
    // Initialize connection to MCP server
    const initResult = await client.initialize();
    console.log("Initialization result:", initResult);
    
    // Fetch a regulation by document number
    const regulation = await client.fetchRegulation({
      document_number: "2013-01503"
    });
    console.log("\nFetched regulation:", regulation.title);
    
    // Extract requirements from regulation text
    const requirementsResult = await client.extractRequirements({
      text: sampleRegulationText
    });
    console.log("\nExtracted requirements:", 
      requirementsResult.requirements.length, "requirements found");
    console.log(requirementsResult.requirements[0]);
    
    // Summarize the regulation
    const summary = await client.summarizeRegulation({
      text: sampleRegulationText
    });
    console.log("\nRegulation summary:", summary);
    
    // All in one - analyze regulation
    console.log("\nAnalyzing regulation...");
    const results = await Promise.all([
      client.classifyRegulation({ text: sampleRegulationText }),
      client.detectRegulationChanges({
        old_text: "§ 1026.43 Minimum standards...",
        new_text: sampleRegulationText
      })
    ]);
    
    console.log("\nClassification:", results[0]);
    console.log("\nChanges detected:", results[1].significant_changes);
    
    console.log("\nMCP SDK Example completed successfully!");
    
  } catch (error) {
    console.error("Error in MCP SDK Example:", error.message);
  }
}

// Run the example
runExample();