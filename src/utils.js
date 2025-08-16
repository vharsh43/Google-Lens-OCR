import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { config } from './config.js';

export class Utils {
  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to create directory ${dirPath}:`, error.message));
      return false;
    }
  }

  static getRelativePath(fullPath, basePath) {
    return path.relative(basePath, fullPath);
  }

  static mapInputToOutputPath(inputPath, inputDir, outputDir) {
    const relativePath = this.getRelativePath(inputPath, inputDir);
    const parsedPath = path.parse(relativePath);
    const outputFileName = parsedPath.name + config.output.textExtension;
    return path.join(outputDir, parsedPath.dir, outputFileName);
  }

  static async findImageFiles(inputDir) {
    try {
      // Windows path normalization
      const normalizedInputDir = path.resolve(inputDir);
      console.log(chalk.gray(`[DEBUG] Normalized input directory: ${normalizedInputDir}`));
      
      const patterns = config.supportedExtensions.map(ext => 
        path.join(normalizedInputDir, '**', `*${ext}`).replace(/\\/g, '/')
      );
      
      console.log(chalk.gray(`[DEBUG] Search patterns:`));
      patterns.forEach(pattern => console.log(chalk.gray(`  - ${pattern}`)));
      
      const files = [];
      for (const pattern of patterns) {
        console.log(chalk.gray(`[DEBUG] Searching pattern: ${pattern}`));
        const matches = await glob(pattern, { 
          nocase: true,
          windowsPathsNoEscape: true  // Windows-specific option
        });
        console.log(chalk.gray(`[DEBUG] Found ${matches.length} matches for pattern ${pattern}`));
        if (matches.length > 0) {
          console.log(chalk.gray(`[DEBUG] Matches:`));
          matches.forEach(match => console.log(chalk.gray(`    - ${match}`)));
        }
        files.push(...matches);
      }
      
      const uniqueFiles = [...new Set(files)].sort();
      console.log(chalk.gray(`[DEBUG] Total unique files found: ${uniqueFiles.length}`));
      
      return uniqueFiles;
    } catch (error) {
      console.error(chalk.red('Failed to find image files:', error.message));
      console.error(chalk.red('Error details:', error));
      return [];
    }
  }

  static async logError(filePath, error) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${filePath}: ${error.message}\n`;
    
    try {
      await fs.appendFile(config.logging.errorLogFile, logEntry);
    } catch (logError) {
      console.error(chalk.red('Failed to write to error log:', logError.message));
    }
  }

  static formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  static async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        formattedSize: this.formatFileSize(stats.size),
        modified: stats.mtime,
        exists: true
      };
    } catch (error) {
      return {
        size: 0,
        formattedSize: '0 Bytes',
        modified: null,
        exists: false
      };
    }
  }

  static log(message, level = 'info') {
    if (config.logging.verbosity === 0) return;
    
    const timestamp = new Date().toTimeString().split(' ')[0];
    
    switch (level) {
      case 'success':
        console.log(chalk.green(`[${timestamp}] ✓ ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`[${timestamp}] ✗ ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`[${timestamp}] ⚠ ${message}`));
        break;
      case 'info':
        console.log(chalk.blue(`[${timestamp}] ℹ ${message}`));
        break;
      case 'verbose':
        if (config.logging.verbosity >= 2) {
          console.log(chalk.gray(`[${timestamp}] ${message}`));
        }
        break;
      default:
        console.log(`[${timestamp}] ${message}`);
    }
  }

  static createProgressBar(total) {
    let current = 0;
    
    return {
      update: (increment = 1) => {
        current += increment;
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * 30);
        const empty = 30 - filled;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const progress = chalk.cyan(`[${bar}] ${percentage}% (${current}/${total})`);
        
        process.stdout.write(`\r${progress}`);
        
        if (current >= total) {
          process.stdout.write('\n');
        }
      },
      
      complete: () => {
        current = total;
        const bar = '█'.repeat(30);
        const progress = chalk.green(`[${bar}] 100% (${total}/${total})`);
        process.stdout.write(`\r${progress}\n`);
      }
    };
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').trim();
  }
}

export class ProcessingQueue {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.queue = [];
    this.running = [];
    this.completed = [];
    this.failed = [];
  }

  add(task) {
    this.queue.push(task);
  }

  async process() {
    while (this.queue.length > 0 || this.running.length > 0) {
      while (this.running.length < this.maxConcurrency && this.queue.length > 0) {
        const task = this.queue.shift();
        this.running.push(this.processTask(task));
      }

      if (this.running.length > 0) {
        const result = await Promise.race(this.running);
        const index = this.running.findIndex(p => p === result);
        this.running.splice(index, 1);
      }
    }

    return {
      total: this.completed.length + this.failed.length,
      completed: this.completed.length,
      failed: this.failed.length,
      failedTasks: this.failed
    };
  }

  async processTask(task) {
    try {
      const result = await task.execute();
      this.completed.push({ task, result });
      return this;
    } catch (error) {
      this.failed.push({ task, error });
      return this;
    }
  }
}