/**
 * Sample script demonstrating how to use the MCP client directly
 */

// Import necessary modules
const fetch = require('node-fetch');

// MCP client class
class MCPClient {
  constructor(serverUrl = 'http://localhost:3000/mcp') {
    this.serverUrl = serverUrl;
  }

  // Base method to make MCP function calls
  async call(functionName, parameters = {}) {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: functionName,
          parameters
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`MCP call failed: ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error calling MCP function '${functionName}':`, error);
      throw error;
    }
  }

  // Initialize connection to MCP server
  async initialize() {
    return this.call('initialize');
  }

  // Fetch regulation by document number
  async fetchRegulation(documentNumber) {
    return this.call('fetchRegulation', { document_number: documentNumber });
  }

  // Extract requirements from regulation text
  async extractRequirements(text) {
    return this.call('extractRequirements', { text });
  }

  // Summarize regulation text
  async summarizeRegulation(text) {
    return this.call('summarizeRegulation', { text });
  }

  // Detect changes between two versions of regulation text
  async detectRegulationChanges(oldText, newText) {
    return this.call('detectRegulationChanges', { old_text: oldText, new_text: newText });
  }

  // Classify regulation by topic, industry, risk, etc.
  async classifyRegulation(text) {
    return this.call('classifyRegulation', { text });
  }
}

// Sample regulation text for demonstration
const sampleRegulationText = `
§ 1026.43 Minimum standards for transactions secured by a dwelling.
(a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, as defined in § 1026.2(a)(19), including any real property attached to a dwelling, other than:
(1) A home equity line of credit subject to § 1026.40;
(2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
(3) For purposes of paragraphs (c) through (f) of this section:
(i) A reverse mortgage subject to § 1026.33;
(ii) A temporary or "bridge" loan with a term of 12 months or less, such as a loan to finance the purchase of a new dwelling where the consumer plans to sell a current dwelling within 12 months or a loan to finance the initial construction of a dwelling;
(iii) A construction phase of 12 months or less of a construction-to-permanent loan;
(iv) An extension of credit made pursuant to a program administered by a Housing Finance Agency, as defined under 24 CFR 266.5;
(v) An extension of credit made by:
(A) A creditor designated as a Community Development Financial Institution, as defined under 12 CFR 1805.104(h);
(B) A creditor designated as a Downpayment Assistance through Secondary Financing Provider, pursuant to 24 CFR 200.194(a), operating in accordance with regulations prescribed by the U.S. Department of Housing and Urban Development applicable to such persons;
(C) A creditor designated as a Community Housing Development Organization provided that the creditor has entered into a commitment with a participating jurisdiction and is undertaking a project under the HOME program, pursuant to the provisions of 24 CFR 92.300(a), and as the terms community housing development organization, commitment, participating jurisdiction, and project are defined under 24 CFR 92.2;
`;

// Updated version for change detection demo
const updatedRegulationText = `
§ 1026.43 Minimum standards for transactions secured by a dwelling.
(a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, as defined in § 1026.2(a)(19), including any real property attached to a dwelling, other than:
(1) A home equity line of credit subject to § 1026.40;
(2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
(3) For purposes of paragraphs (c) through (f) of this section:
(i) A reverse mortgage subject to § 1026.33;
(ii) A temporary or "bridge" loan with a term of 6 months or less, such as a loan to finance the purchase of a new dwelling where the consumer plans to sell a current dwelling within 6 months or a loan to finance the initial construction of a dwelling;
(iii) A construction phase of 12 months or less of a construction-to-permanent loan;
(iv) An extension of credit made pursuant to a program administered by a Housing Finance Agency, as defined under 24 CFR 266.5;
(v) An extension of credit made by:
(A) A creditor designated as a Community Development Financial Institution, as defined under 12 CFR 1805.104(h);
(B) A creditor designated as a Downpayment Assistance through Secondary Financing Provider, pursuant to 24 CFR 200.194(a), operating in accordance with regulations prescribed by the U.S. Department of Housing and Urban Development applicable to such persons;
(C) A creditor designated as a Community Housing Development Organization provided that the creditor has entered into a commitment with a participating jurisdiction and is undertaking a project under the HOME program, pursuant to the provisions of 24 CFR 92.300(a), and as the terms community housing development organization, commitment, participating jurisdiction, and project are defined under 24 CFR 92.2;
(D) A creditor with a tax exemption ruling or determination letter from the Internal Revenue Service under section 501(c)(3) of the Internal Revenue Code of 1986 (26 U.S.C. 501(c)(3); 26 CFR 1.501(c)(3)-1), provided that:
`;

// Example function demonstrating usage of the MCP client
async function runExample() {
  console.log("Starting MCP client example...");
  
  const client = new MCPClient();
  
  try {
    // Initialize connection
    console.log("Initializing MCP client...");
    const initResult = await client.initialize();
    console.log("Initialization result:", initResult);
    
    // Fetch regulation
    console.log("\nFetching regulation...");
    try {
      const regulation = await client.fetchRegulation("2021-14671");
      console.log("Regulation:", regulation);
    } catch (error) {
      console.log("Error fetching regulation:", error.message);
    }
    
    // Extract requirements
    console.log("\nExtracting requirements...");
    try {
      const requirements = await client.extractRequirements(sampleRegulationText);
      console.log("Requirements:", JSON.stringify(requirements, null, 2));
    } catch (error) {
      console.log("Error extracting requirements:", error.message);
    }
    
    // Summarize regulation
    console.log("\nSummarizing regulation...");
    try {
      const summary = await client.summarizeRegulation(sampleRegulationText);
      console.log("Summary:", JSON.stringify(summary, null, 2));
    } catch (error) {
      console.log("Error summarizing regulation:", error.message);
    }
    
    // Classify regulation
    console.log("\nClassifying regulation...");
    try {
      const classification = await client.classifyRegulation(sampleRegulationText);
      console.log("Classification:", JSON.stringify(classification, null, 2));
    } catch (error) {
      console.log("Error classifying regulation:", error.message);
    }
    
    // Detect regulation changes
    console.log("\nDetecting regulation changes...");
    try {
      const changes = await client.detectRegulationChanges(
        sampleRegulationText,
        updatedRegulationText
      );
      console.log("Changes detected:", JSON.stringify(changes, null, 2));
    } catch (error) {
      console.log("Error detecting changes:", error.message);
    }
    
  } catch (error) {
    console.error("Example failed:", error);
  }
  
  console.log("\nMCP client example completed!");
}

// Run the example if this script is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

// Export the client for use in other modules
module.exports = { MCPClient };