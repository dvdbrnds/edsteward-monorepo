#!/usr/bin/env node

/**
 * Simple CORS proxy for the registry API
 */

import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Configure ports
const PROXY_PORT = 8080;
const REGISTRY_PORT = 3010;

// Create Express server
const app = express();

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Setup proxy to registry
const apiProxy = createProxyMiddleware({
  target: `http://localhost:${REGISTRY_PORT}`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyRes: (proxyRes) => {
    // Add CORS headers to every response
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  },
  logLevel: 'debug'
});

// Mount the proxy middleware
app.use('/api', apiProxy);

// Add a root route for testing
app.get('/', (req, res) => {
  res.send(`
    <h1>Registry API CORS Proxy</h1>
    <p>This is a proxy server that adds CORS headers to the registry API.</p>
    <p>The registry API is available at <a href="/api/regulations">/api/regulations</a>.</p>
  `);
});

// Start the server
app.listen(PROXY_PORT, () => {
  console.log(`CORS proxy server running on http://localhost:${PROXY_PORT}`);
  console.log(`Proxying requests to http://localhost:${REGISTRY_PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nStopping CORS proxy server...');
  process.exit(0);
}); 