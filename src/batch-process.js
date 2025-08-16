#!/usr/bin/env node

console.log('🚀 Starting OCR Processor...');

// Add error handlers first
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

async function loadModules() {
  console.log('📦 Loading modules...');
  
  try {
    const modules = await Promise.all([
      import('fs-extra'),
      import('path'),
      import('chalk'),
      import('./config.js'),
      import('./utils.js'),
      import('./ocr-processor.js')
    ]);

    console.log('✅ All modules loaded successfully!');
    
    return {
      fs: modules[0].default,
      path: modules[1].default,
      chalk: modules[2].default,
      config: modules[3].config,
      Utils: modules[4].Utils,
      ProcessingQueue: modules[4].ProcessingQueue,
      OCRProcessor: modules[5].OCRProcessor
    };
  } catch (error) {
    console.error('❌ Failed to load modules:', error);
    throw error;
  }
}

class BatchProcessor {
  constructor(modules) {
    console.log('🏗️ Initializing BatchProcessor...');
    
    this.fs = modules.fs;
    this.path = modules.path;
    this.chalk = modules.chalk;
    this.config = modules.config;
    this.Utils = modules.Utils;
    this.ProcessingQueue = modules.ProcessingQueue;
    
    this.processor = new modules.OCRProcessor();
    this.queue = new this.ProcessingQueue(this.config.processing.maxConcurrency);
    this.startTime = Date.now();
    
    console.log('✅ BatchProcessor initialized successfully!');
  }

