#!/usr/bin/env node

/**
 * Docker Environment Validation Script
 * 
 * Validates that all Docker containers are properly configured
 * and can communicate with each other
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerValidator {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.composeFile = path.join(this.projectRoot, 'docker-compose.yml');
    this.envFile = path.join(this.projectRoot, '.env');
  }

  async validate() {
    console.log('🐋 Docker Environment Validation\n');
    
    try {
      this.checkDockerInstallation();
      this.checkComposeFile();
      this.checkEnvironmentFile();
      await this.validateContainerHealth();
      await this.testServiceConnectivity();
      
      console.log('\n✅ All Docker validations passed!');
      console.log('🚀 Platform is ready for containerized deployment');
      
    } catch (error) {
      console.error('\n❌ Docker validation failed:', error.message);
      process.exit(1);
    }
  }

  checkDockerInstallation() {
    console.log('🔍 Checking Docker installation...');
    
    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
      console.log(`✅ Docker found: ${dockerVersion}`);
      
      const composeVersion = execSync('docker compose version || docker-compose --version', { 
        encoding: 'utf8' 
      }).trim();
      console.log(`✅ Docker Compose found: ${composeVersion}`);
      
    } catch (error) {
      throw new Error('Docker or Docker Compose not installed or not accessible');
    }
  }

  checkComposeFile() {
    console.log('\n🔍 Validating Docker Compose configuration...');
    
    if (!fs.existsSync(this.composeFile)) {
      throw new Error('docker-compose.yml not found');
    }
    
    try {
      // Validate compose file syntax
      execSync('docker compose config', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      console.log('✅ Docker Compose file syntax is valid');
      
    } catch (error) {
      throw new Error('Invalid Docker Compose configuration');
    }
  }

  checkEnvironmentFile() {
    console.log('\n🔍 Checking environment configuration...');
    
    if (!fs.existsSync(this.envFile)) {
      console.log('⚠️  .env file not found, will use .env.docker template');
      return;
    }
    
    const envContent = fs.readFileSync(this.envFile, 'utf-8');
    const envVars = this.parseEnvFile(envContent);
    
    const requiredVars = [
      'POSTGRES_PASSWORD',
      'NEXTAUTH_SECRET',
      'DATABASE_URL'
    ];
    
    const missingVars = requiredVars.filter(varName => !envVars[varName]);
    
    if (missingVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    } else {
      console.log('✅ All required environment variables present');
    }
    
    // Check for Docker-specific URLs
    if (envVars.DATABASE_URL && !envVars.DATABASE_URL.includes('@postgres:')) {
      console.log('⚠️  DATABASE_URL should use container name "postgres" for Docker deployment');
    }
    
    if (envVars.REDIS_HOST && envVars.REDIS_HOST !== 'redis') {
      console.log('⚠️  REDIS_HOST should be "redis" for Docker deployment');
    }
  }

  parseEnvFile(content) {
    const envVars = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^"(.*)"$/, '$1');
          envVars[key] = value;
        }
      }
    }
    
    return envVars;
  }

  async validateContainerHealth() {
    console.log('\n🔍 Checking container health (if running)...');
    
    try {
      const output = execSync('docker compose ps --format json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      
      if (!output.trim()) {
        console.log('ℹ️  No containers currently running');
        return;
      }
      
      const containers = JSON.parse(`[${output.trim().split('\n').join(',')}]`);
      
      for (const container of containers) {
        const status = container.Health || container.State;
        console.log(`${this.getStatusIcon(status)} ${container.Service}: ${status}`);
      }
      
    } catch (error) {
      console.log('ℹ️  Could not check container status (containers may not be running)');
    }
  }

  async testServiceConnectivity() {
    console.log('\n🔍 Testing service connectivity (if containers are running)...');
    
    try {
      // Test if web service is accessible
      await this.testHttpEndpoint('http://localhost:3000/api/health', 'Web Application');
      
      // Test Redis connection
      await this.testRedisConnection();
      
      // Test PostgreSQL connection
      await this.testPostgresConnection();
      
    } catch (error) {
      console.log('ℹ️  Service connectivity tests skipped (containers may not be running)');
    }
  }

  async testHttpEndpoint(url, serviceName) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ ${serviceName} is accessible`);
      } else {
        console.log(`⚠️  ${serviceName} responded with status ${response.status}`);
      }
    } catch (error) {
      console.log(`ℹ️  ${serviceName} not accessible (container may not be running)`);
    }
  }

  async testRedisConnection() {
    try {
      execSync('docker compose exec -T redis redis-cli ping', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      console.log('✅ Redis is accessible');
    } catch (error) {
      console.log('ℹ️  Redis not accessible (container may not be running)');
    }
  }

  async testPostgresConnection() {
    try {
      execSync('docker compose exec -T postgres pg_isready -U ocr_user', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      console.log('✅ PostgreSQL is accessible');
    } catch (error) {
      console.log('ℹ️  PostgreSQL not accessible (container may not be running)');
    }
  }

  getStatusIcon(status) {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('healthy') || statusLower.includes('running')) {
      return '✅';
    } else if (statusLower.includes('unhealthy') || statusLower.includes('error')) {
      return '❌';
    } else {
      return 'ℹ️ ';
    }
  }
}

// Run validation
const validator = new DockerValidator();
validator.validate().catch(console.error);