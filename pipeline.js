#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class PDFToTextPipeline {
  constructor() {
    this.pdfInputDir = './1_New_File_Process_PDF_2_PNG/';
    this.pngOutputDir = './2_Converted_PNGs/';
    this.textOutputDir = './3_OCR_TXT_Files/';
    this.logFile = './logs/PipelineLog.txt';
    this.startTime = Date.now();
    this.pythonCmd = null; // Will be detected dynamically
  }

  async run() {
    console.log(chalk.cyan.bold('\n🔄 PDF to Text Pipeline Starting...\n'));
    
    try {
      await this.logMessage('Pipeline started');
      
      // Step 0: Check dependencies
      await this.checkDependencies();
      
      // Step 1: Check for PDFs
      await this.checkForPDFs();
      
      // Step 2: Convert PDFs to PNGs
      await this.convertPDFsToPNGs();
      
      // Step 3: Run OCR processing
      await this.runOCRProcessing();
      
      // Step 4: Generate summary
      await this.generatePipelineSummary();
      
      console.log(chalk.green.bold('\n✅ Pipeline completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Pipeline failed:'), error.message);
      await this.logMessage(`Pipeline failed: ${error.message}`);
      
      // Provide helpful error context
      if (error.message.includes('python') || error.message.includes('Python') || error.message.includes('PyMuPDF')) {
        console.log(chalk.yellow('\n💡 Tip: Install Python dependencies with:'));
        console.log(chalk.gray('   pip install PyMuPDF tqdm'));
      }
      
      process.exit(1);
    }
  }

  async detectPythonCommand() {
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        await new Promise((resolve, reject) => {
          const pythonCheck = spawn(cmd, ['--version'], { stdio: 'pipe' });
          
          let output = '';
          pythonCheck.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          pythonCheck.on('close', (code) => {
            if (code === 0) {
              const version = output.trim();
              console.log(chalk.green(`   ✅ Python found: ${version} (using '${cmd}')`));
              this.pythonCmd = cmd;
              resolve();
            } else {
              reject(new Error(`${cmd} not found`));
            }
          });
          
          pythonCheck.on('error', () => {
            reject(new Error(`${cmd} not found in PATH`));
          });
        });
        return; // Success, exit the loop
      } catch (error) {
        // Try next command
        continue;
      }
    }
    
    throw new Error('Python is required but not found. Please install Python 3.6+ and ensure it\'s in your PATH');
  }

  async checkDependencies() {
    console.log(chalk.blue('🔧 Step 0: Checking dependencies...'));
    await this.logMessage('Checking system dependencies');
    
    // Detect and check Python availability
    await this.detectPythonCommand();

    // Check PyMuPDF availability
    try {
      await new Promise((resolve, reject) => {
        const fitzCheck = spawn(this.pythonCmd, ['-c', 'import fitz; print(f"PyMuPDF v{fitz.VersionBind}")'], { stdio: 'pipe' });
        
        let output = '';
        fitzCheck.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        fitzCheck.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green(`   ✅ ${output.trim()}`));
            resolve();
          } else {
            reject(new Error('PyMuPDF not found'));
          }
        });
        
        fitzCheck.on('error', () => {
          reject(new Error('Failed to check PyMuPDF'));
        });
      });
    } catch (error) {
      throw new Error('PyMuPDF is required but not found. Please install with: pip install PyMuPDF');
    }

    // Check Node.js dependencies
    const requiredPackages = ['chrome-lens-ocr', 'fs-extra', 'chalk'];
    for (const pkg of requiredPackages) {
      try {
        await import(pkg);
        console.log(chalk.green(`   ✅ Node.js package: ${pkg}`));
      } catch (error) {
        throw new Error(`Required Node.js package missing: ${pkg}. Please run: npm install`);
      }
    }

    console.log(chalk.green('   ✅ All dependencies verified'));
    await this.logMessage('All dependencies verified successfully');
  }

  async checkForPDFs() {
    console.log(chalk.blue('📋 Step 1: Checking for PDF files...'));
    
    if (!await fs.pathExists(this.pdfInputDir)) {
      throw new Error(`PDF input directory does not exist: ${this.pdfInputDir}`);
    }

    const files = await fs.readdir(this.pdfInputDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      throw new Error(`No PDF files found in ${this.pdfInputDir}`);
    }

    console.log(chalk.green(`   Found ${pdfFiles.length} PDF file(s) to process`));
    await this.logMessage(`Found ${pdfFiles.length} PDF files to process`);
    
    // List the PDF files
    pdfFiles.forEach(file => {
      console.log(chalk.gray(`   - ${file}`));
    });
  }

  async convertPDFsToPNGs() {
    console.log(chalk.blue('\n📄 Step 2: Converting PDFs to PNGs (300 DPI)...'));
    await this.logMessage('Starting PDF to PNG conversion');

    // Clean up any previous completion flags
    const completionFlag = 'pdf_conversion_complete.flag';
    if (await fs.pathExists(completionFlag)) {
      await fs.remove(completionFlag);
    }

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonCmd, ['PDF_2_PNG.py'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let lastProgressUpdate = Date.now();

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Enhanced progress reporting
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) { // Throttle progress updates
          process.stdout.write(chalk.gray('   📄 Converting... '));
          lastProgressUpdate = now;
        }
        process.stdout.write(output);
      });

      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        
        // Enhanced error context
        if (error.toLowerCase().includes('error') || error.toLowerCase().includes('failed')) {
          process.stderr.write(chalk.red('   ❌ '));
        }
        process.stderr.write(chalk.yellow(error));
      });

      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          // Verify completion by checking for flag file
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            if (await fs.pathExists(completionFlag)) {
              const flagContent = await fs.readFile(completionFlag, 'utf8');
              console.log(chalk.green('   ✅ PDF conversion completed'));
              console.log(chalk.gray(`   ${flagContent.split('\n')[0]}`));
              await this.logMessage(`PDF to PNG conversion completed successfully: ${flagContent.trim()}`);
              
              // Verify output directory has files
              const outputExists = await fs.pathExists(this.pngOutputDir);
              if (outputExists) {
                const pngCount = await this.countFilesInDirectory(this.pngOutputDir, '.png');
                console.log(chalk.green(`   📊 Generated ${pngCount} PNG files`));
                await this.logMessage(`Generated ${pngCount} PNG files`);
              }
              
              resolve();
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          
          // Fallback if flag file not found but exit code is 0
          console.log(chalk.yellow('   ⚠️  PDF conversion completed but completion flag not found'));
          await this.logMessage('PDF conversion completed with warning: completion flag not found');
          resolve();
          
        } else {
          const errorMsg = `PDF conversion failed with exit code ${code}`;
          const fullError = stderr ? `${errorMsg}\nError output: ${stderr.trim()}` : errorMsg;
          await this.logMessage(fullError);
          
          // Provide specific error guidance
          if (stderr.includes('ModuleNotFoundError')) {
            reject(new Error(`${errorMsg}\n💡 Missing Python module. Install with: pip install PyMuPDF tqdm`));
          } else if (stderr.includes('PermissionError')) {
            reject(new Error(`${errorMsg}\n💡 Permission denied. Check file/folder permissions`));
          } else {
            reject(new Error(fullError));
          }
        }
      });

      pythonProcess.on('error', async (error) => {
        const errorMsg = `Failed to start PDF conversion: ${error.message}`;
        await this.logMessage(errorMsg);
        
        if (error.code === 'ENOENT') {
          reject(new Error(`${errorMsg}\n💡 Python not found in PATH. Please install Python 3.6+`));
        } else {
          reject(new Error(errorMsg));
        }
      });
    });
  }

  async runOCRProcessing() {
    console.log(chalk.blue('\n🔍 Step 3: Running Google Lens OCR processing...'));
    await this.logMessage('Starting OCR processing');

    // Pre-flight checks
    if (!await fs.pathExists(this.pngOutputDir)) {
      throw new Error(`PNG output directory not found: ${this.pngOutputDir}`);
    }

    // Count PNG files to set expectations
    const pngCount = await this.countFilesInDirectory(this.pngOutputDir, '.png');
    if (pngCount === 0) {
      throw new Error('No PNG files found for OCR processing. PDF conversion may have failed.');
    }

    console.log(chalk.gray(`   📊 Processing ${pngCount} PNG files...`));
    await this.logMessage(`Starting OCR processing of ${pngCount} PNG files`);

    return new Promise((resolve, reject) => {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const ocrProcess = spawn(npmCmd, ['start'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let lastProgressLine = '';

      ocrProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Enhanced progress tracking for OCR
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('✓') || line.includes('✗') || line.includes('%') || line.includes('Batch')) {
            lastProgressLine = line;
            process.stdout.write(chalk.gray('   🔍 '));
          }
        }
        process.stdout.write(output);
      });

      ocrProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        
        // Enhanced error context for OCR
        if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('429')) {
          process.stderr.write(chalk.yellow('   ⏳ Rate limiting detected - '));
        } else if (error.toLowerCase().includes('error')) {
          process.stderr.write(chalk.red('   ❌ OCR Error - '));
        }
        process.stderr.write(chalk.yellow(error));
      });

      ocrProcess.on('close', async (code) => {
        if (code === 0) {
          // Verify OCR results
          const txtExists = await fs.pathExists(this.textOutputDir);
          let txtCount = 0;
          let mergedCount = 0;
          
          if (txtExists) {
            txtCount = await this.countFilesInDirectory(this.textOutputDir, '.txt');
            mergedCount = await this.countMergedFiles();
          }

          console.log(chalk.green('   ✅ OCR processing completed'));
          console.log(chalk.gray(`   📊 Generated ${txtCount} text files, ${mergedCount} merged files`));
          await this.logMessage(`OCR processing completed successfully: ${txtCount} text files, ${mergedCount} merged files`);
          
          if (txtCount === 0) {
            console.log(chalk.yellow('   ⚠️  Warning: No text files were generated'));
            await this.logMessage('Warning: No text files were generated during OCR processing');
          }
          
          resolve();
        } else {
          const errorMsg = `OCR processing failed with exit code ${code}`;
          const fullError = stderr ? `${errorMsg}\nError details: ${stderr.trim()}` : errorMsg;
          await this.logMessage(fullError);
          
          // Provide specific OCR error guidance
          if (stderr.includes('chrome-lens-ocr')) {
            reject(new Error(`${errorMsg}\n💡 Chrome Lens OCR issue. Check internet connection and try again.`));
          } else if (stderr.includes('ECONNREFUSED') || stderr.includes('network')) {
            reject(new Error(`${errorMsg}\n💡 Network connection issue. Check internet connectivity.`));
          } else if (stderr.includes('rate limit') || stderr.includes('429')) {
            reject(new Error(`${errorMsg}\n💡 Rate limit exceeded. Wait a few minutes and try again.`));
          } else {
            reject(new Error(fullError));
          }
        }
      });

      ocrProcess.on('error', async (error) => {
        const errorMsg = `Failed to start OCR processing: ${error.message}`;
        await this.logMessage(errorMsg);
        
        if (error.code === 'ENOENT') {
          reject(new Error(`${errorMsg}\n💡 npm not found. Please install Node.js and npm.`));
        } else {
          reject(new Error(errorMsg));
        }
      });
    });
  }

  async generatePipelineSummary() {
    console.log(chalk.blue('\n📊 Step 4: Generating pipeline summary...'));
    
    const duration = (Date.now() - this.startTime) / 1000;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);

    // Count files in each stage
    const pdfCount = await this.countFilesInDirectory(this.pdfInputDir, '.pdf');
    const pngCount = await this.countFilesInDirectory(this.pngOutputDir, '.png');
    const txtCount = await this.countFilesInDirectory(this.textOutputDir, '.txt');
    const mergedCount = await this.countMergedFiles();

    // Calculate success metrics
    const pdfToPngSuccess = pngCount > 0 ? (pngCount >= pdfCount ? 100 : Math.round((pngCount / (pdfCount || 1)) * 100)) : 0;
    const pngToTxtSuccess = txtCount > 0 ? Math.round((txtCount / (pngCount || 1)) * 100) : 0;
    const overallSuccess = txtCount > 0 ? Math.round((txtCount / (pngCount || 1)) * 100) : 0;

    const summary = [
      '='.repeat(70),
      'PDF to TEXT PIPELINE - COMPLETION SUMMARY',
      '='.repeat(70),
      `⏱️  Execution Time: ${mins}m ${secs}s`,
      `📅 Completed: ${new Date().toISOString()}`,
      '',
      'PROCESSING RESULTS:',
      '-'.repeat(40),
      `📄 PDF Files Input: ${pdfCount}`,
      `🖼️  PNG Files Generated: ${pngCount} (${pdfToPngSuccess}% success rate)`,
      `📝 Text Files Created: ${txtCount} (${pngToTxtSuccess}% OCR success rate)`,
      `📋 Merged OCR Files: ${mergedCount}`,
      `🎯 Overall Success Rate: ${overallSuccess}%`,
      '',
      'QUALITY METRICS:',
      '-'.repeat(40),
      `📊 Image Resolution: 300 DPI (Fixed)`,
      `🔍 OCR Engine: Google Lens API`,
      `📁 Folder Structure: Preserved`,
      `🔗 File Linking: Complete`,
      '',
      'DIRECTORY PATHS:',
      '-'.repeat(40),
      `📂 Input PDFs: ${path.resolve(this.pdfInputDir)}`,
      `📂 Generated PNGs: ${path.resolve(this.pngOutputDir)}`,
      `📂 Extracted Text: ${path.resolve(this.textOutputDir)}`,
      '',
      'LOG FILES GENERATED:',
      '-'.repeat(40),
      `📋 Pipeline Log: ${this.logFile}`,
      `📄 PDF Conversion Log: logs/ConversionLog.txt`,
      `📊 OCR Verification: logs/report.txt`,
      '',
      overallSuccess >= 90 ? '🎉 PIPELINE COMPLETED SUCCESSFULLY!' : 
      overallSuccess >= 50 ? '⚠️  PIPELINE COMPLETED WITH WARNINGS' : 
      '❌ PIPELINE COMPLETED WITH ERRORS',
      '='.repeat(70)
    ].join('\n');

    console.log(chalk.cyan(summary));
    await this.logMessage(summary);
    
    // Write enhanced summary to file
    const summaryFile = 'PipelineSummary.txt';
    const detailedSummary = summary + '\n\n' + await this.generateDetailedReport();
    await fs.writeFile(summaryFile, detailedSummary, 'utf8');
    
    console.log(chalk.green(`\n📄 Detailed pipeline summary saved to: ${summaryFile}`));
    console.log(chalk.gray(`📋 Pipeline log saved to: ${this.logFile}`));

    // Show next steps
    if (overallSuccess >= 90) {
      console.log(chalk.green('\n🎯 Next Steps:'));
      console.log(chalk.gray('   • Review merged OCR files in 3_OCR_TXT_Files/'));
      console.log(chalk.gray('   • Check individual text files for accuracy'));
      console.log(chalk.gray('   • Archive or remove processed PDFs if desired'));
    } else if (overallSuccess >= 50) {
      console.log(chalk.yellow('\n⚠️  Attention Required:'));
      console.log(chalk.gray('   • Review failed conversions in logs'));
      console.log(chalk.gray('   • Check for rate limiting issues'));
      console.log(chalk.gray('   • Verify image quality of problematic PDFs'));
    } else {
      console.log(chalk.red('\n❌ Action Required:'));
      console.log(chalk.gray('   • Check error logs for specific issues'));
      console.log(chalk.gray('   • Verify internet connection for OCR'));
      console.log(chalk.gray('   • Consider re-running with smaller batches'));
    }
  }

  async countFilesInDirectory(dir, extension) {
    try {
      if (!await fs.pathExists(dir)) return 0;
      
      let count = 0;
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const subDir = path.join(dir, item.name);
          count += await this.countFilesInDirectory(subDir, extension);
        } else if (item.name.toLowerCase().endsWith(extension.toLowerCase())) {
          count++;
        }
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  async countMergedFiles() {
    try {
      return await this.countFilesInDirectory(this.textOutputDir, '_OCR.txt');
    } catch (error) {
      return 0;
    }
  }

  async generateDetailedReport() {
    try {
      const report = [
        'DETAILED PIPELINE ANALYSIS',
        '='.repeat(50),
        `Generated: ${new Date().toLocaleString()}`,
        '',
        'STAGE BREAKDOWN:',
        '-'.repeat(25)
      ];

      // Analyze PDF input stage
      if (await fs.pathExists(this.pdfInputDir)) {
        const pdfFiles = [];
        await this.collectFiles(this.pdfInputDir, '.pdf', pdfFiles);
        report.push('📄 PDF INPUT STAGE:');
        pdfFiles.slice(0, 10).forEach((file, i) => {
          report.push(`   ${i+1}. ${path.basename(file)}`);
        });
        if (pdfFiles.length > 10) {
          report.push(`   ... and ${pdfFiles.length - 10} more files`);
        }
        report.push('');
      }

      // Analyze PNG generation stage  
      if (await fs.pathExists(this.pngOutputDir)) {
        const pngFiles = [];
        await this.collectFiles(this.pngOutputDir, '.png', pngFiles);
        report.push('🖼️  PNG GENERATION STAGE:');
        report.push(`   Total PNG files: ${pngFiles.length}`);
        const samplePngs = pngFiles.slice(0, 5);
        samplePngs.forEach((file, i) => {
          report.push(`   ${i+1}. ${path.basename(file)}`);
        });
        report.push('');
      }

      // Analyze text extraction stage
      if (await fs.pathExists(this.textOutputDir)) {
        const txtFiles = [];
        const mergedFiles = [];
        await this.collectFiles(this.textOutputDir, '.txt', txtFiles);
        
        txtFiles.forEach(file => {
          if (file.includes('_OCR.txt')) {
            mergedFiles.push(file);
          }
        });

        report.push('📝 TEXT EXTRACTION STAGE:');
        report.push(`   Individual text files: ${txtFiles.length - mergedFiles.length}`);
        report.push(`   Merged OCR files: ${mergedFiles.length}`);
        
        if (mergedFiles.length > 0) {
          report.push('   Merged files created:');
          mergedFiles.forEach((file, i) => {
            report.push(`     • ${path.relative(this.textOutputDir, file)}`);
          });
        }
        report.push('');
      }

      report.push('PERFORMANCE NOTES:');
      report.push('-'.repeat(25));
      report.push('• PDF→PNG: PyMuPDF with 300 DPI fixed resolution');
      report.push('• PNG→Text: Google Lens OCR with rate limiting');
      report.push('• Text Merging: Automatic per-folder consolidation');
      report.push('• Error Recovery: Exponential backoff with retries');

      return report.join('\n');
    } catch (error) {
      return `Error generating detailed report: ${error.message}`;
    }
  }

  async collectFiles(directory, extension, results = []) {
    try {
      const items = await fs.readdir(directory);
      for (const item of items) {
        const fullPath = path.join(directory, item);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          await this.collectFiles(fullPath, extension, results);
        } else if (item.toLowerCase().endsWith(extension.toLowerCase())) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors in file collection
    }
    return results;
  }

  async logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      // Ensure logs directory exists
      await fs.ensureDir(path.dirname(this.logFile));
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not write to log file: ${error.message}`));
    }
  }
}

// Main execution
async function main() {
  const pipeline = new PDFToTextPipeline();
  await pipeline.run();
}

// Handle command line execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(error => {
    console.error(chalk.red('Pipeline failed:'), error);
    process.exit(1);
  });
}

export default PDFToTextPipeline;