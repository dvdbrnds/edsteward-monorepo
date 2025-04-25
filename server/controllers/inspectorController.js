// Controller for MCP Inspector operations
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

// Convert exec to use promises
const execAsync = util.promisify(exec);

// Map to store active inspector processes by processId
const activeInspectors = new Map();

// Store running inspector processes
const inspectorProcesses = {};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper function to get log file path
const getLogFilePath = (serverId) => {
  return path.join(logsDir, `${serverId}-inspector.log`);
};

/**
 * Check if a port is in use
 */
async function checkPort(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      return stdout.trim().length > 0;
    } else {
      const { stdout } = await execAsync(`lsof -i:${port}`);
      return stdout.trim().length > 0;
    }
  } catch (error) {
    // If the command fails, it usually means no process is using the port
    return false;
  }
}

/**
 * Kill process running on a specific port
 */
async function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // For Windows
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      if (lines.length > 0) {
        // Extract PID from the first line (last column)
        const pid = lines[0].trim().split(/\s+/).pop();
        if (pid) {
          await execAsync(`taskkill /F /PID ${pid}`);
          return true;
        }
      }
    } else {
      // For Unix-based systems
      const { stdout } = await execAsync(`lsof -i:${port} -t`);
      const pid = stdout.trim();
      if (pid) {
        await execAsync(`kill -9 ${pid}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error killing process on port ${port}:`, error.message);
    return false;
  }
}

/**
 * Launch MCP Inspector
 */
exports.launchInspector = async (req, res) => {
  try {
    const { serverId, serverPort, serverType } = req.body;
    
    if (!serverId || !serverPort || !serverType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: serverId, serverPort, and serverType are required'
      });
    }

    // Check if port 6277 is already in use
    const portInUse = await checkPort(6277);
    if (portInUse) {
      console.log('Port 6277 is in use. Attempting to kill the process...');
      const killed = await killProcessOnPort(6277);
      if (killed) {
        console.log('Successfully killed process on port 6277');
      } else {
        console.log('Failed to kill process on port 6277');
      }
    }

    // Create a log file path with timestamp and server ID
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logFileName = `inspector-${serverId}-${timestamp}.log`;
    const logPath = path.join(logsDir, logFileName);

    console.log(`Launching MCP Inspector for server ${serverId} (${serverType}) on port ${serverPort}`);
    
    // Path to the launch script
    const scriptPath = path.join(__dirname, '../scripts/launch-inspector.js');
    
    // Launch the inspector script with environment variables
    const inspectorProcess = spawn('node', [scriptPath], {
      env: {
        ...process.env,
        MCP_SERVER_ID: serverId,
        MCP_SERVER_PORT: serverPort,
        MCP_SERVER_TYPE: serverType,
        MCP_LOG_PATH: logPath
      },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let pid = null;
    
    // Capture stdout to get the PID
    inspectorProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        // Look for a line that contains only a number (the PID)
        if (/^\d+$/.test(line.trim())) {
          pid = parseInt(line.trim(), 10);
          console.log(`Captured PID: ${pid}`);
        }
      }
      output += data.toString();
    });
    
    // Capture stderr
    inspectorProcess.stderr.on('data', (data) => {
      console.error(`Launch script error: ${data.toString().trim()}`);
      output += data.toString();
    });
    
    // Wait for the process to complete
    await new Promise((resolve, reject) => {
      inspectorProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Launch script exited with code ${code}`));
        }
      });
      
      inspectorProcess.on('error', reject);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Launch script timeout'));
      }, 5000);
    });
    
    if (!pid) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get inspector process ID',
        output
      });
    }
    
    // Store the PID for status tracking
    inspectorProcesses[pid] = {
      serverId,
      serverPort,
      serverType,
      logPath,
      startTime: new Date().toISOString()
    };
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'MCP Inspector launched successfully',
      processId: pid,
      inspectorUrl: 'http://localhost:6277',
      logPath: logPath
    });
    
  } catch (error) {
    console.error('Error launching MCP Inspector:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to launch MCP Inspector: ${error.message}`
    });
  }
};

/**
 * Get inspector status
 */
exports.getInspectorStatus = async (req, res) => {
  try {
    const { processId } = req.params;
    const pid = parseInt(processId, 10);
    
    if (!processId || isNaN(pid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid process ID'
      });
    }
    
    const processInfo = inspectorProcesses[pid];
    if (!processInfo) {
      return res.status(404).json({
        success: false,
        message: 'Inspector process not found'
      });
    }
    
    // Check if the process is still running
    let isRunning = false;
    try {
      if (process.platform === 'win32') {
        await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);
        isRunning = true;
      } else {
        await execAsync(`ps -p ${pid} -o pid=`);
        isRunning = true;
      }
    } catch (error) {
      // Process is not running
      isRunning = false;
    }
    
    return res.status(200).json({
      success: true,
      processId: pid,
      isRunning,
      serverId: processInfo.serverId,
      serverPort: processInfo.serverPort,
      serverType: processInfo.serverType,
      startTime: processInfo.startTime,
      logPath: processInfo.logPath
    });
    
  } catch (error) {
    console.error('Error getting inspector status:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to get inspector status: ${error.message}`
    });
  }
};

/**
 * Get inspector output
 */
exports.getInspectorOutput = async (req, res) => {
  try {
    const { processId } = req.params;
    const pid = parseInt(processId, 10);
    
    if (!processId || isNaN(pid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid process ID'
      });
    }
    
    const processInfo = inspectorProcesses[pid];
    if (!processInfo || !processInfo.logPath) {
      return res.status(404).json({
        success: false,
        message: 'Inspector log not found'
      });
    }
    
    // Read the log file
    if (!fs.existsSync(processInfo.logPath)) {
      return res.status(404).json({
        success: false,
        message: 'Log file not found'
      });
    }
    
    const logContent = fs.readFileSync(processInfo.logPath, 'utf8');
    
    return res.status(200).json({
      success: true,
      processId: pid,
      output: logContent
    });
    
  } catch (error) {
    console.error('Error getting inspector output:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to get inspector output: ${error.message}`
    });
  }
};

/**
 * Terminate inspector process
 */
exports.terminateInspector = async (req, res) => {
  try {
    const { processId } = req.params;
    const pid = parseInt(processId, 10);
    
    if (!processId || isNaN(pid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid process ID'
      });
    }
    
    const processInfo = inspectorProcesses[pid];
    if (!processInfo) {
      return res.status(404).json({
        success: false,
        message: 'Inspector process not found'
      });
    }
    
    // Terminate the process
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /PID ${pid}`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      
      // Remove from active processes
      delete inspectorProcesses[pid];
      
      return res.status(200).json({
        success: true,
        message: 'Inspector process terminated successfully',
        processId: pid
      });
    } catch (error) {
      // Process might already be terminated
      delete inspectorProcesses[pid];
      
      return res.status(200).json({
        success: true,
        message: 'Inspector process was already terminated',
        processId: pid
      });
    }
    
  } catch (error) {
    console.error('Error terminating inspector:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to terminate inspector: ${error.message}`
    });
  }
};

module.exports = {
  launchInspector,
  getInspectorStatus,
  getInspectorOutput,
  terminateInspector
}; 