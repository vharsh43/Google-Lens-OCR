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

  static async generateMergedOCRFiles(outputDir) {
    if (!config.output.generateMergedFiles) {
      this.log('Merged file generation is disabled', 'info');
      return;
    }

    this.log('Starting merged OCR file generation...', 'info');
    
    try {
      // Get all directories that contain .txt files
      const directories = await this.getDirectoriesWithTxtFiles(outputDir);
      
      let mergedCount = 0;
      
      for (const directory of directories) {
        const mergedFilePath = await this.createMergedFileForDirectory(directory);
        if (mergedFilePath) {
          mergedCount++;
          this.log(`Created merged file: ${path.relative(outputDir, mergedFilePath)}`, 'success');
        }
      }
      
      this.log(`Successfully generated ${mergedCount} merged OCR file(s)`, 'success');
      
    } catch (error) {
      this.log(`Error generating merged OCR files: ${error.message}`, 'error');
      throw error;
    }
  }

  static async getDirectoriesWithTxtFiles(outputDir, directories = []) {
    try {
      if (!await fs.pathExists(outputDir)) {
        return directories;
      }

      const items = await fs.readdir(outputDir);
      let hasTextFiles = false;
      
      // Check if current directory has .txt files
      for (const item of items) {
        const itemPath = path.join(outputDir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile() && path.extname(item).toLowerCase() === '.txt') {
          // Skip files that already have the merged suffix
          if (!item.includes(config.output.mergedFileSuffix)) {
            hasTextFiles = true;
          }
        }
      }
      
      // If current directory has text files, add it to the list
      if (hasTextFiles) {
        directories.push(outputDir);
      }
      
      // Recursively check subdirectories
      for (const item of items) {
        const itemPath = path.join(outputDir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await this.getDirectoriesWithTxtFiles(itemPath, directories);
        }
      }
      
      return directories;
      
    } catch (error) {
      this.log(`Error scanning directory ${outputDir}: ${error.message}`, 'error');
      return directories;
    }
  }

  static async createMergedFileForDirectory(directory) {
    try {
      // Get all .txt files in the directory (excluding already merged files)
      const txtFiles = await this.getTxtFilesInDirectory(directory);
      
      if (txtFiles.length === 0) {
        return null;
      }
      
      // Sort files alphabetically for consistent ordering
      txtFiles.sort();
      
      // Generate merged filename
      const directoryName = path.basename(directory);
      const mergedFileName = `${directoryName}${config.output.mergedFileSuffix}.txt`;
      const mergedFilePath = path.join(directory, mergedFileName);
      
      // Create merged content - just the text with no extra formatting
      let mergedContent = '';
      
      for (let i = 0; i < txtFiles.length; i++) {
        const txtFile = txtFiles[i];
        
        try {
          const fileContent = await fs.readFile(txtFile, config.output.encoding);
          const trimmedContent = fileContent.trim();
          
          if (trimmedContent) {
            mergedContent += trimmedContent;
            
            // Add newline between files (except for the last one)
            if (i < txtFiles.length - 1) {
              mergedContent += '\n\n';
            }
          }
        } catch (error) {
          // Skip files that can't be read, don't add error messages
          this.log(`Warning: Could not read file ${txtFile}: ${error.message}`, 'warning');
        }
      }
      
      // Write merged file
      await fs.writeFile(mergedFilePath, mergedContent, config.output.encoding);
      
      return mergedFilePath;
      
    } catch (error) {
      this.log(`Error creating merged file for ${directory}: ${error.message}`, 'error');
      return null;
    }
  }

  static async getTxtFilesInDirectory(directory) {
    try {
      const items = await fs.readdir(directory);
      const txtFiles = [];
      
      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile() && 
            path.extname(item).toLowerCase() === '.txt' &&
            !item.includes(config.output.mergedFileSuffix)) {
          txtFiles.push(itemPath);
        }
      }
      
      return txtFiles;
      
    } catch (error) {
      this.log(`Error reading directory ${directory}: ${error.message}`, 'error');
      return [];
    }
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