import { access } from 'fs/promises';
import { resolve, join } from 'path';
import { PythonDetector } from './python-detector';

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export class StartupValidator {
  static async validateEnvironment(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      info: []
    };

    console.log('🔍 Starting environment validation...\n');

    // Validate Python installation
    await this.validatePython(result);

    // Validate OCR script paths
    await this.validateOCRScripts(result);

    // Validate environment variables
    this.validateEnvironmentVariables(result);

    // Validate directories
    await this.validateDirectories(result);

    // Print summary
    this.printValidationSummary(result);

    return result;
  }

  private static async validatePython(result: ValidationResult): Promise<void> {
    try {
      const pythonInfo = await PythonDetector.validateAndLog();
      result.info.push(`Python: ${pythonInfo.command} (${pythonInfo.version})`);
    } catch (error) {
      result.success = false;
      result.errors.push(`Python validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async validateOCRScripts(result: ValidationResult): Promise<void> {
    const projectRoot = resolve(process.cwd(), '..');
    
    const scripts = [
      {
        name: 'PDF_2_PNG.py',
        envVar: 'PDF_SCRIPT_PATH',
        defaultPath: join(projectRoot, 'PDF_2_PNG.py')
      },
      {
        name: 'batch-process.js',
        envVar: 'OCR_SCRIPT_PATH',
        defaultPath: join(projectRoot, 'src', 'batch-process.js')
      }
    ];

    for (const script of scripts) {
      const scriptPath = process.env[script.envVar] 
        ? resolve(process.cwd(), process.env[script.envVar]!)
        : script.defaultPath;

      try {
        await access(scriptPath);
        result.info.push(`✅ Found ${script.name}: ${scriptPath}`);
      } catch (error) {
        result.success = false;
        result.errors.push(`❌ Missing ${script.name} at: ${scriptPath}`);
        result.errors.push(`   Set ${script.envVar} environment variable if script is in different location`);
      }
    }
  }

  private static validateEnvironmentVariables(result: ValidationResult): void {
    const requiredVars = [
      'DATABASE_URL'
    ];

    const optionalVars = [
      'REDIS_HOST',
      'REDIS_PORT'
    ];

    // Check required variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        result.success = false;
        result.errors.push(`Missing required environment variable: ${varName}`);
      } else {
        result.info.push(`✅ ${varName}: configured`);
      }
    }

    // Check optional variables
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        result.warnings.push(`Optional environment variable not set: ${varName}`);
      } else {
        result.info.push(`✅ ${varName}: configured`);
      }
    }

    // Check file size configuration
    if (process.env.MAX_FILE_SIZE) {
      const maxSize = parseInt(process.env.MAX_FILE_SIZE);
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      result.info.push(`📁 Max file size: ${maxSizeMB}MB`);
    } else {
      result.info.push(`📁 Max file size: unlimited`);
    }
  }

  private static async validateDirectories(result: ValidationResult): Promise<void> {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const logsDir = process.env.OCR_LOGS_DIR || join(resolve(process.cwd(), '..'), 'logs');

    const directories = [
      { name: 'Upload directory', path: uploadDir },
      { name: 'Logs directory', path: logsDir }
    ];

    for (const dir of directories) {
      try {
        await access(dir.path);
        result.info.push(`📁 ${dir.name}: ${dir.path}`);
      } catch (error) {
        result.warnings.push(`${dir.name} will be created: ${dir.path}`);
      }
    }
  }

  private static printValidationSummary(result: ValidationResult): void {
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('='.repeat(50));

    if (result.info.length > 0) {
      console.log('\n✅ CONFIGURED:');
      result.info.forEach(info => console.log(`   ${info}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    console.log('\n' + '='.repeat(50));
    
    if (result.success) {
      console.log('🎉 Environment validation passed! You can start the application.');
    } else {
      console.log('💥 Environment validation failed! Please fix the errors above before starting.');
      console.log('\n💡 Quick fixes:');
      console.log('   - Copy .env.example to .env.local and configure it');
      console.log('   - Ensure Python 3.8+ is installed: python3 --version');
      console.log('   - Install Python dependencies: pip3 install PyMuPDF');
      console.log('   - Check that OCR scripts exist in parent directory');
    }
    
    console.log('\n');
  }
}