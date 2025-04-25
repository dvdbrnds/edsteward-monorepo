/**
 * MCP Inspector Controller
 * 
 * Server-side module for launching the MCP Inspector for MCP servers
 */
const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Store process outputs in memory for quick retrieval
const processOutputs = {};

class InspectorController {
    constructor() {
        this.activeProcesses = new Map();
    }

    async launchInspector(serverId, port, serverType) {
        try {
            const scriptPath = path.resolve(process.cwd(), 'launch-inspector.js');
            
            const process = spawn('node', [
                scriptPath,
                serverId,
                port.toString(),
                serverType
            ], {
                stdio: 'inherit',
                shell: true
            });

            this.activeProcesses.set(serverId, process);

            // Return success response
            return {
                success: true,
                processId: process.pid,
                message: `Inspector launched for ${serverType} on port ${port}`
            };

        } catch (error) {
            console.error('Error launching inspector:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getInspectorStatus(processId) {
        // Convert processId to number since it comes as string from request params
        processId = Number(processId);
        
        // Check if process exists
        let isRunning = false;
        try {
            process.kill(processId, 0);
            isRunning = true;
        } catch (error) {
            isRunning = false;
        }

        return {
            isRunning,
            processId
        };
    }

    terminateInspector(processId) {
        try {
            process.kill(Number(processId));
            return { success: true, message: 'Inspector terminated successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = new InspectorController();

/**
 * Get the console output for a specific MCP Inspector process
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getInspectorOutput = (req, res) => {
  const { serverId } = req.params;
  
  if (!serverId) {
    return res.status(400).json({
      success: false,
      message: 'Missing server ID'
    });
  }
  
  try {
    // Get the output for the server
    const output = processOutputs[serverId];
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: `No output found for server ${serverId}`
      });
    }
    
    return res.status(200).json({
      success: true,
      serverId,
      output: output.combined,
      lastUpdated: output.lastUpdated
    });
  } catch (error) {
    console.error(`Error getting MCP Inspector output for server ${serverId}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to get MCP Inspector output: ${error.message}`,
      error: error.message
    });
  }
};

/**
 * Check if a process is running
 * 
 * @param {number} pid - Process ID to check
 * @returns {boolean} True if process is running, false otherwise
 */
function checkIfProcessIsRunning(pid) {
  try {
    // Use process.kill with signal 0 to check if process exists
    // This doesn't actually kill the process
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // If error.code is 'ESRCH', the process doesn't exist
    return error.code !== 'ESRCH';
  }
}