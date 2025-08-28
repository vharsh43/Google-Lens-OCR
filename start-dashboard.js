#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting PDF OCR Dashboard...\n');

// Start the backend server
console.log('📡 Starting backend server...');
const serverProcess = spawn('npm', ['start'], {
  cwd: path.join(__dirname, 'server'),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: process.platform === 'win32'
});

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Server running')) {
    console.log('✅ Backend server started');
    startFrontend();
  }
  process.stdout.write(`[SERVER] ${output}`);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(`[SERVER ERROR] ${data}`);
});

// Start the frontend after a delay
function startFrontend() {
  setTimeout(() => {
    console.log('🎨 Starting frontend dashboard...');
    const frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'dashboard'),
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:')) {
        console.log('✅ Dashboard started at http://localhost:3333');
      }
      process.stdout.write(`[DASHBOARD] ${output}`);
    });

    frontendProcess.stderr.on('data', (data) => {
      process.stderr.write(`[DASHBOARD ERROR] ${data}`);
    });
  }, 2000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down dashboard...');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down dashboard...');
  process.exit();
});