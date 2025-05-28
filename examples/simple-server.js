import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Initialize express app
const app = express();
const PORT = 3010;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Sample regulations
const regulations = [];

// API Routes
app.get('/', (req, res) => {
  res.send('MCP Registry API is running!');
});

// Get all regulations
app.get('/api/regulations', (req, res) => {
  res.json(regulations);
});

// Create new regulations
app.post('/api/regulations', (req, res) => {
  try {
    console.log('Received request to add regulations');
    console.log('Request body:', req.body);
    
    const newRegulations = Array.isArray(req.body) ? req.body : [req.body];
    const added = newRegulations.length;
    
    // Add each regulation
    newRegulations.forEach(reg => {
      regulations.push({
        ...reg,
        createdAt: new Date().toISOString(),
        status: 'Pending'
      });
    });
    
    res.status(201).json({ 
      message: 'Regulations processed successfully',
      added,
      updated: 0,
      addedIds: newRegulations.map(r => r.regulationId) 
    });
  } catch (error) {
    console.error('Error processing regulations:', error);
    res.status(400).json({ error: error.message });
  }
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple registry server running on http://localhost:${PORT}`);
  console.log('Server listening on:');
  const addressInfo = server.address();
  console.log(`  - http://${addressInfo.address}:${addressInfo.port}`);
  console.log(`  - http://localhost:${addressInfo.port}`);
  console.log(`  - http://127.0.0.1:${addressInfo.port}`);
}); 