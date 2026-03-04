#!/usr/bin/env node

/**
 * REG-66 (FERPA Section 66) Advanced Server Entry Point
 * 
 * This is the ADVANCED LINEAR ENGINE implementation for regulation processing.
 * It serves as the template for all future regulation servers.
 * 
 * Features:
 * - Advanced LinearEngine workflow processing
 * - Real-time government data integration
 * - Differential analysis capabilities
 * - RESTful API endpoints
 * - MCP protocol integration
 * - Advanced compliance analytics
 * 
 * Run with: node src/regulations/reg-66/reg-66-server-entry.js [port]
 */

import { Reg66API } from './Reg66API.js';

const port = parseInt(process.argv[2]) || 3366;

console.log(`🚀 Starting REG-66 (FERPA Section 66) Advanced Server`);
console.log(`📋 Advanced LinearEngine Template v2.0`);
console.log(`🎯 Port: ${port}`);
console.log(`📊 Features: LinearEngine, Real-time Data, Analytics`);

// Create and start the advanced REG-66 server
const reg66Server = new Reg66API({
  port: port
});

reg66Server.start().then(() => {
  console.log(`\n🌟 REG-66 Advanced Server Started Successfully!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Server URL: http://localhost:${port}`);
  console.log(`🔌 API Base: http://localhost:${port}/api/v1/reg-66`);
  console.log(`🚀 LinearEngine: http://localhost:${port}/api/v1/reg-66/linear-engine`);
  console.log(`📊 Analytics: http://localhost:${port}/api/v1/reg-66/analytics`);
  console.log(`🏥 Health Check: http://localhost:${port}/health`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 Advanced Features: ✅ LinearEngine ✅ Real-time Data ✅ Analytics`);
  console.log(`📋 Regulation: FERPA Section 66 (Educational Records Privacy)`);
  console.log(`🏆 Template Version: Advanced 2.0 - Model for all future regulations`);
  console.log(`\n🚀 Ready to process advanced regulation workflows!`);
}).catch(error => {
  console.error('❌ Failed to start REG-66 server:', error);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  try {
    await reg66Server.stop();
    console.log('✅ REG-66 Advanced Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await reg66Server.stop();
    console.log('✅ REG-66 Advanced Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

export { reg66Server };
export default reg66Server;

