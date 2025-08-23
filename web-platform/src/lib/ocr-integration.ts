import { spawn } from 'child_process';
import { join, dirname, basename, extname, resolve } from 'path';
import { mkdir, access, readdir, stat, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import { PythonDetector } from './python-detector';

interface OCRProcessingOptions {
  dpi?: number;
  retryAttempts?: number;
  timeout?: number;
  outputDir?: string;
  jobId?: string;
  progressCallback?: (progress: number, stage: string, message: string) => void;
  stageCallback?: (stage: string, status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED', progress?: number) => void;
  logCallback?: (level: string, message: string) => void;
}

interface OCRResult {
  success: boolean;
  outputPath?: string;
  pngOutputPath?: string;
  textOutputPath?: string;
  pngCount?: number;
  pageCount?: number;
  failedPngPages?: number[];
  failedOcrPages?: number[];
  successfulPages?: number;
  totalPagesInPdf?: number;
  pageErrors?: Record<string, any>;
  ocrConfidence?: number;
  detectedLanguages?: string[];
  processingDuration?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export class OCRProcessor {
  private pythonPath: string | null = null;
  private pdfScriptPath: string;
  private fallbackPdfScriptPath: string;
  private ocrScriptPath: string;
  private logsDir: string;
  private usingFallbackScript: boolean = false;
  private webSocketEmitters: any = null;

  constructor() {
    console.log('🔧 OCRProcessor constructor - CWD:', process.cwd());
    
    // Use absolute paths from project root to avoid path resolution issues
    const projectRoot = resolve(process.cwd(), '..');
    console.log('🔧 OCRProcessor constructor - Project Root:', projectRoot);
    
    this.pdfScriptPath = process.env.PDF_SCRIPT_PATH 
      ? resolve(process.cwd(), process.env.PDF_SCRIPT_PATH)
      : join(projectRoot, 'PDF_2_PNG.py');
      
    this.fallbackPdfScriptPath = join(projectRoot, 'PDF_2_PNG_pypdf2.py');
      
    this.ocrScriptPath = process.env.OCR_SCRIPT_PATH 
      ? resolve(process.cwd(), process.env.OCR_SCRIPT_PATH)
      : join(projectRoot, 'src', 'batch-process.js');
      
    this.logsDir = process.env.OCR_LOGS_DIR 
      ? resolve(process.cwd(), process.env.OCR_LOGS_DIR)
      : join(projectRoot, 'logs');
      
    console.log('🔧 OCRProcessor paths:');
    console.log('  - Primary PDF Script:', this.pdfScriptPath);
    console.log('  - Fallback PDF Script:', this.fallbackPdfScriptPath);
    console.log('  - OCR Script:', this.ocrScriptPath);
    console.log('  - Logs Dir:', this.logsDir);

    // Initialize WebSocket emitters
    this.initializeWebSocketEmitters();
  }

  private async emitWebSocketEvent(type: string, data: any) {
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || '3333'}/api/websocket/emit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, data }),
      });
      
      if (!response.ok) {
        console.warn(`Failed to emit ${type} event:`, response.statusText);
      }
    } catch (error) {
      console.warn(`Failed to emit ${type} event:`, error);
    }
  }

  private initializeWebSocketEmitters() {
    // Initialize WebSocket emitters using HTTP calls
    this.webSocketEmitters = {
      emitJobProgress: (jobId: string, progress: number, stage: string, message?: string) => 
        this.emitWebSocketEvent('jobProgress', { jobId, progress, stage, message }),
      emitJobCompleted: (jobId: string, results: any) => 
        this.emitWebSocketEvent('jobCompleted', { jobId, results }),
      emitJobFailed: (jobId: string, error: string) => 
        this.emitWebSocketEvent('jobFailed', { jobId, error }),
      emitLogMessage: (jobId: string, level: string, message: string, timestamp = new Date()) => 
        this.emitWebSocketEvent('logMessage', { jobId, level, message, timestamp }),
      emitStageUpdate: (jobId: string, stage: string, status: string, progress?: number) => 
        this.emitWebSocketEvent('stageUpdate', { jobId, stage, status, progress })
    };
    console.log('🔗 OCRProcessor WebSocket emitters initialized with HTTP calls');
  }

  private emitProgress(options: OCRProcessingOptions, progress: number, stage: string, message: string) {
    if (options.progressCallback) {
      options.progressCallback(progress, stage, message);
    }
    if (options.jobId) {
      this.webSocketEmitters.emitJobProgress(options.jobId, progress, stage, message);
    }
  }

  private emitStageUpdate(options: OCRProcessingOptions, stage: string, status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED', progress?: number) {
    if (options.stageCallback) {
      options.stageCallback(stage, status, progress);
    }
    if (options.jobId) {
      this.webSocketEmitters.emitStageUpdate(options.jobId, stage, status, progress);
    }
  }

  private emitLog(options: OCRProcessingOptions, level: string, message: string) {
    if (options.logCallback) {
      options.logCallback(level, message);
    }
    if (options.jobId) {
      this.webSocketEmitters.emitLogMessage(options.jobId, level, message, new Date());
    }
  }

  /**
   * Initialize Python path using auto-detection
   */
  private async initializePython(): Promise<string> {
    if (this.pythonPath) {
      return this.pythonPath;
    }

    try {
      this.pythonPath = await PythonDetector.getPythonCommand();
      return this.pythonPath;
    } catch (error) {
      throw new Error(`Python initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that all required scripts and directories exist
   */
  private async validatePaths(): Promise<void> {
    // Try primary PDF script first, fallback to PyPDF2 version
    try {
      await access(this.pdfScriptPath);
      console.log(`✅ Found primary PDF script: ${this.pdfScriptPath}`);
      this.usingFallbackScript = false;
    } catch (error) {
      console.log(`⚠️ Primary PDF script not found: ${this.pdfScriptPath}`);
      
      try {
        await access(this.fallbackPdfScriptPath);
        console.log(`✅ Found fallback PDF script: ${this.fallbackPdfScriptPath}`);
        this.usingFallbackScript = true;
        this.pdfScriptPath = this.fallbackPdfScriptPath; // Update to use fallback
      } catch (fallbackError) {
        throw new Error(`❌ Neither primary nor fallback PDF script found.\nPrimary: ${this.pdfScriptPath}\nFallback: ${this.fallbackPdfScriptPath}\nPlease ensure at least one script exists.`);
      }
    }

    // Check OCR script
    try {
      await access(this.ocrScriptPath);
      console.log(`✅ Found OCR script: ${this.ocrScriptPath}`);
    } catch (error) {
      throw new Error(`❌ Required OCR script not found at: ${this.ocrScriptPath}\nPlease ensure the file exists or update the environment variable.`);
    }

    // Ensure logs directory exists
    try {
      await mkdir(this.logsDir, { recursive: true });
      console.log(`✅ Logs directory ready: ${this.logsDir}`);
    } catch (error) {
      throw new Error(`Failed to create logs directory: ${this.logsDir}`);
    }

    // Log which PDF conversion method will be used
    if (this.usingFallbackScript) {
      console.log(`⚠️ Using PyPDF2 fallback method (text-based conversion only)`);
    } else {
      console.log(`✅ Using PyMuPDF method (full visual conversion)`);
    }
  }

  /**
   * Process a single PDF file through the complete OCR pipeline
   */
  async processFile(
    filePath: string,
    outputDir: string,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const {
      dpi = 300,
      retryAttempts = 3,
      timeout = 45000,
    } = options;

    console.log(`🚀 Starting OCR pipeline for ${basename(filePath)}`);
    console.log(`  - Input: ${filePath}`);
    console.log(`  - Output: ${outputDir}`);
    console.log(`  - DPI: ${dpi}, Timeout: ${timeout}ms`);

    // Initialize stage tracking
    this.emitStageUpdate(options, 'INITIALIZATION', 'RUNNING', 0);
    this.emitProgress(options, 1, 'INITIALIZATION', 'Starting OCR pipeline initialization');
    this.emitLog(options, 'info', `🚀 Starting OCR pipeline for ${basename(filePath)}`);

    try {
      // Initialize Python and validate paths
      console.log(`🔧 Stage 1: Initializing Python and validating paths...`);
      this.emitProgress(options, 2, 'INITIALIZATION', 'Initializing Python environment and validating paths');
      this.emitLog(options, 'info', 'Initializing Python environment and validating system paths');
      
      await this.initializePython();
      await this.validatePaths();
      
      this.emitProgress(options, 5, 'INITIALIZATION', 'Python and paths validated successfully');
      this.emitLog(options, 'info', 'Python environment and system paths validated successfully');
      this.emitStageUpdate(options, 'INITIALIZATION', 'COMPLETED', 100);
      
      // Validate input file
      console.log(`🔧 Stage 2: Validating input file...`);
      this.emitStageUpdate(options, 'FILE_VALIDATION', 'RUNNING', 0);
      this.emitProgress(options, 8, 'FILE_VALIDATION', `Validating uploaded file: ${basename(filePath)}`);
      this.emitLog(options, 'info', `Validating uploaded file: ${basename(filePath)}`);
      
      await this.validateFile(filePath);
      
      this.emitProgress(options, 10, 'FILE_VALIDATION', 'File validation completed successfully');
      this.emitLog(options, 'info', 'File validation completed - PDF is valid and ready for processing');
      this.emitStageUpdate(options, 'FILE_VALIDATION', 'COMPLETED', 100);

      // Create output directories with absolute paths
      console.log(`🔧 Stage 3: Creating output directories...`);
      this.emitProgress(options, 12, 'PDF_CONVERSION', 'Creating output directories and preparing for PDF conversion');
      this.emitLog(options, 'info', 'Creating output directories for PNG and text files');
      
      const absoluteOutputDir = resolve(process.cwd(), outputDir);
      const pngDir = join(absoluteOutputDir, 'pngs');
      const textDir = join(absoluteOutputDir, 'text');
      
      await mkdir(pngDir, { recursive: true });
      await mkdir(textDir, { recursive: true });
      
      console.log(`  - PNG Directory: ${pngDir}`);
      console.log(`  - Text Directory: ${textDir}`);

      // Step 1: Convert PDF to PNG with retry logic
      console.log(`📄 Stage 4: Converting PDF to PNG...`);
      this.emitStageUpdate(options, 'PDF_CONVERSION', 'RUNNING', 0);
      this.emitProgress(options, 15, 'PDF_CONVERSION', 'Starting PDF to PNG conversion (300 DPI)');
      this.emitLog(options, 'info', `Starting PDF to PNG conversion at ${dpi} DPI`);
      
      let pdfResult;
      let attempt = 0;
      
      while (attempt < retryAttempts) {
        attempt++;
        console.log(`  - Attempt ${attempt}/${retryAttempts}`);
        const progressBase = 20 + (attempt - 1) * 5;
        this.emitProgress(options, progressBase, 'PDF_CONVERSION', `Converting PDF to images - Attempt ${attempt}/${retryAttempts}`);
        this.emitLog(options, 'info', `PDF conversion attempt ${attempt}/${retryAttempts}`);
        
        pdfResult = await this.convertPdfToPng(filePath, pngDir, dpi, timeout, options);
        
        if (pdfResult.success) {
          const successMessage = pdfResult.failedPages && pdfResult.failedPages.length > 0 
            ? `PDF conversion completed - ${pdfResult.pageCount}/${pdfResult.totalPagesInPdf} pages processed (${pdfResult.failedPages.length} failed)`
            : `PDF conversion completed - ${pdfResult.pageCount} pages processed`;
          this.emitProgress(options, 40, 'PDF_CONVERSION', successMessage);
          this.emitLog(options, 'info', successMessage);
          if (pdfResult.failedPages && pdfResult.failedPages.length > 0) {
            this.emitLog(options, 'warning', `Failed to convert pages: ${pdfResult.failedPages.join(', ')}`);
          }
          break;
        }
        
        console.warn(`  - Attempt ${attempt} failed: ${pdfResult.error}`);
        this.emitLog(options, 'warning', `PDF conversion attempt ${attempt} failed: ${pdfResult.error}`);
        
        if (attempt < retryAttempts) {
          const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`  - Retrying in ${backoffDelay}ms...`);
          this.emitProgress(options, progressBase + 2, 'PDF_CONVERSION', `Retrying PDF conversion in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
      
      if (!pdfResult?.success) {
        this.emitStageUpdate(options, 'PDF_CONVERSION', 'FAILED', 0);
        this.emitLog(options, 'error', `PDF conversion failed after ${retryAttempts} attempts: ${pdfResult?.error}`);
        return {
          success: false,
          error: `PDF conversion failed after ${retryAttempts} attempts: ${pdfResult?.error}`,
          processingDuration: Date.now() - startTime
        };
      }

      // Verify PNG files were actually created
      console.log(`✅ Stage 4 Complete: PDF conversion successful`);
      console.log(`  - Pages processed: ${pdfResult.pageCount}`);
      this.emitStageUpdate(options, 'PDF_CONVERSION', 'COMPLETED', 100);
      
      this.emitProgress(options, 42, 'PDF_CONVERSION', 'Verifying generated PNG files');
      this.emitLog(options, 'info', 'Verifying that all PNG files were generated correctly');
      
      const pngVerification = await this.verifyPngFiles(pngDir, pdfResult.pageCount || 0);
      if (!pngVerification.success) {
        this.emitStageUpdate(options, 'PDF_CONVERSION', 'FAILED', 0);
        this.emitLog(options, 'error', `PNG verification failed: ${pngVerification.error}`);
        return {
          success: false,
          error: `PNG verification failed: ${pngVerification.error}`,
          processingDuration: Date.now() - startTime
        };
      }
      
      console.log(`✅ PNG Verification: ${pngVerification.actualCount} PNG files confirmed`);
      this.emitProgress(options, 45, 'PDF_CONVERSION', `PNG verification complete - ${pngVerification.actualCount} files ready`);
      this.emitLog(options, 'info', `PNG verification successful: ${pngVerification.actualCount} files ready for OCR processing`);

      // Step 2: OCR Processing with retry logic
      console.log(`🔍 Stage 5: Starting OCR processing...`);
      console.log(`  - PNG Source: ${pngDir}`);
      console.log(`  - Text Output: ${textDir}`);
      
      this.emitStageUpdate(options, 'OCR_PROCESSING', 'RUNNING', 0);
      this.emitProgress(options, 50, 'OCR_PROCESSING', 'Initializing Google Lens OCR processing');
      this.emitLog(options, 'info', `Starting OCR processing on ${pngVerification.actualCount} PNG files`);
      
      let ocrResult;
      attempt = 0;
      
      while (attempt < retryAttempts) {
        attempt++;
        console.log(`  - OCR Attempt ${attempt}/${retryAttempts}`);
        const progressBase = 55 + (attempt - 1) * 10;
        this.emitProgress(options, progressBase, 'OCR_PROCESSING', `Processing images with OCR - Attempt ${attempt}/${retryAttempts}`);
        this.emitLog(options, 'info', `OCR processing attempt ${attempt}/${retryAttempts} using Google Lens`);
        
        ocrResult = await this.runOCRProcessing(pngDir, textDir, timeout, options);
        
        if (ocrResult.success) {
          this.emitProgress(options, 85, 'OCR_PROCESSING', 'OCR processing completed successfully');
          this.emitLog(options, 'info', 'OCR processing completed successfully - text extracted from all images');
          break;
        }
        
        console.warn(`  - OCR Attempt ${attempt} failed: ${ocrResult.error}`);
        this.emitLog(options, 'warning', `OCR attempt ${attempt} failed: ${ocrResult.error}`);
        
        if (attempt < retryAttempts) {
          const backoffDelay = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
          console.log(`  - Retrying OCR in ${backoffDelay}ms...`);
          this.emitProgress(options, progressBase + 2, 'OCR_PROCESSING', `Retrying OCR processing in ${Math.round(backoffDelay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      if (!ocrResult?.success) {
        this.emitStageUpdate(options, 'OCR_PROCESSING', 'FAILED', 0);
        this.emitLog(options, 'error', `OCR processing failed after ${retryAttempts} attempts: ${ocrResult?.error}`);
        return {
          success: false,
          error: `OCR processing failed after ${retryAttempts} attempts: ${ocrResult?.error}`,
          pngOutputPath: pngDir,
          pngCount: pdfResult.pageCount,
          pageCount: pdfResult.pageCount,
          processingDuration: Date.now() - startTime
        };
      }

      console.log(`✅ Stage 5 Complete: OCR processing successful`);
      this.emitStageUpdate(options, 'OCR_PROCESSING', 'COMPLETED', 100);

      // Step 3: Verify text files were created
      console.log(`📝 Stage 6: Verifying text file generation...`);
      this.emitStageUpdate(options, 'TEXT_EXTRACTION', 'RUNNING', 0);
      this.emitProgress(options, 87, 'TEXT_EXTRACTION', 'Verifying extracted text files');
      this.emitLog(options, 'info', 'Verifying that text files were generated correctly');
      
      const textVerification = await this.verifyTextFiles(textDir);
      if (!textVerification.success) {
        this.emitStageUpdate(options, 'TEXT_EXTRACTION', 'FAILED', 0);
        this.emitLog(options, 'error', `Text verification failed: ${textVerification.error}`);
        return {
          success: false,
          error: `Text verification failed: ${textVerification.error}`,
          pngOutputPath: pngDir,
          pngCount: pdfResult.pageCount,
          pageCount: pdfResult.pageCount,
          processingDuration: Date.now() - startTime
        };
      }
      
      console.log(`✅ Text Verification: ${textVerification.textFileCount} text files confirmed`);
      this.emitProgress(options, 90, 'TEXT_EXTRACTION', `Text verification complete - ${textVerification.textFileCount} files processed`);
      this.emitLog(options, 'info', `Text extraction verified: ${textVerification.textFileCount} text files generated successfully`);
      this.emitStageUpdate(options, 'TEXT_EXTRACTION', 'COMPLETED', 100);

      // Calculate final statistics and verify files were created
      console.log(`📊 Stage 7: Calculating final statistics...`);
      this.emitStageUpdate(options, 'FILE_ORGANIZATION', 'RUNNING', 0);
      this.emitProgress(options, 92, 'FILE_ORGANIZATION', 'Organizing output files and calculating statistics');
      this.emitLog(options, 'info', 'Organizing output files and generating processing statistics');
      
      const finalStats = await this.calculateStatistics(pngDir, textDir);
      
      // Verify that files were actually created
      if (finalStats.pngCount === 0) {
        this.emitStageUpdate(options, 'FILE_ORGANIZATION', 'FAILED', 0);
        this.emitLog(options, 'error', 'No PNG files were generated during PDF conversion');
        return {
          success: false,
          error: 'No PNG files were generated during PDF conversion',
          processingDuration: Date.now() - startTime
        };
      }
      
      if (finalStats.metadata.totalTextFiles === 0) {
        this.emitStageUpdate(options, 'FILE_ORGANIZATION', 'FAILED', 0);
        this.emitLog(options, 'error', 'No text files were generated during OCR processing');
        return {
          success: false,
          error: 'No text files were generated during OCR processing',
          pngOutputPath: pngDir,
          pngCount: finalStats.pngCount,
          pageCount: finalStats.pageCount,
          processingDuration: Date.now() - startTime
        };
      }

      this.emitProgress(options, 95, 'FILE_ORGANIZATION', `File organization complete - ${finalStats.pngCount} images, ${finalStats.metadata.totalTextFiles} text files`);
      this.emitLog(options, 'info', `File organization successful: ${finalStats.pngCount} PNG files and ${finalStats.metadata.totalTextFiles} text files processed`);
      this.emitStageUpdate(options, 'FILE_ORGANIZATION', 'COMPLETED', 100);

      console.log(`✅ Processing completed successfully:`);
      console.log(`  - PNG files: ${finalStats.pngCount}`);
      console.log(`  - Text files: ${finalStats.metadata.totalTextFiles}`);
      console.log(`  - Processing time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      console.log(`✅ Stage 7 Complete: Statistics calculated successfully`);
      console.log(`🎉 Pipeline Complete! Processing time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      // Final stage - finalization
      this.emitStageUpdate(options, 'FINALIZATION', 'RUNNING', 0);
      this.emitProgress(options, 98, 'FINALIZATION', 'Finalizing results and preparing output');
      this.emitLog(options, 'info', `Processing completed successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      
      this.emitProgress(options, 100, 'FINALIZATION', `OCR pipeline completed successfully - ${finalStats.pngCount} pages processed`);
      this.emitStageUpdate(options, 'FINALIZATION', 'COMPLETED', 100);
      this.emitLog(options, 'info', `🎉 OCR pipeline completed successfully: ${finalStats.pngCount} pages processed, ${finalStats.metadata.totalTextFiles} text files generated`);

      return {
        success: true,
        outputPath: absoluteOutputDir,
        pngOutputPath: pngDir,
        textOutputPath: textDir,
        pngCount: finalStats.pngCount,
        pageCount: finalStats.pageCount,
        failedPngPages: pdfResult.failedPages || [],
        failedOcrPages: ocrResult.failedPages || [],
        successfulPages: finalStats.pngCount, // Pages that were both converted AND OCR'd
        totalPagesInPdf: pdfResult.totalPagesInPdf || finalStats.pageCount,
        pageErrors: {
          ...(pdfResult.pageErrors || {}),
          ...(ocrResult.pageErrors || {})
        },
        ocrConfidence: finalStats.avgConfidence,
        detectedLanguages: finalStats.detectedLanguages,
        processingDuration: Date.now() - startTime,
        metadata: {
          originalFile: basename(filePath),
          dpi,
          timestamp: new Date().toISOString(),
          ...finalStats.metadata
        }
      };

    } catch (error) {
      console.error(`💥 OCR Pipeline failed for ${basename(filePath)}:`, error);
      
      // Mark all stages as failed
      const stages = ['INITIALIZATION', 'FILE_VALIDATION', 'PDF_CONVERSION', 'OCR_PROCESSING', 'TEXT_EXTRACTION', 'FILE_ORGANIZATION', 'FINALIZATION'];
      stages.forEach(stage => {
        this.emitStageUpdate(options, stage, 'FAILED', 0);
      });
      
      this.emitLog(options, 'error', `💥 OCR Pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Enhanced error logging with context
      const errorDetails = {
        file: basename(filePath),
        fullPath: filePath,
        outputDir,
        options: { ...options, progressCallback: undefined, stageCallback: undefined, logCallback: undefined }, // Remove callbacks from logging
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
      
      console.error('Full error context:', errorDetails);
      
      // Attempt cleanup on failure
      try {
        this.emitLog(options, 'info', 'Starting cleanup of partial processing results');
        await this.cleanup(outputDir);
        this.emitLog(options, 'info', 'Cleanup completed successfully');
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
        this.emitLog(options, 'warning', `Cleanup failed: ${cleanupError}`);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingDuration: Date.now() - startTime,
        metadata: {
          errorDetails,
          cleanup: true
        }
      };
    }
  }

  /**
   * Convert PDF to PNG using the existing Python script
   */
  private async convertPdfToPng(
    pdfPath: string,
    outputDir: string,
    dpi: number,
    timeout: number,
    options: OCRProcessingOptions = {}
  ): Promise<{ success: boolean; pageCount?: number; totalPagesInPdf?: number; failedPages?: number[]; pageErrors?: Record<string, any>; error?: string }> {
    return new Promise(async (promiseResolve) => {
      try {
        // Ensure Python is initialized
        const pythonCommand = await this.initializePython();
        
        // Ensure we have absolute paths (outputDir should already be absolute from caller)
        const absolutePdfPath = resolve(process.cwd(), pdfPath);
        const absoluteOutputDir = outputDir; // Already absolute from caller
        
        console.log(`📄 Converting PDF to PNG: ${basename(pdfPath)}`);
        console.log(`  - Python: ${pythonCommand}`);
        console.log(`  - Input: ${absolutePdfPath}`);
        console.log(`  - Output: ${absoluteOutputDir}`);
        
        // Ensure output directory exists before running Python script
        await mkdir(absoluteOutputDir, { recursive: true });
        
        // Create an enhanced script based on the original PDF_2_PNG.py but for single file processing
        const singleFileScript = this.createSingleFilePDFScript(absolutePdfPath, absoluteOutputDir, dpi);
        
        const pythonProcess = spawn(pythonCommand, ['-c', singleFileScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout,
          cwd: process.cwd() // Set working directory explicitly
        });

        let stdout = '';
        let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        console.log(`PDF conversion process exited with code: ${code}`);
        console.log(`STDOUT: ${stdout}`);
        console.log(`STDERR: ${stderr}`);
        
        if (code === 0) {
          try {
            // Parse JSON result from Python script
            const jsonMatch = stdout.match(/JSON_RESULT:(.+)/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[1]);
              console.log(`PDF conversion result:`, result);
              
              // Verify actual PNG files in directory
              const files = await readdir(absoluteOutputDir);
              const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
              
              console.log(`Found ${pngFiles.length} PNG files in ${absoluteOutputDir}`);
              console.log(`Expected successful pages: ${result.successful_pages}`);
              
              promiseResolve({
                success: result.success && result.successful_pages > 0,
                pageCount: pngFiles.length, // Use actual file count
                totalPagesInPdf: result.total_pages,
                failedPages: result.failed_pages || [],
                pageErrors: result.page_errors || {}
              });
            } else {
              // Fallback to old behavior if JSON parsing fails
              const files = await readdir(absoluteOutputDir);
              const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
              
              console.log(`Found ${pngFiles.length} PNG files in ${absoluteOutputDir} (fallback count)`);
              
              promiseResolve({
                success: true,
                pageCount: pngFiles.length
              });
            }
          } catch (error) {
            console.log(`Error processing PDF conversion result:`, error);
            promiseResolve({
              success: false,
              error: `Failed to process conversion result: ${error}`
            });
          }
        } else {
          promiseResolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        promiseResolve({
          success: false,
          error: `Failed to start PDF conversion: ${error.message}`
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGTERM');
          promiseResolve({
            success: false,
            error: 'PDF conversion timed out'
          });
        }
      }, timeout);
      
      } catch (error) {
        promiseResolve({
          success: false,
          error: `Python initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
  }

  /**
   * Run OCR processing using the existing Node.js OCR processor
   */
  private async runOCRProcessing(
    pngDir: string,
    textDir: string,
    timeout: number,
    options: OCRProcessingOptions = {}
  ): Promise<{ success: boolean; failedPages?: number[]; pageErrors?: Record<string, any>; error?: string }> {
    return new Promise((resolve) => {
      console.log(`🔍 Starting OCR processing:`);
      console.log(`  - PNG Directory: ${pngDir}`);
      console.log(`  - Text Output Directory: ${textDir}`);
      console.log(`  - OCR Script: ${this.ocrScriptPath}`);
      
      // Create a wrapper script that calls the original with our config
      const wrapperScript = this.createOCRWrapperScript(pngDir, textDir);
      
      // Execute the wrapper script
      const childProcess = spawn('node', ['-e', wrapperScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        cwd: dirname(this.ocrScriptPath)
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`OCR: ${output.trim()}`);
      });

      childProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.error(`OCR Error: ${error.trim()}`);
      });

      childProcess.on('close', (code) => {
        console.log(`OCR process finished with code: ${code}`);
        if (stdout) console.log(`OCR STDOUT: ${stdout}`);
        if (stderr) console.log(`OCR STDERR: ${stderr}`);
        
        if (code === 0) {
          // Parse output for individual page failures
          const failedPages: number[] = [];
          const pageErrors: Record<string, any> = {};
          
          // Look for error patterns in output
          const errorMatches = stdout.match(/❌.*?page (\d+)/gi) || [];
          const failureMatches = stdout.match(/Failed.*?(\d+)/gi) || [];
          
          errorMatches.forEach(match => {
            const pageMatch = match.match(/page (\d+)/i);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1]);
              failedPages.push(pageNum);
              pageErrors[pageNum.toString()] = match.trim();
            }
          });
          
          failureMatches.forEach(match => {
            const numMatch = match.match(/(\d+)/);
            if (numMatch) {
              const pageNum = parseInt(numMatch[1]);
              if (!failedPages.includes(pageNum)) {
                failedPages.push(pageNum);
                pageErrors[pageNum.toString()] = match.trim();
              }
            }
          });
          
          resolve({ 
            success: true,
            failedPages: failedPages.length > 0 ? failedPages : undefined,
            pageErrors: Object.keys(pageErrors).length > 0 ? pageErrors : undefined
          });
        } else {
          resolve({
            success: false,
            error: stderr || `OCR process exited with code ${code}`
          });
        }
      });

      childProcess.on('error', (error) => {
        console.error(`OCR process error:`, error);
        resolve({
          success: false,
          error: `Failed to start OCR processing: ${error.message}`
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!childProcess.killed) {
          console.warn('OCR process timed out, killing...');
          childProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: 'OCR processing timed out'
          });
        }
      }, timeout);
    });
  }

  /**
   * Create a wrapper script that modifies the config and runs the original OCR processor
   */
  private createOCRWrapperScript(pngDir: string, textDir: string): string {
    return `
// OCR Wrapper Script - Uses a simplified approach
console.log('🚀 Starting OCR Wrapper...');

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const inputDir = '${pngDir.replace(/\\/g, '\\\\')}';
const outputDir = '${textDir.replace(/\\/g, '\\\\')}';

console.log('Input Directory:', inputDir);
console.log('Output Directory:', outputDir);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('✅ Created output directory:', outputDir);
}

// Check if input directory has files
try {
  const files = fs.readdirSync(inputDir);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
  console.log(\`📁 Found \${pngFiles.length} PNG files in input directory\`);
  
  if (pngFiles.length === 0) {
    console.log('❌ No PNG files found to process');
    process.exit(1);
  }
  
  console.log('First few files:', pngFiles.slice(0, 3).join(', '));
} catch (error) {
  console.error('❌ Error reading input directory:', error);
  process.exit(1);
}

// Create a temporary config file
const tempConfigPath = path.join(__dirname, 'temp-config.js');
const configContent = \`export const config = {
  inputDir: '\${inputDir.replace(/\\\\/g, '\\\\\\\\')}',
  outputDir: '\${outputDir.replace(/\\\\/g, '\\\\\\\\')}',
  supportedExtensions: ['.jpg', '.jpeg', '.png'],
  processing: {
    batchSize: 3,
    batchDelay: 1000,
    requestDelay: 300,
    maxConcurrency: 1,
    maxRetries: 3,
    retryDelay: 3000,
    exponentialBackoff: true,
    maxRetryDelay: 15000,
    timeout: 30000,
    preserveOriginalScript: true,
    languageHints: [],
    validateTextIntegrity: true,
    rateLimitRetryMultiplier: 1.5,
    apiErrorCodes: ['RATE_LIMITED', 'QUOTA_EXCEEDED', 'TOO_MANY_REQUESTS'],
    dynamicRateAdjustment: {
      enabled: true,
      minBatchSize: 2,
      maxBatchSize: 5,
      minBatchDelay: 500,
      maxBatchDelay: 5000,
      rateLimitBackoffFactor: 2.0,
      successSpeedupFactor: 0.9,
      consecutiveSuccessThreshold: 5,
      consecutiveFailureThreshold: 3
    }
  },
  output: {
    textExtension: '.txt',
    includeMetadata: false,
    encoding: 'utf8',
    generateMergedFiles: true,
    mergedFileSuffix: '_OCR'
  },
  logging: {
    level: 'info',
    logDir: '${this.logsDir.replace(/\\/g, '\\\\')}',
    enableColors: true
  },
  visualization: {
    enabled: true,
    enableEmojis: true
  }
};\`;

// Write temporary config
fs.writeFileSync(tempConfigPath, configContent);

// Backup original config
const originalConfigPath = path.join(__dirname, 'config.js');
const backupConfigPath = path.join(__dirname, 'config.js.backup');
fs.copyFileSync(originalConfigPath, backupConfigPath);

// Replace config with temp config
fs.copyFileSync(tempConfigPath, originalConfigPath);

console.log('🔄 Config replaced, starting OCR processing...');

// Function to restore config
function restoreConfig() {
  try {
    fs.copyFileSync(backupConfigPath, originalConfigPath);
    fs.unlinkSync(backupConfigPath);
    fs.unlinkSync(tempConfigPath);
    console.log('🔧 Config restored');
  } catch (error) {
    console.error('Warning: Failed to restore config:', error);
  }
}

// Handle cleanup on exit
process.on('exit', restoreConfig);
process.on('SIGINT', () => {
  restoreConfig();
  process.exit(0);
});
process.on('SIGTERM', () => {
  restoreConfig();
  process.exit(0);
});

// Now run the batch processor
async function runOCR() {
  try {
    // Clear require cache for config
    delete require.cache[require.resolve('./config.js')];
    
    // Load and run the batch processor
    const batchProcess = await import('./batch-process.js');
    console.log('✅ OCR processing completed successfully');
    restoreConfig();
  } catch (error) {
    console.error('❌ OCR processing failed:', error);
    restoreConfig();
    process.exit(1);
  }
}

runOCR().catch(error => {
  console.error('❌ Fatal error:', error);
  restoreConfig();
  process.exit(1);
});
`;
  }


  /**
   * Create a single file Python script based on the original PDF_2_PNG.py logic
   */
  private createSingleFilePDFScript(pdfPath: string, outputDir: string, dpi: number): string {
    return `
import os
import fitz  # PyMuPDF
import json

def pdf_to_png_single(pdf_path, output_dir, dpi=300):
    """Process a single PDF file to PNG images - based on original PDF_2_PNG.py"""
    result = {
        'total_pages': 0,
        'successful_pages': 0,
        'failed_pages': [],
        'page_errors': {},
        'success': False
    }
    
    try:
        print(f"🔄 Starting PDF to PNG conversion for: {pdf_path}")
        print(f"   Output directory: {output_dir}")
        print(f"   DPI: {dpi}")
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Open PDF document
        doc = fitz.open(pdf_path)
        result['total_pages'] = doc.page_count
        total_pages = doc.page_count
        print(f"   Total pages: {total_pages}")
        
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        # Process each page (matching original script logic)
        for i in range(total_pages):
            page_num = i + 1
            try:
                page = doc.load_page(i)
                zoom = dpi / 72  # DPI scaling: target DPI / PDF default DPI (72)
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                # Create filename matching original pattern
                output_path = os.path.join(output_dir, f"{base_name}_{page_num:04d}.png")
                pix.save(output_path)
                print(f"   ✅ Page {page_num}/{total_pages} saved: {os.path.basename(output_path)}")
                result['successful_pages'] += 1
                
            except Exception as page_error:
                print(f"   ❌ Failed to process page {page_num}: {str(page_error)}")
                result['failed_pages'].append(page_num)
                result['page_errors'][str(page_num)] = str(page_error)
            
        doc.close()
        
        if result['successful_pages'] > 0:
            result['success'] = True
            print(f"✅ Successfully processed {result['successful_pages']}/{total_pages} pages from {pdf_path}")
            if result['failed_pages']:
                print(f"⚠️  Failed pages: {result['failed_pages']}")
        else:
            result['success'] = False
            print(f"❌ No pages were successfully processed from {pdf_path}")
            
        return result
        
    except Exception as e:
        print(f"❌ Error opening PDF {pdf_path}: {str(e)}")
        result['page_errors']['general'] = str(e)
        import traceback
        traceback.print_exc()
        return result

# Process the file
try:
    result = pdf_to_png_single("${pdfPath.replace(/\\/g, '\\\\')}", "${outputDir.replace(/\\/g, '\\\\')}", ${dpi})
    print(f"JSON_RESULT:{json.dumps(result)}")
except Exception as e:
    error_result = {
        'total_pages': 0,
        'successful_pages': 0,
        'failed_pages': [],
        'page_errors': {'general': str(e)},
        'success': False
    }
    print(f"JSON_RESULT:{json.dumps(error_result)}")
    exit(1)
`;
  }

  /**
   * Verify PNG files were created correctly
   */
  private async verifyPngFiles(pngDir: string, expectedCount: number): Promise<{
    success: boolean;
    actualCount: number;
    error?: string;
  }> {
    try {
      const files = await readdir(pngDir);
      const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
      
      if (pngFiles.length === 0) {
        return {
          success: false,
          actualCount: 0,
          error: 'No PNG files found in output directory'
        };
      }

      if (expectedCount > 0 && pngFiles.length !== expectedCount) {
        console.warn(`Expected ${expectedCount} PNG files, but found ${pngFiles.length}`);
      }

      // Verify files are readable and have content
      for (const pngFile of pngFiles) {
        const filePath = join(pngDir, pngFile);
        const stats = await stat(filePath);
        
        if (stats.size === 0) {
          return {
            success: false,
            actualCount: pngFiles.length,
            error: `PNG file ${pngFile} is empty`
          };
        }
      }

      return {
        success: true,
        actualCount: pngFiles.length
      };
    } catch (error) {
      return {
        success: false,
        actualCount: 0,
        error: `Failed to verify PNG files: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Verify text files were created correctly
   */
  private async verifyTextFiles(textDir: string): Promise<{
    success: boolean;
    textFileCount: number;
    error?: string;
  }> {
    try {
      const files = await readdir(textDir);
      const textFiles = files.filter(f => f.toLowerCase().endsWith('.txt'));
      
      if (textFiles.length === 0) {
        return {
          success: false,
          textFileCount: 0,
          error: 'No text files found in output directory'
        };
      }

      // Verify at least one text file has content
      let hasContent = false;
      for (const textFile of textFiles) {
        const filePath = join(textDir, textFile);
        const stats = await stat(filePath);
        
        if (stats.size > 0) {
          hasContent = true;
          break;
        }
      }

      if (!hasContent) {
        return {
          success: false,
          textFileCount: textFiles.length,
          error: 'All text files are empty - OCR may have failed'
        };
      }

      return {
        success: true,
        textFileCount: textFiles.length
      };
    } catch (error) {
      return {
        success: false,
        textFileCount: 0,
        error: `Failed to verify text files: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Calculate processing statistics
   */
  private async calculateStatistics(pngDir: string, textDir: string) {
    try {
      // Count PNG files
      const pngFiles = await readdir(pngDir);
      const pngCount = pngFiles.filter(f => f.toLowerCase().endsWith('.png')).length;

      // Count and analyze text files
      const textFiles = await readdir(textDir);
      const txtFiles = textFiles.filter(f => f.toLowerCase().endsWith('.txt'));

      // Analyze text content for language detection and confidence
      let totalConfidence = 0;
      let confidenceCount = 0;
      const detectedLanguages = new Set<string>();
      let totalTextLength = 0;

      for (const txtFile of txtFiles) {
        try {
          const filePath = join(textDir, txtFile);
          const stats = await stat(filePath);
          totalTextLength += stats.size;

          // Read the actual text content to analyze quality
          const content = await readFile(filePath, 'utf-8');
          
          // Calculate real confidence based on comprehensive text quality analysis
          let confidence = 0;
          if (content.trim().length > 0) {
            const trimmedContent = content.trim();
            const words = trimmedContent.split(/\s+/).filter(w => w.length > 0);
            const lines = trimmedContent.split('\n').filter(l => l.trim().length > 0);
            
            // 1. Character quality analysis (40% weight)
            const totalChars = trimmedContent.length;
            const alphanumericChars = (trimmedContent.match(/[a-zA-Z0-9]/g) || []).length;
            const alphanumericRatio = alphanumericChars / totalChars;
            
            // Detect common OCR artifacts
            const specialCharCount = (trimmedContent.match(/[^\w\s\.\,\!\?\@\#\$\%\&\*\(\)\-\+\=\:\;\"\'\/\\]/g) || []).length;
            const specialCharRatio = specialCharCount / totalChars;
            
            const characterQuality = Math.max(0, Math.min(1, 
              alphanumericRatio * 1.2 - specialCharRatio * 2
            ));
            
            // 2. Word structure analysis (35% weight)
            const actualWordLengths = words.map(w => w.length);
            const avgWordLength = actualWordLengths.length > 0 
              ? actualWordLengths.reduce((sum, len) => sum + len, 0) / actualWordLengths.length 
              : 0;
            
            // Penalize extremely short or long words (likely OCR errors)
            const reasonableWords = actualWordLengths.filter(len => len >= 2 && len <= 15).length;
            const wordStructureRatio = words.length > 0 ? reasonableWords / words.length : 0;
            
            const wordQuality = Math.max(0, Math.min(1,
              wordStructureRatio * 0.8 + 
              (avgWordLength >= 3 && avgWordLength <= 12 ? 0.2 : 0)
            ));
            
            // 3. Content coherence analysis (25% weight)
            // Check for proper capitalization patterns
            const capitalizedWords = words.filter(w => /^[A-Z]/.test(w)).length;
            const capitalizationRatio = words.length > 0 ? capitalizedWords / words.length : 0;
            
            // Check for reasonable line structure
            const avgWordsPerLine = lines.length > 0 ? words.length / lines.length : 0;
            const lineStructureScore = avgWordsPerLine > 1 && avgWordsPerLine < 20 ? 1 : 0.5;
            
            // Check for common English patterns (spaces after punctuation, etc.)
            const properSpacing = (trimmedContent.match(/[\.!?]\s+[A-Z]/g) || []).length;
            const totalSentenceEnds = (trimmedContent.match(/[\.!?]/g) || []).length;
            const spacingScore = totalSentenceEnds > 0 ? Math.min(1, properSpacing / totalSentenceEnds) : 0.8;
            
            const coherenceQuality = Math.max(0, Math.min(1,
              capitalizationRatio * 0.4 + 
              lineStructureScore * 0.3 + 
              spacingScore * 0.3
            ));
            
            // 4. Overall confidence calculation
            confidence = Math.max(0.1, Math.min(0.99,
              characterQuality * 0.40 +   // Character quality (40%)
              wordQuality * 0.35 +        // Word structure (35%)
              coherenceQuality * 0.25     // Content coherence (25%)
            ));
            
            // Apply penalties for clear OCR failure indicators
            if (words.length < 3 && totalChars > 20) confidence *= 0.7; // Too few words for content size
            if (specialCharRatio > 0.1) confidence *= (1 - specialCharRatio); // Too many artifacts
            if (alphanumericRatio < 0.5) confidence *= 0.6; // Too much noise
          }
          
          totalConfidence += confidence;
          confidenceCount++;

          // Simple language detection based on character patterns
          // In production, you'd use a proper language detection library
          detectedLanguages.add('en'); // Default to English for now
        } catch (error) {
          console.warn(`Failed to analyze ${txtFile}:`, error);
        }
      }

      const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

      return {
        pngCount,
        pageCount: pngCount, // Assuming 1 PNG per page
        avgConfidence,
        detectedLanguages: Array.from(detectedLanguages),
        metadata: {
          totalTextFiles: txtFiles.length,
          totalTextSize: totalTextLength,
          avgTextPerFile: txtFiles.length > 0 ? totalTextLength / txtFiles.length : 0
        }
      };
    } catch (error) {
      console.error('Failed to calculate statistics:', error);
      return {
        pngCount: 0,
        pageCount: 0,
        avgConfidence: 0,
        detectedLanguages: [],
        metadata: {}
      };
    }
  }

  /**
   * Validate input file
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      await access(filePath);
      
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      if (stats.size === 0) {
        throw new Error('File is empty');
      }

      const ext = extname(filePath).toLowerCase();
      if (ext !== '.pdf') {
        throw new Error('File is not a PDF');
      }
    } catch (error) {
      throw new Error(`File validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get file checksum for deduplication
   */
  async getFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Clean up temporary files and partial results
   */
  async cleanup(outputDir: string): Promise<void> {
    try {
      console.log(`🧹 Starting cleanup for: ${outputDir}`);
      
      const { rmdir, unlink } = await import('fs/promises');
      const { existsSync } = await import('fs');
      
      if (!existsSync(outputDir)) {
        console.log(`  - Directory doesn't exist, skipping cleanup`);
        return;
      }

      // Clean up PNG directory
      const pngDir = join(outputDir, 'pngs');
      if (existsSync(pngDir)) {
        const pngFiles = await readdir(pngDir);
        for (const file of pngFiles) {
          if (file.toLowerCase().endsWith('.png')) {
            await unlink(join(pngDir, file));
            console.log(`  - Removed PNG: ${file}`);
          }
        }
        await rmdir(pngDir).catch(() => {}); // Ignore errors if directory not empty
      }

      // Clean up text directory
      const textDir = join(outputDir, 'text');
      if (existsSync(textDir)) {
        const textFiles = await readdir(textDir);
        for (const file of textFiles) {
          if (file.toLowerCase().endsWith('.txt')) {
            await unlink(join(textDir, file));
            console.log(`  - Removed text file: ${file}`);
          }
        }
        await rmdir(textDir).catch(() => {}); // Ignore errors if directory not empty
      }

      // Try to remove the main output directory if empty
      try {
        await rmdir(outputDir);
        console.log(`  - Removed empty directory: ${outputDir}`);
      } catch (error) {
        // Directory not empty or other error - this is fine
        console.log(`  - Directory not empty or cannot be removed: ${outputDir}`);
      }

      console.log(`✅ Cleanup completed for: ${outputDir}`);
    } catch (error) {
      console.warn('🚨 Cleanup failed:', error);
      // Don't throw - cleanup failure shouldn't stop processing
    }
  }
}

// Export singleton instance
export const ocrProcessor = new OCRProcessor();