#!/usr/bin/env node

/**
 * Resilient MCP Engine Startup - Simple 24/7 Operation
 * Automatically restarts services if they crash
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ResilientStarter {
  constructor() {
    this.mcpProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 50; // Allow many restarts for 24/7 operation
    this.restartDelay = 3000; // 3 seconds between restarts
    this.isShuttingDown = false;
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    
    console.log('🚀 Starting Resilient MCP Engine');
    console.log(`📅 Start Time: ${new Date().toISOString()}`);
    console.log(`🔄 Max Restarts: ${this.maxRestarts}`);
    console.log(`⏱️  Restart Delay: ${this.restartDelay / 1000}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  async start() {
    this.startMCPEngine();
  }

  startMCPEngine() {
    if (this.isShuttingDown) return;

    console.log(`🔄 Starting MCP Engine (attempt ${this.restartCount + 1})`);
    
    // Start the main MCP process using npm start
    this.mcpProcess = spawn('npm', ['start'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: process.env
    });

    // Handle stdout
    this.mcpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
    });

    // Handle stderr
    this.mcpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);
    });

    // Handle process exit
    this.mcpProcess.on('exit', (code, signal) => {
      console.log(`\n🚨 MCP Engine process exited with code ${code}, signal ${signal}`);
      
      if (!this.isShuttingDown) {
        if (this.restartCount < this.maxRestarts) {
          this.restartCount++;
          console.log(`⏳ Waiting ${this.restartDelay / 1000}s before restart...`);
          
          setTimeout(() => {
            console.log(`🔄 Restarting MCP Engine (${this.restartCount}/${this.maxRestarts})`);
            this.startMCPEngine();
          }, this.restartDelay);
        } else {
          console.error(`❌ Max restarts (${this.maxRestarts}) reached. Giving up.`);
          process.exit(1);
        }
      }
    });

    // Handle process errors
    this.mcpProcess.on('error', (error) => {
      console.error('🚨 Failed to start MCP Engine process:', error);
      
      if (!this.isShuttingDown && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        setTimeout(() => {
          this.startMCPEngine();
        }, this.restartDelay);
      }
    });

    console.log(`✅ MCP Engine started with PID ${this.mcpProcess.pid}`);
  }

  async gracefulShutdown() {
    if (this.isShuttingDown) return;
    
    console.log('\n🛑 Graceful shutdown initiated...');
    this.isShuttingDown = true;

    if (this.mcpProcess && !this.mcpProcess.killed) {
      console.log('⏹️ Stopping MCP Engine...');
      
      // Send SIGTERM for graceful shutdown
      this.mcpProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      setTimeout(() => {
        if (!this.mcpProcess.killed) {
          console.log('⚡ Force killing MCP Engine...');
          this.mcpProcess.kill('SIGKILL');
        }
      }, 5000);
    }

    console.log(`📊 Final Statistics:`);
    console.log(`   Total Restarts: ${this.restartCount}`);
    console.log('✅ Shutdown complete');
    
    setTimeout(() => process.exit(0), 1000);
  }
}

// Start the resilient manager
const starter = new ResilientStarter();
starter.start().catch(error => {
  console.error('🚨 Failed to start Resilient MCP Engine:', error);
  process.exit(1);
});