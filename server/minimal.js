// Ultra-minimal HTTP server - no frameworks
const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🚀 MINIMAL SERVER ALIVE - ' + new Date().toISOString());
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ultra-minimal server running on port ${PORT}`);
    console.log(`Listening on 0.0.0.0:${PORT}`);
}); 