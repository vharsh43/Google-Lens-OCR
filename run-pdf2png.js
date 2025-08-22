#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';

// Detect the correct Python command
async function detectPythonCommand() {
  const pythonCommands = ['python3', 'python'];
  
  for (const cmd of pythonCommands) {
    try {
      await new Promise((resolve, reject) => {
        const pythonCheck = spawn(cmd, ['--version'], { stdio: 'pipe' });
        
        pythonCheck.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`${cmd} not found`));
          }
        });
        
        pythonCheck.on('error', () => {
          reject(new Error(`${cmd} not found in PATH`));
        });
      });
      return cmd;
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Python is required but not found. Please install Python 3.6+');
}

// Run the PDF to PNG conversion
async function runPdf2Png() {
  try {
    const pythonCmd = await detectPythonCommand();
    console.log(`Using Python command: ${pythonCmd}`);
    
    const pythonProcess = spawn(pythonCmd, ['PDF_2_PNG.py'], {
      stdio: 'inherit'
    });
    
    pythonProcess.on('close', (code) => {
      process.exit(code);
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Failed to start PDF conversion:', error.message);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runPdf2Png();