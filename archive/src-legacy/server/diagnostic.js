// Minimal diagnostic server
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚀 EdSteward Diagnostic Server - ALIVE!');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Diagnostic server is running'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Diagnostic server running on port ${PORT}`);
}); 