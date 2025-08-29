#!/usr/bin/env node

import chalk from 'chalk';
import { config } from './config.js';
import { Utils } from './utils.js';

class TxtFileMerger {
  constructor() {
    this.config = config;
    this.Utils = Utils;
    this.startTime = Date.now();
  }

  async run() {
    try {
      console.log(chalk.cyan.bold('\n📋 TXT File Merger v1.0.0\n'));
      
      const targetDir = process.argv[2] || this.config.outputDir;
      console.log(chalk.blue(`🔍 Scanning directory: ${targetDir}`));
      
      if (targetDir !== this.config.outputDir) {
        console.log(chalk.yellow('Using custom directory instead of default output directory'));
      }

      await this.mergeFiles(targetDir);
      
    } catch (error) {
      console.error(chalk.red('❌ Fatal error in run():', error.message));
      process.exit(1);
    }
  }

  async mergeFiles(targetDir) {
    try {
      console.log(chalk.cyan('🔄 Starting txt file merging process...'));
      
      // Force merge regardless of config setting
      await this.forceMergeOCRFiles(targetDir);
      
      const duration = (Date.now() - this.startTime) / 1000;
      console.log(chalk.green(`\n✅ Merging completed in ${Math.round(duration * 100) / 100}s`));
      
      // Show summary
      await this.printSummary(targetDir);
      
    } catch (error) {
      this.Utils.log(`Error during merge process: ${error.message}`, 'error');
      throw error;
    }
  }

  async forceMergeOCRFiles(outputDir) {
    this.Utils.log('Starting forced merged OCR file generation...', 'info');
    
    try {
      // Get all directories that contain .txt files
      const directories = await this.getDirectoriesWithTxtFiles(outputDir);
      
      let mergedCount = 0;
      
      for (const directory of directories) {
        const mergedFilePath = await this.createMergedFileForDirectory(directory);
        if (mergedFilePath) {
          mergedCount++;
          const fs = (await import('fs-extra')).default;
          const path = (await import('path')).default;
          this.Utils.log(`Created merged file: ${path.relative(outputDir, mergedFilePath)}`, 'success');
        }
      }
      
      this.Utils.log(`Successfully generated ${mergedCount} merged OCR file(s)`, 'success');
      
    } catch (error) {
      this.Utils.log(`Error generating merged OCR files: ${error.message}`, 'error');
      throw error;
    }
  }

