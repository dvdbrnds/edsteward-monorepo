/**
 * MCP Inspector API Server
 * 
 * Simple Express server to handle inspector API requests
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const inspectorController = require('./inspector-controller');

// Create Express server
const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes

// Launch MCP Inspector
app.post('/api/inspector/launch', async (req, res) => {
  const { serverId, port: serverPort, serverType } = req.body;
  
  if (!serverId || !serverPort || !serverType) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameters'
    });
  }

  const result = await inspectorController.launchInspector(serverId, serverPort, serverType);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Check status of an inspector process
app.get('/api/inspector/status/:processId', (req, res) => {
  const { processId } = req.params;
  
  if (!processId) {
    return res.status(400).json({
      success: false,
      message: 'Missing process ID'
    });
  }

  const status = inspectorController.getInspectorStatus(processId);
  res.status(200).json(status);
});

// Get output from an inspector process
app.get('/api/inspector/output/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    
    if (!processId || !inspectorOutput.has(processId)) {
      return res.status(404).json({
        success: false,
        message: 'Inspector output not found'
      });
    }
    
    res.status(200).json({
      success: true,
      output: inspectorOutput.get(processId)
    });
    
  } catch (error) {
    console.error('Error getting inspector output:', error);
    res.status(500).json({
      success: false,
      message: `Failed to get inspector output: ${error.message}`
    });
  }
});

// Terminate an inspector process
app.delete('/api/inspector/terminate/:processId', (req, res) => {
  const { processId } = req.params;
  
  if (!processId) {
    return res.status(400).json({
      success: false,
      message: 'Missing process ID'
    });
  }

  const result = inspectorController.terminateInspector(processId);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Inspector server listening at http://localhost:${PORT}`);
}); 