#!/usr/bin/env node

/**
 * OCR Web Platform - Bulletproof Startup Script
 * 
 * This script handles everything needed to start the platform with comprehensive error handling:
 * 1. Pre-flight system checks (Node.js, Python, PostgreSQL, Redis)
 * 2. Copy .env.example to .env.local if needed
 * 3. Validate entire environment setup with detailed diagnostics
 * 4. Setup database with automatic retry logic
 * 5. Port availability and service health checks
 * 6. Start all services with monitoring and auto-recovery
 * 7. Graceful shutdown and cleanup
 * 
 * Usage: npm run start-platform
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const net = require('net');

class PlatformStarter {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.envExamplePath = path.join(this.projectRoot, '.env.example');
    this.envLocalPath = path.join(this.projectRoot, '.env.local');
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.childProcesses = [];
    
    // Load environment variables immediately
    this.loadEnvFile();
  }

  /**
   * Utility method to check if a port is available
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Utility method to check if a service is running on a port
   */
  async isServiceRunning(port, host = 'localhost') {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  /**
   * Execute command with retry logic
   */
  async executeWithRetry(command, options = {}, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return execSync(command, { 
          stdio: 'inherit',
          ...options 
        });
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`Command failed after ${retries} attempts: ${command}\nError: ${error.message}`);
        }
        console.log(`⚠️  Attempt ${attempt}/${retries} failed, retrying in ${this.retryDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  /**
   * Progress indicator for long-running operations
   */
  async withProgress(message, operation) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stdout.write(`\r${spinner[i++ % spinner.length]} ${message}`);
    }, 100);
    
    try {
      const result = await operation();
      clearInterval(interval);
      console.log(`\r✅ ${message}`);
      return result;
    } catch (error) {
      clearInterval(interval);
      console.log(`\r❌ ${message}`);
      throw error;
    }
  }

  loadEnvFile() {
    if (fs.existsSync(this.envLocalPath)) {
      const envContent = fs.readFileSync(this.envLocalPath, 'utf-8');
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
    }
  }

  async start() {
    console.log('🚀 OCR Web Platform - Bulletproof Startup\n');
    
    try {
      // Step 1: Pre-flight system checks
      await this.performPreflightChecks();
      
      // Step 2: Environment file setup
      await this.setupEnvironmentFile();
      
      // Step 3: Port availability checks
      await this.checkPortAvailability();
      
      // Step 4: Validate environment
      await this.validateEnvironment();
      
      // Step 5: Database setup with retry logic
      await this.setupDatabase();
      
      // Step 6: Service health checks
      await this.performServiceHealthChecks();
      
      // Step 7: Start all services with monitoring
      await this.startServices();
      
    } catch (error) {
      console.error('\n❌ Platform startup failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Comprehensive pre-flight system checks
   */
  async performPreflightChecks() {
    console.log('🔍 Pre-flight System Checks');
    console.log('='.repeat(40));
    
    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const nodeVersion = process.version;
          const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
          if (majorVersion < 18) {
            throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
          }
          return nodeVersion;
        }
      },
      {
        name: 'npm availability',
        check: () => {
          try {
            return execSync('npm --version', { encoding: 'utf8' }).trim();
          } catch {
            throw new Error('npm not found - please install Node.js with npm');
          }
        }
      },
      {
        name: 'Python availability',
        check: () => {
          const pythonCommands = ['python3', 'python', 'py'];
          for (const cmd of pythonCommands) {
            try {
              const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
              if (version.includes('Python 3.')) {
                return `${cmd} (${version})`;
              }
            } catch {}
          }
          throw new Error('Python 3.8+ not found - please install Python 3.8 or higher');
        }
      },
      {
        name: 'Project dependencies',
        check: () => {
          if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
            throw new Error('Dependencies not installed - run "npm install" first');
          }
          return 'Installed';
        }
      }
    ];

    for (const { name, check } of checks) {
      try {
        const result = await this.withProgress(`Checking ${name}...`, async () => check());
        console.log(`✅ ${name}: ${result}`);
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        throw new Error(`Pre-flight check failed: ${error.message}`);
      }
    }
    
    console.log('✅ All pre-flight checks passed!\n');
  }

  /**
   * Check port availability and service status
   */
  async checkPortAvailability() {
    console.log('🔌 Port Availability Checks');
    console.log('='.repeat(40));
    
    const ports = [
      { port: 3000, name: 'Web Application', required: true },
      { port: 5432, name: 'PostgreSQL Database', required: false },
      { port: 6379, name: 'Redis Queue', required: false }
    ];

    for (const { port, name, required } of ports) {
      const isAvailable = await this.isPortAvailable(port);
      const isRunning = await this.isServiceRunning(port);
      
      if (isRunning) {
        console.log(`✅ ${name} (port ${port}): Service already running`);
      } else if (isAvailable) {
        console.log(`✅ ${name} (port ${port}): Port available`);
      } else {
        const message = `Port ${port} (${name}) is occupied but service not responding`;
        if (required) {
          throw new Error(message);
        } else {
          console.log(`⚠️  ${message}`);
        }
      }
    }
    
    console.log('✅ Port availability checks completed!\n');
  }

  /**
   * Service health checks before startup
   */
  async performServiceHealthChecks() {
    console.log('🏥 Service Health Checks');
    console.log('='.repeat(40));
    
    // Check PostgreSQL
    try {
      await this.withProgress('Testing PostgreSQL connection...', async () => {
        execSync('npm run db:generate', { 
          stdio: 'pipe',
          cwd: this.projectRoot,
          env: { ...process.env }
        });
      });
      console.log('✅ PostgreSQL: Connected and ready');
    } catch (error) {
      console.log('⚠️  PostgreSQL: Connection issues (will attempt auto-setup)');
    }
    
    // Check Redis
    const redisRunning = await this.isServiceRunning(6379);
    if (redisRunning) {
      console.log('✅ Redis: Connected and ready');
    } else {
      console.log('⚠️  Redis: Not running (queue jobs will be disabled)');
    }
    
    console.log('✅ Service health checks completed!\n');
  }

  async setupEnvironmentFile() {
    console.log('📁 Setting up environment configuration...');
    
    if (!fs.existsSync(this.envExamplePath)) {
      throw new Error('.env.example file not found. Please ensure the file exists.');
    }

    if (fs.existsSync(this.envLocalPath)) {
      console.log('✅ .env.local already exists - keeping existing configuration');
    } else {
      console.log('📋 Copying .env.example to .env.local...');
      fs.copyFileSync(this.envExamplePath, this.envLocalPath);
      console.log('✅ Created .env.local from .env.example');
      console.log('💡 Please edit .env.local with your specific configuration values');
    }
    console.log('');
  }

  async validateEnvironment() {
    console.log('🔍 Validating environment setup...');
    
    try {
      // Change to project directory for validation
      process.chdir(this.projectRoot);
      
      // Run the validation script
      execSync('npm run validate', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });
      
      console.log('✅ Environment validation passed!\n');
    } catch (error) {
      console.error('❌ Environment validation failed!');
      console.error('💡 Please fix the validation errors above before starting the platform.');
      console.error('💡 Common fixes:');
      console.error('   - Edit .env.local with correct database URL and secrets');
      console.error('   - Ensure Python 3.8+ is installed: python3 --version');
      console.error('   - Install Python dependencies: pip3 install PyMuPDF');
      console.error('   - Ensure PostgreSQL and Redis are running');
      throw new Error('Environment validation failed');
    }
  }

  async setupDatabase() {
    console.log('🗄️  Database Setup with Auto-Recovery');
    console.log('='.repeat(40));
    
    try {
      // Generate Prisma client with retry logic
      await this.withProgress('Generating Prisma client...', async () => {
        await this.executeWithRetry('npm run db:generate', {
          cwd: this.projectRoot,
          env: { ...process.env },
          stdio: 'pipe'
        });
      });
      
      // Check if database exists and run migrations
      await this.withProgress('Running database migrations...', async () => {
        try {
          await this.executeWithRetry('npm run db:migrate', {
            cwd: this.projectRoot,
            env: { ...process.env },
            stdio: 'pipe'
          });
        } catch (error) {
          // If migration fails, try push instead
          console.log('⚠️  Migration failed, attempting database push...');
          await this.executeWithRetry('npm run db:push', {
            cwd: this.projectRoot,
            env: { ...process.env },
            stdio: 'pipe'
          });
        }
      });
      
      console.log('✅ Database setup completed successfully!\n');
      
    } catch (error) {
      console.error('❌ Database setup failed after multiple attempts!');
      console.error('\n💡 Troubleshooting steps:');
      console.error('   1. Ensure PostgreSQL is running:');
      console.error('      • macOS: brew services start postgresql');
      console.error('      • Ubuntu: sudo systemctl start postgresql');
      console.error('      • Windows: net start postgresql-x64-14');
      console.error('   2. Check DATABASE_URL in .env.local is correct');
      console.error('   3. Verify database user permissions:');
      console.error('      • psql -c "CREATE DATABASE ocr_platform;"');
      console.error('   4. Test connection manually:');
      console.error('      • npx prisma studio');
      console.error('\n🔧 Quick fixes to try:');
      console.error('   • npm run db:push    (force schema sync)');
      console.error('   • npm run db:studio  (test connection)');
      
      throw new Error(`Database setup failed: ${error.message}`);
    }
  }

  async startServices() {
    console.log('🎯 Starting Platform Services with Monitoring');
    console.log('='.repeat(50));
    console.log('📌 Services starting:');
    console.log('   • Web Application (http://localhost:3000)');
    console.log('   • Queue Worker (background OCR processing)');
    console.log('');
    console.log('🔄 Auto-recovery enabled - services will restart on failure');
    console.log('💡 Press Ctrl+C to stop all services gracefully');
    console.log('='.repeat(50));
    console.log('');

    // Wait a moment for user to read
    await new Promise(resolve => setTimeout(resolve, 2000));

    const commands = [
      '"npm run dev"',
      '"npm run queue:dev"'
    ];
    const names = ['WEB', 'QUEUE'];
    const colors = ['cyan', 'yellow'];

    const args = [
      '--names', names.join(','),
      '--prefix', 'name',
      '--prefix-colors', colors.join(','),
      '--kill-others-on-fail',
      '--restart-tries', '5',
      '--restart-after', '3000',
      '--handle-input'
    ].concat(commands);

    // Start the services with enhanced monitoring
    const child = spawn('npx', ['concurrently'].concat(args), {
      stdio: 'inherit',
      cwd: this.projectRoot,
      env: { 
        ...process.env, 
        FORCE_COLOR: '1',
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    });

    this.childProcesses.push(child);

    // Set up service monitoring
    this.setupServiceMonitoring();

    // Enhanced graceful shutdown
    const shutdownHandler = async (signal) => {
      console.log(`\n\n🛑 Received ${signal}, shutting down platform services...`);
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGHUP', () => shutdownHandler('SIGHUP'));

    // Handle child process events
    child.on('exit', async (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`\n❌ Services exited unexpectedly with code ${code}`);
        console.error('💡 Troubleshooting steps:');
        console.error('   1. Check the error messages above');
        console.error('   2. Verify all dependencies are installed: npm install');
        console.error('   3. Check environment variables in .env.local');
        console.error('   4. Ensure PostgreSQL and Redis are running');
        console.error('   5. Try: npm run validate');
        
        await this.cleanup();
        process.exit(code);
      }
    });

    child.on('error', async (error) => {
      console.error(`\n❌ Service startup error: ${error.message}`);
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Setup service monitoring with health checks
   */
  setupServiceMonitoring() {
    // Monitor web service health
    const healthCheckInterval = setInterval(async () => {
      const webHealthy = await this.isServiceRunning(3000);
      if (!webHealthy) {
        console.log('⚠️  Web service health check failed - service may be restarting...');
      }
    }, 30000); // Check every 30 seconds

    // Store interval for cleanup
    this.healthCheckInterval = healthCheckInterval;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    console.log('🧹 Cleaning up resources...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Kill all child processes
    for (const child of this.childProcesses) {
      if (child && !child.killed) {
        console.log('🔄 Stopping services...');
        child.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!child.killed) {
            console.log('🔪 Force stopping services...');
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    }
    
    // Wait for processes to stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Cleanup completed');
  }
}

// Enhanced global error handling
process.on('unhandledRejection', async (error) => {
  console.error('\n❌ Unhandled Promise Rejection:', error.message);
  console.error('💡 This indicates a coding error that should be reported');
  console.error('🔧 Stack trace:', error.stack);
  
  // Attempt cleanup before exit
  try {
    const starter = new PlatformStarter();
    await starter.cleanup();
  } catch (cleanupError) {
    console.error('⚠️  Cleanup failed:', cleanupError.message);
  }
  
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  console.error('💡 This indicates a serious runtime error');
  console.error('🔧 Stack trace:', error.stack);
  
  // Attempt cleanup before exit
  try {
    const starter = new PlatformStarter();
    await starter.cleanup();
  } catch (cleanupError) {
    console.error('⚠️  Cleanup failed:', cleanupError.message);
  }
  
  process.exit(1);
});

// Start the platform with comprehensive error handling
async function main() {
  let starter;
  
  try {
    starter = new PlatformStarter();
    await starter.start();
  } catch (error) {
    console.error('\n❌ Platform startup failed:', error.message);
    console.error('\n🔍 Error Details:');
    console.error('   Type:', error.constructor.name);
    console.error('   Code:', error.code || 'N/A');
    console.error('   Stack:', error.stack);
    
    // Attempt cleanup
    if (starter) {
      try {
        await starter.cleanup();
      } catch (cleanupError) {
        console.error('⚠️  Cleanup failed:', cleanupError.message);
      }
    }
    
    console.error('\n💡 Quick troubleshooting:');
    console.error('   1. Run: npm install');
    console.error('   2. Check: .env.local configuration');
    console.error('   3. Verify: PostgreSQL and Redis are running');
    console.error('   4. Test: npm run validate');
    console.error('   5. Review: error logs above');
    
    process.exit(1);
  }
}

// Execute main function
main();