  async getDirectoriesWithTxtFiles(outputDir, directories = []) {
    try {
      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      
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
          if (!item.includes(this.config.output.mergedFileSuffix)) {
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
      this.Utils.log(`Error scanning directory ${outputDir}: ${error.message}`, 'error');
      return directories;
    }
  }

  async createMergedFileForDirectory(directory) {
    try {
      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      
      // Get all .txt files in the directory (excluding already merged files)
      const txtFiles = await this.getTxtFilesInDirectory(directory);
      
      if (txtFiles.length === 0) {
        return null;
      }
      
      // Sort files alphabetically for consistent ordering
      txtFiles.sort();
      
      // Generate merged filename
      const directoryName = path.basename(directory);
      const mergedFileName = `${directoryName}${this.config.output.mergedFileSuffix}.txt`;
      const mergedFilePath = path.join(directory, mergedFileName);
      
      // Create merged content - just the text with no extra formatting
      let mergedContent = '';
      
      for (let i = 0; i < txtFiles.length; i++) {
        const txtFile = txtFiles[i];
        
        try {
          const fileContent = await fs.readFile(txtFile, this.config.output.encoding);
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
          this.Utils.log(`Warning: Could not read file ${txtFile}: ${error.message}`, 'warning');
        }
      }
      
      // Write merged file
      await fs.writeFile(mergedFilePath, mergedContent, this.config.output.encoding);
      
      return mergedFilePath;
      
    } catch (error) {
      this.Utils.log(`Error creating merged file for ${directory}: ${error.message}`, 'error');
      return null;
    }
  }

  async getTxtFilesInDirectory(directory) {
    try {
      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      
      const items = await fs.readdir(directory);
      const txtFiles = [];
      
      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile() && 
            path.extname(item).toLowerCase() === '.txt' &&
            !item.includes(this.config.output.mergedFileSuffix)) {
          txtFiles.push(itemPath);
        }
      }
      
      return txtFiles;
      
    } catch (error) {
      this.Utils.log(`Error reading directory ${directory}: ${error.message}`, 'error');
      return [];
    }
  }

  async printSummary(targetDir) {
    try {
      console.log(chalk.cyan.bold('\n📊 Merge Summary'));
      console.log(chalk.cyan('━'.repeat(40)));
      
      // Count merged files
      const mergedFiles = await this.findMergedFiles(targetDir);
      const totalTxtFiles = await this.countFilesInDirectory(targetDir, ['.txt']);
      const individualTxtFiles = totalTxtFiles - mergedFiles.length;
      
      console.log(chalk.white(`📂 Target Directory: ${targetDir}`));
      console.log(chalk.blue(`📄 Individual TXT Files: ${individualTxtFiles}`));
      console.log(chalk.green(`📋 Merged OCR Files: ${mergedFiles.length}`));
      
      if (mergedFiles.length > 0) {
        console.log(chalk.cyan('\n📋 Generated merged files:'));
        mergedFiles.forEach((file, index) => {
          const relativePath = file.path.replace(targetDir, '');
          console.log(chalk.gray(`  ${index + 1}. ${relativePath}`));
        });
      }
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not generate summary: ${error.message}`));
    }
  }

  async findMergedFiles(directory, mergedFiles = []) {
    try {
      if (!await this.Utils.getFileStats(directory).then(stats => stats.exists)) {
        return mergedFiles;
      }

      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      
      const items = await fs.readdir(directory);
      
      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await this.findMergedFiles(itemPath, mergedFiles);
        } else if (stats.isFile() && 
                   item.includes(this.config.output.mergedFileSuffix) && 
                   path.extname(item).toLowerCase() === '.txt') {
          mergedFiles.push({
            path: itemPath,
            size: stats.size
          });
        }
      }
      
      return mergedFiles;
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not scan directory ${directory}: ${error.message}`));
      return mergedFiles;
    }
  }

  async countFilesInDirectory(directory, extensions) {
    try {
      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      
      if (!await fs.pathExists(directory)) return 0;
      
      let count = 0;
      const items = await fs.readdir(directory, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const subDir = path.join(directory, item.name);
          count += await this.countFilesInDirectory(subDir, extensions);
        } else {
          const ext = path.extname(item.name).toLowerCase();
          if (extensions.some(extension => 
            item.name.toLowerCase().includes(extension.toLowerCase()) || 
            ext === extension.toLowerCase()
          )) {
            count++;
          }
        }
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }
}

async function main() {
  try {
    const merger = new TxtFileMerger();
    await merger.run();
    
    console.log(chalk.green('\n✅ TXT file merging completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Fatal error in main():', error.message));
    process.exit(1);
  }
}

// Usage help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(chalk.cyan.bold('\n📋 TXT File Merger - Usage\n'));
  console.log(chalk.white('Merges individual TXT files into consolidated files with "_OCR" suffix.'));
  console.log(chalk.white('Each directory with TXT files gets its own merged file.'));
  console.log('');
  console.log(chalk.yellow('Usage:'));
  console.log('  node src/merge-txt-files.js [directory]');
  console.log('  npm run merge [directory]');
  console.log('');
  console.log(chalk.yellow('Examples:'));
  console.log('  node src/merge-txt-files.js                    # Use default output directory');
  console.log('  node src/merge-txt-files.js ./my-txt-files     # Use custom directory');
  console.log('  npm run merge ./my-txt-files                   # Use npm script with custom dir');
  console.log('');
  console.log(chalk.gray('Default directory: ./3_OCR_TXT_Files'));
  process.exit(0);
}

// Run the merger
main().catch(error => {
  console.error(chalk.red('❌ Fatal error in main catch:', error.message));
  process.exit(1);
});