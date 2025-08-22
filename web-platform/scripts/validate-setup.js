#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * Validates the setup before starting the application
 * Run with: npm run validate
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^"(.*)"$/, '$1');
          process.env[key] = value;
        }
      }
    }
    console.log('✅ Loaded environment variables from .env.local');
  }
}

async function runValidation() {
  try {
    console.log('🔍 OCR Web Platform - Environment Validation\n');
    
    // Load environment variables first
    loadEnvFile();
    
    // Change to project directory
    process.chdir(path.join(__dirname, '..'));
    
    // Compile TypeScript and run validation
    console.log('📦 Compiling validation script...');
    execSync('npx tsx src/lib/startup-validator.ts', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
  } catch (error) {
    console.error('❌ Validation script failed:', error.message);
    process.exit(1);
  }
}

// Create a simple validation runner
const validationScript = `
import { StartupValidator } from './startup-validator';

async function main() {
  try {
    const result = await StartupValidator.validateEnvironment();
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
`;

// Write the validation runner
const runnerPath = path.join(__dirname, '..', 'src', 'lib', 'validation-runner.ts');
fs.writeFileSync(runnerPath, validationScript);

// Run the validation
try {
  execSync(`npx tsx ${runnerPath}`, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development' }
  });
} catch (error) {
  process.exit(1);
} finally {
  // Clean up the temporary runner file
  if (fs.existsSync(runnerPath)) {
    fs.unlinkSync(runnerPath);
  }
}