import { Utils } from './utils.js';
import fs from 'fs-extra';
import path from 'path';

export class EnvironmentValidator {
  constructor() {
    this.requiredVars = {
      // Supabase Configuration (Required)
      SUPABASE_URL: {
        required: true,
        description: 'Supabase project URL',
        example: 'https://your-project-id.supabase.co',
        validation: (value) => {
          return value.startsWith('https://') && value.includes('.supabase.co');
        }
      },
      SUPABASE_ANON_KEY: {
        required: true,
        description: 'Supabase anonymous/public key',
        example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
        validation: (value) => {
          return value.length > 100 && value.startsWith('eyJ');
        }
      },
      SUPABASE_SERVICE_KEY: {
        required: false,
        description: 'Supabase service role key (for server operations)',
        example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
        validation: (value) => {
          return !value || (value.length > 100 && value.startsWith('eyJ'));
        }
      },
      
      // Processing Configuration (Optional with defaults)
      INPUT_FOLDER: {
        required: false,
        default: './1_Ticket_PDF',
        description: 'Directory containing PDF files to process',
        validation: (value) => true // Any path is valid
      },
      OUTPUT_FOLDER: {
        required: false,
        default: './3_OCR_TXT_Files',
        description: 'Directory for processed text files',
        validation: (value) => true
      },
      MAX_CONCURRENT_PROCESSES: {
        required: false,
        default: '3',
        description: 'Maximum concurrent OCR processes',
        validation: (value) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 && num <= 10;
        }
      },
      RATE_LIMIT_DELAY: {
        required: false,
        default: '2000',
        description: 'Delay between OCR requests (milliseconds)',
        validation: (value) => {
          const num = parseInt(value);
          return !isNaN(num) && num >= 1000 && num <= 10000;
        }
      },
      
      // Application Settings (Optional)
      NODE_ENV: {
        required: false,
        default: 'development',
        description: 'Application environment',
        validation: (value) => {
          return ['development', 'production', 'test'].includes(value);
        }
      },
      LOG_LEVEL: {
        required: false,
        default: 'info',
        description: 'Logging level',
        validation: (value) => {
          return ['error', 'warn', 'info', 'debug'].includes(value);
        }
      }
    };
    
