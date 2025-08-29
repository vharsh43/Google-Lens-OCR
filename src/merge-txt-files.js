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
      
      // Use the existing utility function to generate merged files
      await this.Utils.generateMergedOCRFiles(targetDir);
      
      const duration = (Date.now() - this.startTime) / 1000;
      console.log(chalk.green(`\n✅ Merging completed in ${Math.round(duration * 100) / 100}s`));
      
      // Show summary
      await this.printSummary(targetDir);
      
    } catch (error) {
      this.Utils.log(`Error during merge process: ${error.message}`, 'error');
      throw error;
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