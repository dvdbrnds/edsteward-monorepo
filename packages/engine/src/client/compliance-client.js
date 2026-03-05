import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComplianceClient {
  constructor(baseUrl = 'http://localhost:3100') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async checkStatus() {
    try {
      const response = await this.client.get('/api/status');
      return response.data;
    } catch (error) {
      console.error('Error checking server status:', error.message);
      throw error;
    }
  }

  async getRegulations() {
    try {
      const response = await this.client.get('/api/regulations');
      return response.data;
    } catch (error) {
      console.error('Error fetching regulations:', error.message);
      throw error;
    }
  }

  async getRegulationsByCategory(category) {
    try {
      const response = await this.client.get(`/api/regulations/category/${category}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching regulations for category ${category}:`, error.message);
      throw error;
    }
  }

  async validateCompliance(text, regulationIds = null) {
    try {
      const response = await this.client.post('/api/validate', {
        text,
        regulationIds
      });
      return response.data;
    } catch (error) {
      console.error('Error validating compliance:', error.message);
      throw error;
    }
  }

  async detectChanges(previousText, currentText, categories = null) {
    try {
      const response = await this.client.post('/api/detect-changes', {
        previousText,
        currentText,
        categories
      });
      return response.data;
    } catch (error) {
      console.error('Error detecting changes:', error.message);
      throw error;
    }
  }

  // Utility to read a text file
  async readTextFile(filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      throw error;
    }
  }

  // Save results to a file
  async saveResults(results, outputPath) {
    try {
      const fullPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
      await fs.writeFile(fullPath, JSON.stringify(results, null, 2), 'utf8');
      console.log(`Results saved to ${fullPath}`);
    } catch (error) {
      console.error(`Error saving results to ${outputPath}:`, error.message);
      throw error;
    }
  }
}

// Interactive CLI mode
async function startInteractiveMode() {
  const client = new ComplianceClient();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('========================================');
  console.log('  Compliance Verification Client (CLI)  ');
  console.log('========================================');

  try {
    // Check if server is running
    const status = await client.checkStatus();
    console.log(`Server status: ${status.status} (version: ${status.version})`);
  } catch (error) {
    console.error('Server not available. Make sure the LLM Gateway Service is running.');
    rl.close();
    return;
  }

  const promptUser = () => {
    console.log('\nAvailable commands:');
    console.log('1. status - Check server status');
    console.log('2. regulations - List all regulations');
    console.log('3. category <name> - List regulations by category');
    console.log('4. validate <file> [reg1,reg2,...] - Validate file against regulations');
    console.log('5. changes <old-file> <new-file> [cat1,cat2,...] - Detect compliance changes');
    console.log('6. exit - Exit the client');
    
    rl.question('\nEnter command: ', async (input) => {
      const [command, ...args] = input.trim().split(' ');
      
      try {
        switch (command.toLowerCase()) {
          case 'status':
            const status = await client.checkStatus();
            console.log(status);
            break;
            
          case 'regulations':
            const regs = await client.getRegulations();
            console.log(`Total regulations: ${regs.count}`);
            regs.regulations.forEach(reg => {
              console.log(`- ${reg.id}: ${reg.name} (${reg.category})`);
            });
            break;
            
          case 'category':
            if (!args[0]) {
              console.log('Error: Category name required');
              break;
            }
            const catRegs = await client.getRegulationsByCategory(args[0]);
            console.log(`Regulations in category "${args[0]}": ${catRegs.count}`);
            catRegs.regulations.forEach(reg => {
              console.log(`- ${reg.id}: ${reg.name}`);
            });
            break;
            
          case 'validate':
            if (!args[0]) {
              console.log('Error: File path required');
              break;
            }
            const filePath = args[0];
            const regIds = args[1] ? args[1].split(',').map(id => parseInt(id.trim(), 10)) : null;
            
            try {
              const fileContent = await client.readTextFile(filePath);
              console.log(`Validating file: ${filePath}`);
              
              const validationResults = await client.validateCompliance(fileContent, regIds);
              console.log(`Validation completed at ${validationResults.timestamp}`);
              
              const compliantCount = validationResults.results.filter(r => r.compliant).length;
              const nonCompliantCount = validationResults.results.length - compliantCount;
              
              console.log(`Results: ${compliantCount} compliant, ${nonCompliantCount} non-compliant`);
              
              validationResults.results.filter(r => !r.compliant).forEach(result => {
                console.log(`\n⚠️ Issue with ${result.name} (${result.category}):`);
                result.issues.forEach(issue => console.log(`  - ${issue}`));
              });
              
              // Ask if user wants to save results
              rl.question('\nSave results to file? (y/n): ', async (answer) => {
                if (answer.toLowerCase() === 'y') {
                  const outputPath = `${path.basename(filePath, path.extname(filePath))}_validation_results.json`;
                  await client.saveResults(validationResults, outputPath);
                }
                
                promptUser();
              });
              return;
            } catch (err) {
              console.error(`Error validating file: ${err.message}`);
            }
            break;
            
          case 'changes':
            if (!args[0] || !args[1]) {
              console.log('Error: Both old and new file paths required');
              break;
            }
            const oldFilePath = args[0];
            const newFilePath = args[1];
            const categories = args[2] ? args[2].split(',') : null;
            
            try {
              const oldContent = await client.readTextFile(oldFilePath);
              const newContent = await client.readTextFile(newFilePath);
              
              console.log(`Detecting compliance changes between:`);
              console.log(`- Old: ${oldFilePath}`);
              console.log(`- New: ${newFilePath}`);
              
              const changeResults = await client.detectChanges(oldContent, newContent, categories);
              
              console.log(`\nChange detection completed at ${changeResults.timestamp}`);
              console.log(`Changes detected: ${changeResults.changesDetected ? 'YES' : 'NO'}`);
              
              changeResults.results.forEach(result => {
                console.log(`\n🔍 Changes in ${result.name} (${result.category}):`);
                console.log(`  - ${result.details}`);
                console.log(`  - Confidence: ${Math.round(result.confidence * 100)}%`);
              });
              
              // Ask if user wants to save results
              rl.question('\nSave results to file? (y/n): ', async (answer) => {
                if (answer.toLowerCase() === 'y') {
                  const outputPath = `change_detection_results.json`;
                  await client.saveResults(changeResults, outputPath);
                }
                
                promptUser();
              });
              return;
            } catch (err) {
              console.error(`Error detecting changes: ${err.message}`);
            }
            break;
            
          case 'exit':
            console.log('Exiting client...');
            rl.close();
            return;
            
          default:
            console.log('Unknown command. Try again.');
        }
      } catch (error) {
        console.error('Error executing command:', error.message);
      }
      
      promptUser();
    });
  };

  promptUser();
}

// Run the interactive client if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startInteractiveMode().catch(error => {
    console.error('Client error:', error);
    process.exit(1);
  });
}

// Export the client class for programmatic use
export default ComplianceClient; 