#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { config } from './config.js';
import { Utils, ProcessingQueue } from './utils.js';
import { OCRProcessor } from './ocr-processor.js';

class BatchProcessor {
  constructor() {
    this.processor = new OCRProcessor();
    this.queue = new ProcessingQueue(config.processing.maxConcurrency);
    this.startTime = Date.now();
  }

  async run() {
    try {
      console.log(chalk.cyan.bold('\n🔍 Bulk OCR Processor v1.0.0\n'));
      
      const isTestMode = process.argv.includes('--test');
      if (isTestMode) {
        console.log(chalk.yellow('Running in test mode...\n'));
      }

      await this.validateEnvironment();
      
      const imageFiles = await this.findImageFiles();
      if (imageFiles.length === 0) {
        Utils.log('No image files found to process', 'warning');
        return;
      }

      console.log(chalk.blue(`Found ${imageFiles.length} image file(s) to process\n`));
      
      if (isTestMode) {
        await this.runTestMode(imageFiles.slice(0, 3));
      } else {
        await this.processBatch(imageFiles);
      }

    } catch (error) {
      Utils.log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async validateEnvironment() {
    Utils.log('Validating environment...', 'info');

    Utils.log(`Checking input directory: ${path.resolve(config.inputDir)}`, 'verbose');
    if (!await fs.pathExists(config.inputDir)) {
      throw new Error(`Input directory does not exist: ${config.inputDir}`);
    }

    Utils.log(`Creating output directory: ${path.resolve(config.outputDir)}`, 'verbose');
    await Utils.ensureDirectoryExists(config.outputDir);

    if (await fs.pathExists(config.logging.errorLogFile)) {
      await fs.remove(config.logging.errorLogFile);
    }

    Utils.log('Environment validation complete', 'success');
  }

  async findImageFiles() {
    Utils.log('Scanning for image files...', 'info');
    Utils.log(`Searching in directory: ${path.resolve(config.inputDir)}`, 'verbose');
    Utils.log(`Looking for extensions: ${config.supportedExtensions.join(', ')}`, 'verbose');
    
    // Debug: Check what's actually in the directory
    try {
      const dirContents = await fs.readdir(config.inputDir);
      Utils.log(`Directory contents (${dirContents.length} items):`, 'verbose');
      for (const item of dirContents) {
        const itemPath = path.join(config.inputDir, item);
        const stats = await fs.stat(itemPath);
        const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
        Utils.log(`  ${type} ${item}`, 'verbose');
      }
    } catch (error) {
      Utils.log(`Error reading directory: ${error.message}`, 'error');
    }
    
    const files = await Utils.findImageFiles(config.inputDir);
    Utils.log(`Found ${files.length} potential image files`, 'verbose');
    
    if (files.length > 0) {
      Utils.log('Found files:', 'verbose');
      files.forEach(file => Utils.log(`  - ${file}`, 'verbose'));
    }
    
    const validFiles = [];

    for (const file of files) {
      if (await this.processor.validateImageFile(file)) {
        validFiles.push(file);
        Utils.log(`✓ Valid: ${file}`, 'verbose');
      } else {
        Utils.log(`✗ Invalid: ${file}`, 'verbose');
      }
    }

    Utils.log(`Final valid files count: ${validFiles.length}`, 'verbose');
    return validFiles;
  }

  async processBatch(imageFiles) {
    this.processor.startProcessing(imageFiles.length);
    
    const progressBar = Utils.createProgressBar(imageFiles.length);
    Utils.log(`Starting batch processing of ${imageFiles.length} files...`, 'info');

    for (const inputPath of imageFiles) {
      const outputPath = Utils.mapInputToOutputPath(
        inputPath, 
        config.inputDir, 
        config.outputDir
      );

      const task = {
        inputPath,
        outputPath,
        execute: async () => {
          const result = await this.processor.processImage(inputPath, outputPath);
          progressBar.update();
          return result;
        }
      };

      this.queue.add(task);
    }

    const results = await this.queue.process();
    this.processor.finishProcessing();

    progressBar.complete();
    await this.printSummary(results);
  }

  async runTestMode(testFiles) {
    console.log(chalk.yellow(`Testing with ${testFiles.length} file(s):\n`));
    
    for (const file of testFiles) {
      console.log(`  - ${path.relative(process.cwd(), file)}`);
    }
    console.log();

    this.processor.startProcessing(testFiles.length);
    
    for (const inputPath of testFiles) {
      const outputPath = Utils.mapInputToOutputPath(
        inputPath, 
        config.inputDir, 
        config.outputDir
      );

      console.log(chalk.blue(`\nTesting: ${path.basename(inputPath)}`));
      
      const result = await this.processor.processImage(inputPath, outputPath);
      
      if (result.success) {
        console.log(chalk.green(`✓ Success - Language: ${result.language}, Segments: ${result.segmentCount}`));
        console.log(chalk.gray(`  Output: ${path.relative(process.cwd(), outputPath)}`));
      } else {
        console.log(chalk.red(`✗ Failed - ${result.error}`));
      }
    }

    this.processor.finishProcessing();
    
    const stats = this.processor.getStats();
    console.log(chalk.cyan(`\nTest completed: ${stats.successful}/${stats.processed} successful`));
  }

  async printSummary(results) {
    const stats = this.processor.getStats();
    const duration = (Date.now() - this.startTime) / 1000;

    console.log(chalk.cyan.bold('\n📊 Processing Summary'));
    console.log(chalk.cyan('━'.repeat(50)));
    
    console.log(`${chalk.white('Total Files:')} ${stats.totalFiles}`);
    console.log(`${chalk.green('Successful:')} ${stats.successful}`);
    console.log(`${chalk.red('Failed:')} ${stats.failed}`);
    console.log(`${chalk.blue('Success Rate:')} ${stats.successRate}%`);
    console.log(`${chalk.yellow('Total Duration:')} ${Math.round(duration * 100) / 100}s`);
    console.log(`${chalk.magenta('Avg Time/File:')} ${stats.avgTimePerFile}s`);

    if (stats.failed > 0) {
      console.log(`\n${chalk.red('Failed files logged to:')} ${config.logging.errorLogFile}`);
    }

    console.log(`\n${chalk.green('Output directory:')} ${path.resolve(config.outputDir)}`);
    
    await this.printDirectoryStructure();
  }

  async printDirectoryStructure() {
    console.log(chalk.cyan.bold('\n📁 Output Structure'));
    console.log(chalk.cyan('━'.repeat(30)));
    
    try {
      await this.printTree(config.outputDir, '', true);
    } catch (error) {
      Utils.log(`Could not display directory structure: ${error.message}`, 'warning');
    }
  }

  async printTree(dir, prefix = '', isLast = true) {
    try {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) return;

      const items = await fs.readdir(dir);
      const sortedItems = items.sort((a, b) => {
        const aPath = path.join(dir, a);
        const bPath = path.join(dir, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const itemPath = path.join(dir, item);
        const isLastItem = i === sortedItems.length - 1;
        const symbol = isLastItem ? '└── ' : '├── ';
        
        const stats = await fs.stat(itemPath);
        const displayName = stats.isDirectory() ? 
          chalk.blue(item) : 
          chalk.white(item);
        
        console.log(prefix + symbol + displayName);
        
        if (stats.isDirectory()) {
          const newPrefix = prefix + (isLastItem ? '    ' : '│   ');
          await this.printTree(itemPath, newPrefix, isLastItem);
        }
      }
    } catch (error) {
      console.log(prefix + chalk.red(`Error reading directory: ${error.message}`));
    }
  }
}

async function main() {
  const processor = new BatchProcessor();
  await processor.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('\nFatal error:', error.message));
    process.exit(1);
  });
}