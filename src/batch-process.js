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
    
    // Dynamic rate adjustment state
    this.rateAdjustment = {
      currentBatchSize: this.config.processing.batchSize,
      currentBatchDelay: this.config.processing.batchDelay,
      batchHistory: [],
      consecutiveFailures: 0,
      lastAdjustment: 0,
      adjustmentCount: 0
    };
    
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
    this.Utils.log(`Initial batch size: ${this.rateAdjustment.currentBatchSize}, Batch delay: ${this.rateAdjustment.currentBatchDelay/1000}s`, 'info');
    
    if (this.config.processing.dynamicRateAdjustment.enabled) {
      console.log(this.chalk.cyan('🧠 Dynamic rate adjustment enabled - will optimize processing speed automatically'));
    }

    // Process files in dynamic batches
    let remainingFiles = [...imageFiles];
    const allResults = [];
    let batchNumber = 0;
    
    while (remainingFiles.length > 0) {
      batchNumber++;
      
      // Create current batch based on dynamic batch size
      const currentBatchSize = Math.min(this.rateAdjustment.currentBatchSize, remainingFiles.length);
      const batch = remainingFiles.splice(0, currentBatchSize);
      
      console.log(this.chalk.blue(`\n📦 Processing batch ${batchNumber} (${batch.length} files)...`));
      console.log(this.chalk.gray(`   Batch size: ${currentBatchSize}, Delay: ${this.rateAdjustment.currentBatchDelay/1000}s`));
      
      if (batchNumber > 1) {
        console.log(this.chalk.yellow(`⏳ Waiting ${this.rateAdjustment.currentBatchDelay/1000}s between batches...`));
        await this.Utils.delay(this.rateAdjustment.currentBatchDelay);
      }

      // Process current batch with concurrency control
      const batchResults = await this.processBatchConcurrent(batch, progressBar);
      allResults.push(...batchResults);
      
      const batchSuccessCount = batchResults.filter(r => r.success).length;
      const batchSuccessRate = batchSuccessCount / batch.length;
      
      console.log(this.chalk.green(`✅ Batch ${batchNumber} completed: ${batchSuccessCount}/${batch.length} successful (${Math.round(batchSuccessRate * 100)}%)`));
      
      // Adjust batch settings based on performance
      this.adjustBatchSettings(batchSuccessRate, batchNumber);
    }

    this.processor.finishProcessing();
    progressBar.complete();
    
    await this.printSummary({ 
      completed: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      total: allResults.length,
      failedTasks: allResults.filter(r => !r.success)
    });

    // Generate merged OCR files
    const successfulResults = allResults.filter(r => r.success);
    if (successfulResults.length > 0) {
      console.log(this.chalk.cyan('\n📋 Generating merged OCR files...'));
      try {
        await this.Utils.generateMergedOCRFiles(this.config.outputDir);
      } catch (error) {
        console.log(this.chalk.yellow(`⚠️  Warning: Could not generate merged files: ${error.message}`));
      }
    }

    // Generate verification report
    await this.generateVerificationReport(allResults);
  }

  async processBatchConcurrent(batch, progressBar) {
    const promises = batch.map(async (inputPath) => {
      const outputPath = this.Utils.mapInputToOutputPath(
        inputPath, 
        this.config.inputDir, 
        this.config.outputDir
      );

      try {
        const result = await this.processor.processImage(inputPath, outputPath);
        progressBar.update();
        
        // Show progress within batch
        const status = result.success ? '✓' : '✗';
        console.log(this.chalk.gray(`  ${this.path.basename(inputPath)} ${status}`));
        
        return result;
      } catch (error) {
        console.log(this.chalk.red(`  Error processing ${this.path.basename(inputPath)}: ${error.message}`));
        progressBar.update();
        return {
          success: false,
          inputPath,
          outputPath,
          error: error.message
        };
      }
    });

    // Process with concurrency limit
    const allResults = [];
    const maxConcurrency = this.config.processing.maxConcurrency;
    
    for (let i = 0; i < promises.length; i += maxConcurrency) {
      const chunk = promises.slice(i, i + maxConcurrency);
      const chunkResults = await Promise.all(chunk);
      allResults.push(...chunkResults);
    }

    return allResults;
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  adjustBatchSettings(batchSuccessRate, batchNumber) {
    if (!this.config.processing.dynamicRateAdjustment.enabled) {
      return;
    }

    const settings = this.config.processing.dynamicRateAdjustment;
    
    // Record batch performance
    this.rateAdjustment.batchHistory.push({
      batchNumber,
      successRate: batchSuccessRate,
      batchSize: this.rateAdjustment.currentBatchSize,
      batchDelay: this.rateAdjustment.currentBatchDelay
    });

    // Check if it's time to adjust (every N batches)
    if (batchNumber % settings.adjustmentInterval !== 0) {
      return;
    }

    // Calculate recent success rate (last 3 batches)
    const recentBatches = this.rateAdjustment.batchHistory.slice(-3);
    const avgSuccessRate = recentBatches.reduce((sum, batch) => sum + batch.successRate, 0) / recentBatches.length;

    let shouldAdjust = false;
    let scaleUp = false;

    if (avgSuccessRate >= settings.scaleUpThreshold) {
      // Performance is good, try to scale up
      scaleUp = true;
      shouldAdjust = true;
      this.rateAdjustment.consecutiveFailures = 0;
    } else if (avgSuccessRate <= settings.scaleDownThreshold) {
      // Performance is poor, scale down
      scaleUp = false;
      shouldAdjust = true;
      this.rateAdjustment.consecutiveFailures++;
    }

    if (shouldAdjust) {
      const oldBatchSize = this.rateAdjustment.currentBatchSize;
      const oldBatchDelay = this.rateAdjustment.currentBatchDelay;

      if (scaleUp) {
        // Increase batch size, decrease delay
        this.rateAdjustment.currentBatchSize = Math.min(
          Math.round(this.rateAdjustment.currentBatchSize * settings.scalingFactor),
          settings.maxBatchSize
        );
        this.rateAdjustment.currentBatchDelay = Math.max(
          Math.round(this.rateAdjustment.currentBatchDelay / settings.scalingFactor),
          settings.minBatchDelay
        );
      } else {
        // Decrease batch size, increase delay
        this.rateAdjustment.currentBatchSize = Math.max(
          Math.round(this.rateAdjustment.currentBatchSize / settings.scalingFactor),
          settings.minBatchSize
        );
        this.rateAdjustment.currentBatchDelay = Math.min(
          Math.round(this.rateAdjustment.currentBatchDelay * settings.scalingFactor),
          settings.maxBatchDelay
        );
      }

      this.rateAdjustment.adjustmentCount++;
      
      const direction = scaleUp ? 'UP' : 'DOWN';
      const reason = scaleUp ? 'high success rate' : 'low success rate';
      
      console.log(this.chalk.yellow(
        `🔄 Dynamic adjustment ${this.rateAdjustment.adjustmentCount}: Scaling ${direction} (${reason})\n` +
        `   Batch size: ${oldBatchSize} → ${this.rateAdjustment.currentBatchSize}\n` +
        `   Batch delay: ${oldBatchDelay}ms → ${this.rateAdjustment.currentBatchDelay}ms\n` +
        `   Recent success rate: ${Math.round(avgSuccessRate * 100)}%`
      ));
    }
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
    
    // Generate merged OCR files for test mode too
    if (stats.successful > 0) {
      console.log(this.chalk.cyan('\n📋 Generating merged OCR files for test results...'));
      try {
        await this.Utils.generateMergedOCRFiles(this.config.outputDir);
      } catch (error) {
        console.log(this.chalk.yellow(`⚠️  Warning: Could not generate merged files: ${error.message}`));
      }
    }
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

    // Show dynamic adjustment statistics
    if (this.config.processing.dynamicRateAdjustment.enabled && this.rateAdjustment.adjustmentCount > 0) {
      console.log(`\n${this.chalk.cyan('🧠 Dynamic Rate Adjustment Stats:')}`);
      console.log(`${this.chalk.cyan('Adjustments Made:')} ${this.rateAdjustment.adjustmentCount}`);
      console.log(`${this.chalk.cyan('Final Batch Size:')} ${this.rateAdjustment.currentBatchSize}`);
      console.log(`${this.chalk.cyan('Final Batch Delay:')} ${this.rateAdjustment.currentBatchDelay/1000}s`);
      
      const initialThroughput = 60000 / (this.config.processing.batchDelay + (this.config.processing.batchSize * this.config.processing.requestDelay));
      const finalThroughput = 60000 / (this.rateAdjustment.currentBatchDelay + (this.rateAdjustment.currentBatchSize * this.config.processing.requestDelay));
      const improvementPercent = Math.round(((finalThroughput - initialThroughput) / initialThroughput) * 100);
      
      if (improvementPercent > 0) {
        console.log(`${this.chalk.green('Throughput Improvement:')} +${improvementPercent}% (estimated)`);
      } else if (improvementPercent < 0) {
        console.log(`${this.chalk.red('Throughput Change:')} ${improvementPercent}% (optimized for reliability)`);
      }
    }

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
          await this.printTree(itemPath, newPrefix);
        }
      }
    } catch (error) {
      console.log(prefix + this.chalk.red(`Error reading directory: ${error.message}`));
    }
  }

  async generateVerificationReport(processedResults) {
    console.log(this.chalk.cyan.bold('\n📋 Generating Verification Report...'));
    
    try {
      // Get all image files from input directory
      const allImageFiles = await this.Utils.findImageFiles(this.config.inputDir);
      const reportLines = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      reportLines.push('='.repeat(80));
      reportLines.push('FILE VERIFICATION REPORT');
      reportLines.push('='.repeat(80));
      reportLines.push(`Generated: ${new Date().toLocaleString()}`);
      reportLines.push(`Input Directory: ${this.path.resolve(this.config.inputDir)}`);
      reportLines.push(`Output Directory: ${this.path.resolve(this.config.outputDir)}`);
      reportLines.push('');
      
      // Summary statistics
      const totalInputFiles = allImageFiles.length;
      const successfulConversions = processedResults.filter(r => r.success).length;
      const failedConversions = processedResults.filter(r => !r.success).length;
      const notProcessed = totalInputFiles - processedResults.length;
      
      reportLines.push('SUMMARY:');
      reportLines.push('-'.repeat(40));
      reportLines.push(`Total Image Files Found: ${totalInputFiles}`);
      reportLines.push(`Successfully Converted: ${successfulConversions}`);
      reportLines.push(`Failed Conversions: ${failedConversions}`);
      reportLines.push(`Not Processed: ${notProcessed}`);
      reportLines.push(`Conversion Rate: ${Math.round((successfulConversions / totalInputFiles) * 100)}%`);
      reportLines.push('');

      // Check for missing output files
      const missingFiles = [];
      const existingFiles = [];
      
      for (const inputFile of allImageFiles) {
        const expectedOutputPath = this.Utils.mapInputToOutputPath(
          inputFile,
          this.config.inputDir,
          this.config.outputDir
        );
        
        const inputFileName = this.path.basename(inputFile);
        const outputFileName = this.path.basename(expectedOutputPath);
        const relativePath = this.path.relative(this.config.inputDir, inputFile);
        
        if (await this.fs.pathExists(expectedOutputPath)) {
          const stats = await this.fs.stat(expectedOutputPath);
          existingFiles.push({
            input: inputFileName,
            output: outputFileName,
            relativePath: relativePath,
            size: stats.size,
            created: stats.mtime
          });
        } else {
          missingFiles.push({
            input: inputFileName,
            relativePath: relativePath,
            expectedOutput: outputFileName
          });
        }
      }

      // Report existing files
      if (existingFiles.length > 0) {
        reportLines.push('SUCCESSFULLY CONVERTED FILES:');
        reportLines.push('-'.repeat(40));
        existingFiles.forEach((file, index) => {
          reportLines.push(`${(index + 1).toString().padStart(4)}. ${file.relativePath}`);
          reportLines.push(`      → ${file.output} (${this.formatFileSize(file.size)})`);
        });
        reportLines.push('');
      }

      // Report missing files
      if (missingFiles.length > 0) {
        reportLines.push('MISSING/FAILED CONVERSIONS:');
        reportLines.push('-'.repeat(40));
        missingFiles.forEach((file, index) => {
          reportLines.push(`${(index + 1).toString().padStart(4)}. ${file.relativePath}`);
          reportLines.push(`      Expected: ${file.expectedOutput}`);
          
          // Check if this file was in processing results
          const processResult = processedResults.find(r => 
            this.path.basename(r.inputPath) === file.input
          );
          
          if (processResult && !processResult.success) {
            reportLines.push(`      Error: ${processResult.error}`);
          } else if (!processResult) {
            reportLines.push(`      Status: Not processed (possibly skipped)`);
          } else {
            reportLines.push(`      Status: Unknown failure`);
          }
        });
        reportLines.push('');
      }

      // Failed processing details
      const failedResults = processedResults.filter(r => !r.success);
      if (failedResults.length > 0) {
        reportLines.push('PROCESSING FAILURES DETAILS:');
        reportLines.push('-'.repeat(40));
        failedResults.forEach((result, index) => {
          const fileName = this.path.basename(result.inputPath);
          const relativePath = this.path.relative(this.config.inputDir, result.inputPath);
          reportLines.push(`${(index + 1).toString().padStart(4)}. ${relativePath}`);
          reportLines.push(`      Error: ${result.error}`);
          if (result.rateLimited) {
            reportLines.push(`      Cause: Rate limiting detected`);
          }
        });
        reportLines.push('');
      }

      // Directory comparison
      reportLines.push('DIRECTORY STRUCTURE COMPARISON:');
      reportLines.push('-'.repeat(40));
      reportLines.push('Input Structure:');
      await this.addDirectoryStructureToReport(this.config.inputDir, reportLines, '  ');
      reportLines.push('');
      reportLines.push('Output Structure:');
      await this.addDirectoryStructureToReport(this.config.outputDir, reportLines, '  ');
      reportLines.push('');

      // Merged OCR Files Report
      await this.addMergedFilesReport(reportLines);

      // Recommendations
      reportLines.push('RECOMMENDATIONS:');
      reportLines.push('-'.repeat(40));
      if (missingFiles.length === 0) {
        reportLines.push('✅ All files successfully converted!');
      } else {
        reportLines.push(`📋 ${missingFiles.length} files need attention:`);
        if (failedResults.some(r => r.rateLimited)) {
          reportLines.push('   • Some failures due to rate limiting - consider running again');
        }
        if (missingFiles.length > failedResults.length) {
          reportLines.push('   • Some files may not have been processed - check file formats');
        }
        reportLines.push('   • Review failed files above for specific error details');
        reportLines.push('   • Consider re-running for failed files only');
      }
      
      reportLines.push('');
      reportLines.push('='.repeat(80));
      reportLines.push('End of Report');
      reportLines.push('='.repeat(80));

      // Write report to file
      const reportContent = reportLines.join('\n');
      const reportPath = this.path.join(process.cwd(), 'logs', 'report.txt');
      await this.fs.writeFile(reportPath, reportContent, 'utf8');
      
      console.log(this.chalk.green(`\n📄 Verification report generated: ${reportPath}`));
      console.log(this.chalk.cyan(`📊 Summary: ${successfulConversions}/${totalInputFiles} files converted successfully`));
      
      if (missingFiles.length > 0) {
        console.log(this.chalk.yellow(`⚠️  ${missingFiles.length} files missing from output - see report for details`));
      }

    } catch (error) {
      console.log(this.chalk.red(`❌ Error generating verification report: ${error.message}`));
    }
  }

  async addDirectoryStructureToReport(directory, reportLines, prefix = '') {
    try {
      if (!await this.fs.pathExists(directory)) {
        reportLines.push(`${prefix}Directory not found: ${directory}`);
        return;
      }

      const items = await this.fs.readdir(directory);
      const sortedItems = items.sort();
      
      for (const item of sortedItems) {
        if (item.startsWith('.')) continue; // Skip hidden files
        
        const itemPath = this.path.join(directory, item);
        const stats = await this.fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          reportLines.push(`${prefix}📁 ${item}/`);
          await this.addDirectoryStructureToReport(itemPath, reportLines, prefix + '  ');
        } else {
          const ext = this.path.extname(item).toLowerCase();
          let icon;
          if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            icon = '🖼️';
          } else if (ext === '.txt') {
            // Check if it's a merged OCR file
            if (item.includes(this.config.output.mergedFileSuffix)) {
              icon = '📋'; // Different icon for merged OCR files
            } else {
              icon = '📄'; // Regular text files
            }
          } else {
            icon = '📎';
          }
          reportLines.push(`${prefix}${icon} ${item} (${this.formatFileSize(stats.size)})`);
        }
      }
    } catch (error) {
      reportLines.push(`${prefix}Error reading directory: ${error.message}`);
    }
  }

  async addMergedFilesReport(reportLines) {
    try {
      const mergedFiles = [];
      
      // Find all merged OCR files
      await this.findMergedFiles(this.config.outputDir, mergedFiles);
      
      if (mergedFiles.length > 0) {
        reportLines.push('MERGED OCR FILES:');
        reportLines.push('-'.repeat(40));
        reportLines.push(`Generated ${mergedFiles.length} merged OCR file(s):`);
        reportLines.push('');
        
        mergedFiles.forEach((file, index) => {
          const relativePath = this.path.relative(this.config.outputDir, file.path);
          reportLines.push(`${(index + 1).toString().padStart(4)}. 📋 ${relativePath}`);
          reportLines.push(`      Size: ${this.formatFileSize(file.size)}`);
          reportLines.push(`      Files merged: ${file.fileCount || 'Unknown'}`);
        });
        reportLines.push('');
      } else if (this.config.output.generateMergedFiles) {
        reportLines.push('MERGED OCR FILES:');
        reportLines.push('-'.repeat(40));
        reportLines.push('⚠️  No merged files were generated (no successful conversions or disabled)');
        reportLines.push('');
      }
    } catch (error) {
      reportLines.push('MERGED OCR FILES:');
      reportLines.push('-'.repeat(40));
      reportLines.push(`❌ Error checking merged files: ${error.message}`);
      reportLines.push('');
    }
  }

  async findMergedFiles(directory, mergedFiles = []) {
    try {
      if (!await this.fs.pathExists(directory)) {
        return mergedFiles;
      }

      const items = await this.fs.readdir(directory);
      
      for (const item of items) {
        const itemPath = this.path.join(directory, item);
        const stats = await this.fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await this.findMergedFiles(itemPath, mergedFiles);
        } else if (stats.isFile() && 
                   item.includes(this.config.output.mergedFileSuffix) && 
                   this.path.extname(item).toLowerCase() === '.txt') {
          
          // Count individual text files in the same directory to estimate merged count
          let fileCount = 'Unknown';
          try {
            const directoryPath = this.path.dirname(itemPath);
            const directoryItems = await this.fs.readdir(directoryPath);
            const txtFileCount = directoryItems.filter(file => 
              file.endsWith('.txt') && 
              !file.includes(this.config.output.mergedFileSuffix)
            ).length;
            fileCount = txtFileCount.toString();
          } catch (error) {
            // Ignore read errors for count
          }
          
          mergedFiles.push({
            path: itemPath,
            size: stats.size,
            fileCount: fileCount
          });
        }
      }
      
      return mergedFiles;
    } catch (error) {
      console.log(this.chalk.yellow(`Warning: Could not scan directory ${directory}: ${error.message}`));
      return mergedFiles;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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