  async run() {
    try {
      console.log(this.chalk.cyan.bold('\n🔍 Bulk OCR Processor v1.0.0\n'));
      
      const isTestMode = process.argv.includes('--test');
      if (isTestMode) {
        console.log(this.chalk.yellow('Running in test mode...\n'));
      }

      console.log('🔧 Validating environment...');
      await this.validateEnvironment();
      
      console.log('🔍 Finding image files...');
      const imageFiles = await this.findImageFiles();
      
      if (imageFiles.length === 0) {
        this.Utils.log('No image files found to process', 'warning');
        return;
      }

      console.log(this.chalk.blue(`Found ${imageFiles.length} image file(s) to process\n`));
      
      if (isTestMode) {
        await this.runTestMode(imageFiles.slice(0, 3));
      } else {
        await this.processBatch(imageFiles);
      }

    } catch (error) {
      console.error('❌ Fatal error in run():', error);
      this.Utils.log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async validateEnvironment() {
    this.Utils.log('Validating environment...', 'info');

    this.Utils.log(`Checking input directory: ${this.path.resolve(this.config.inputDir)}`, 'verbose');
    if (!await this.fs.pathExists(this.config.inputDir)) {
      throw new Error(`Input directory does not exist: ${this.config.inputDir}`);
    }

    this.Utils.log(`Creating output directory: ${this.path.resolve(this.config.outputDir)}`, 'verbose');
    await this.Utils.ensureDirectoryExists(this.config.outputDir);

    if (await this.fs.pathExists(this.config.logging.errorLogFile)) {
      await this.fs.remove(this.config.logging.errorLogFile);
    }

    this.Utils.log('Environment validation complete', 'success');
  }

  async findImageFiles() {
    this.Utils.log('Scanning for image files...', 'info');
    this.Utils.log(`Searching in directory: ${this.path.resolve(this.config.inputDir)}`, 'verbose');
    this.Utils.log(`Looking for extensions: ${this.config.supportedExtensions.join(', ')}`, 'verbose');
    
    // Debug: Check what's actually in the directory
    try {
      const dirContents = await this.fs.readdir(this.config.inputDir);
      this.Utils.log(`Directory contents (${dirContents.length} items):`, 'verbose');
      for (const item of dirContents) {
        const itemPath = this.path.join(this.config.inputDir, item);
        const stats = await this.fs.stat(itemPath);
        const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
        this.Utils.log(`  ${type} ${item}`, 'verbose');
      }
    } catch (error) {
      this.Utils.log(`Error reading directory: ${error.message}`, 'error');
    }
    
    const files = await this.Utils.findImageFiles(this.config.inputDir);
    this.Utils.log(`Found ${files.length} potential image files`, 'verbose');
    
    if (files.length > 0) {
      this.Utils.log('Found files:', 'verbose');
      files.forEach(file => this.Utils.log(`  - ${file}`, 'verbose'));
    }
    
    const validFiles = [];

    for (const file of files) {
      if (await this.processor.validateImageFile(file)) {
        validFiles.push(file);
        this.Utils.log(`✓ Valid: ${file}`, 'verbose');
      } else {
        this.Utils.log(`✗ Invalid: ${file}`, 'verbose');
      }
    }

    this.Utils.log(`Final valid files count: ${validFiles.length}`, 'verbose');
    return validFiles;
  }

  async processBatch(imageFiles) {
    this.processor.startProcessing(imageFiles.length);
    
    const progressBar = this.Utils.createProgressBar(imageFiles.length);
    this.Utils.log(`Starting intelligent batch processing of ${imageFiles.length} files...`, 'info');
    this.Utils.log(`Batch size: ${this.config.processing.batchSize}, Batch delay: ${this.config.processing.batchDelay/1000}s`, 'info');

    // Process files in batches to respect rate limits
    const batches = this.createBatches(imageFiles, this.config.processing.batchSize);
    const allResults = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNumber = batchIndex + 1;
      
      console.log(this.chalk.blue(`\n📦 Processing batch ${batchNumber}/${batches.length} (${batch.length} files)...`));
      
      if (batchIndex > 0) {
        console.log(this.chalk.yellow(`⏳ Waiting ${this.config.processing.batchDelay/1000}s between batches...`));
        await this.Utils.delay(this.config.processing.batchDelay);
      }

      // Process current batch sequentially to avoid rate limits
      for (const inputPath of batch) {
        const outputPath = this.Utils.mapInputToOutputPath(
          inputPath, 
          this.config.inputDir, 
          this.config.outputDir
        );

        try {
          const result = await this.processor.processImage(inputPath, outputPath);
          allResults.push(result);
          progressBar.update();
          
          // Show progress within batch
          const processedInBatch = batch.indexOf(inputPath) + 1;
          console.log(this.chalk.gray(`  ${processedInBatch}/${batch.length} - ${this.path.basename(inputPath)} ${result.success ? '✓' : '✗'}`));
          
        } catch (error) {
          console.log(this.chalk.red(`  Error processing ${this.path.basename(inputPath)}: ${error.message}`));
          allResults.push({
            success: false,
            inputPath,
            outputPath,
            error: error.message
          });
          progressBar.update();
        }
      }
      
      const batchSuccessCount = batch.filter((_, i) => {
        const resultIndex = allResults.length - batch.length + i;
        return allResults[resultIndex]?.success;
      }).length;
      
      console.log(this.chalk.green(`✅ Batch ${batchNumber} completed: ${batchSuccessCount}/${batch.length} successful`));
    }

    this.processor.finishProcessing();
    progressBar.complete();
    
    await this.printSummary({ 
      completed: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      total: allResults.length,
      failedTasks: allResults.filter(r => !r.success)
    });
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async runTestMode(testFiles) {
    console.log(this.chalk.yellow(`Testing with ${testFiles.length} file(s):\n`));
    
    for (const file of testFiles) {
      console.log(`  - ${this.path.relative(process.cwd(), file)}`);
    }
    console.log();

    this.processor.startProcessing(testFiles.length);
    
    for (const inputPath of testFiles) {
      const outputPath = this.Utils.mapInputToOutputPath(
        inputPath, 
        this.config.inputDir, 
        this.config.outputDir
      );

      console.log(this.chalk.blue(`\nTesting: ${this.path.basename(inputPath)}`));
      
      const result = await this.processor.processImage(inputPath, outputPath);
      
      if (result.success) {
        console.log(this.chalk.green(`✓ Success - Language: ${result.language}, Segments: ${result.segmentCount}`));
        console.log(this.chalk.gray(`  Output: ${this.path.relative(process.cwd(), outputPath)}`));
      } else {
        console.log(this.chalk.red(`✗ Failed - ${result.error}`));
      }
    }

    this.processor.finishProcessing();
    
    const stats = this.processor.getStats();
    console.log(this.chalk.cyan(`\nTest completed: ${stats.successful}/${stats.processed} successful`));
  }

  async printSummary(results) {
    const stats = this.processor.getStats();
    const duration = (Date.now() - this.startTime) / 1000;

    console.log(this.chalk.cyan.bold('\n📊 Processing Summary'));
    console.log(this.chalk.cyan('━'.repeat(50)));
    
    console.log(`${this.chalk.white('Total Files:')} ${stats.totalFiles}`);
    console.log(`${this.chalk.green('Successful:')} ${stats.successful}`);
    console.log(`${this.chalk.red('Failed:')} ${stats.failed}`);
    console.log(`${this.chalk.blue('Success Rate:')} ${stats.successRate}%`);
    console.log(`${this.chalk.yellow('Total Duration:')} ${Math.round(duration * 100) / 100}s`);
    console.log(`${this.chalk.magenta('Avg Time/File:')} ${stats.avgTimePerFile}s`);

    if (stats.failed > 0) {
      console.log(`\n${this.chalk.red('Failed files logged to:')} ${this.config.logging.errorLogFile}`);
    }

    console.log(`\n${this.chalk.green('Output directory:')} ${this.path.resolve(this.config.outputDir)}`);
    
    await this.printDirectoryStructure();
  }

  async printDirectoryStructure() {
    console.log(this.chalk.cyan.bold('\n📁 Output Structure'));
    console.log(this.chalk.cyan('━'.repeat(30)));
    
    try {
      await this.printTree(this.config.outputDir, '', true);
    } catch (error) {
      this.Utils.log(`Could not display directory structure: ${error.message}`, 'warning');
    }
  }

  async printTree(dir, prefix = '', isLast = true) {
    try {
      const stats = await this.fs.stat(dir);
      if (!stats.isDirectory()) return;

      const items = await this.fs.readdir(dir);
      const sortedItems = items.sort((a, b) => {
        const aPath = this.path.join(dir, a);
        const bPath = this.path.join(dir, b);
        const aIsDir = this.fs.statSync(aPath).isDirectory();
        const bIsDir = this.fs.statSync(bPath).isDirectory();
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const itemPath = this.path.join(dir, item);
        const isLastItem = i === sortedItems.length - 1;
        const symbol = isLastItem ? '└── ' : '├── ';
        
        const stats = await this.fs.stat(itemPath);
        const displayName = stats.isDirectory() ? 
          this.chalk.blue(item) : 
          this.chalk.white(item);
        
        console.log(prefix + symbol + displayName);
        
        if (stats.isDirectory()) {
          const newPrefix = prefix + (isLastItem ? '    ' : '│   ');
          await this.printTree(itemPath, newPrefix, isLastItem);
        }
      }
    } catch (error) {
      console.log(prefix + this.chalk.red(`Error reading directory: ${error.message}`));
    }
  }
}

async function main() {
  try {
    console.log('🎬 Starting main function...');
    
    const modules = await loadModules();
    console.log('✅ Modules loaded, creating processor...');
    
    const processor = new BatchProcessor(modules);
    console.log('✅ Processor created, starting run...');
    
    await processor.run();
    console.log('✅ Processing completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error in main():', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

console.log('📋 File being run directly, starting main...');
main().catch(error => {
  console.error('❌ Fatal error in main catch:', error.message);
  process.exit(1);
});