    this.errors = [];
    this.warnings = [];
  }

  async validateEnvironment() {
    Utils.log('🔍 Validating environment configuration...', 'info');
    
    // Check if .env file exists
    await this.checkEnvFile();
    
    // Validate each required variable
    for (const [varName, config] of Object.entries(this.requiredVars)) {
      await this.validateVariable(varName, config);
    }
    
    // Check folder structure
    await this.validateFolders();
    
    // Display results
    this.displayResults();
    
    // Return validation status
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  async checkEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    const envExists = await fs.pathExists(envPath);
    
    if (!envExists) {
      this.errors.push({
        type: 'MISSING_ENV_FILE',
        message: '.env file not found',
        solution: 'Copy .env.example to .env and configure your settings'
      });
    }
  }

  async validateVariable(varName, config) {
    const value = process.env[varName];
    
    if (!value || value.trim() === '') {
      if (config.required) {
        this.errors.push({
          type: 'MISSING_REQUIRED_VAR',
          variable: varName,
          message: `Required environment variable ${varName} is missing`,
          description: config.description,
          example: config.example,
          solution: `Add ${varName}=${config.example} to your .env file`
        });
      } else if (config.default) {
        // Set default value
        process.env[varName] = config.default;
        this.warnings.push({
          type: 'USING_DEFAULT',
          variable: varName,
          message: `Using default value for ${varName}: ${config.default}`,
          description: config.description
        });
      }
    } else {
      // Validate the value
      if (config.validation && !config.validation(value)) {
        this.errors.push({
          type: 'INVALID_VALUE',
          variable: varName,
          message: `Invalid value for ${varName}`,
          description: config.description,
          example: config.example,
          solution: `Update ${varName} in your .env file with a valid value`
        });
      }
    }
  }

  async validateFolders() {
    const inputFolder = process.env.INPUT_FOLDER || './1_Ticket_PDF';
    const outputFolder = process.env.OUTPUT_FOLDER || './3_OCR_TXT_Files';
    
    // Check if input folder exists
    const inputExists = await fs.pathExists(inputFolder);
    if (!inputExists) {
      this.warnings.push({
        type: 'MISSING_INPUT_FOLDER',
        message: `Input folder does not exist: ${inputFolder}`,
        solution: `Create the folder: mkdir -p "${inputFolder}"`
      });
    }
    
    // Ensure output folder exists
    try {
      await fs.ensureDir(outputFolder);
    } catch (error) {
      this.errors.push({
        type: 'FOLDER_CREATION_ERROR',
        message: `Cannot create output folder: ${outputFolder}`,
        error: error.message,
        solution: 'Check file permissions and disk space'
      });
    }
    
    // Check logs folder
    const logsFolder = './logs';
    try {
      await fs.ensureDir(logsFolder);
    } catch (error) {
      this.warnings.push({
        type: 'LOGS_FOLDER_WARNING',
        message: `Cannot create logs folder: ${logsFolder}`,
        error: error.message
      });
    }
  }

  displayResults() {
    console.log(''); // Empty line for spacing
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      Utils.log('✅ Environment validation passed - all configurations are valid!', 'success');
      return;
    }
    
    // Display errors
    if (this.errors.length > 0) {
      Utils.log(`❌ Found ${this.errors.length} configuration error(s):`, 'error');
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.message}`);
        if (error.variable) {
          console.log(`   Variable: ${error.variable}`);
        }
        if (error.description) {
          console.log(`   Description: ${error.description}`);
        }
        if (error.example) {
          console.log(`   Example: ${error.example}`);
        }
        if (error.solution) {
          console.log(`   Solution: ${error.solution}`);
        }
      });
    }
    
    // Display warnings
    if (this.warnings.length > 0) {
      console.log(''); // Empty line
      Utils.log(`⚠️  Found ${this.warnings.length} configuration warning(s):`, 'warning');
      this.warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${warning.message}`);
        if (warning.variable) {
          console.log(`   Variable: ${warning.variable}`);
        }
        if (warning.description) {
          console.log(`   Description: ${warning.description}`);
        }
        if (warning.solution) {
          console.log(`   Solution: ${warning.solution}`);
        }
      });
    }
    
    // Display help information
    if (this.errors.length > 0) {
      console.log('\n📋 Quick Setup:');
      console.log('1. Copy .env.example to .env: cp .env.example .env');
      console.log('2. Edit .env file with your Supabase credentials');
      console.log('3. Get credentials from: https://supabase.com → Your Project → Settings → API');
      console.log('4. Run validation again: npm run env-check');
    }
  }

  // Generate a sample .env file
  async generateSampleEnv() {
    const envContent = Object.entries(this.requiredVars)
      .map(([varName, config]) => {
        const example = config.example || config.default || 'your-value-here';
        const description = config.description ? `# ${config.description}` : '';
        return `${description}\n${varName}=${example}`;
      })
      .join('\n\n');
    
    const header = `# Environment Configuration for Train Ticket OCR System
# Copy this file to .env and update with your actual values
# Get Supabase credentials from: https://supabase.com → Your Project → Settings → API

`;
    
    const fullContent = header + envContent;
    
    await fs.writeFile('.env.example', fullContent);
    Utils.log('✅ Generated .env.example file', 'success');
    return fullContent;
  }

  // Test Supabase connection
  async testSupabaseConnection() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase credentials');
      }
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Test connection with a simple query
      const { data, error } = await supabase
        .from('tickets')
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (acceptable)
        throw error;
      }
      
      Utils.log('✅ Supabase connection successful!', 'success');
      return true;
    } catch (error) {
      Utils.log(`❌ Supabase connection failed: ${error.message}`, 'error');
      
      if (error.message.includes('Invalid API key')) {
        Utils.log('💡 Check your SUPABASE_ANON_KEY in .env file', 'info');
      } else if (error.message.includes('Invalid URL')) {
        Utils.log('💡 Check your SUPABASE_URL in .env file', 'info');
      }
      
      return false;
    }
  }
}

// CLI usage
export async function validateEnvironment() {
  const validator = new EnvironmentValidator();
  return await validator.validateEnvironment();
}

export async function testConnection() {
  const validator = new EnvironmentValidator();
  return await validator.testSupabaseConnection();
}