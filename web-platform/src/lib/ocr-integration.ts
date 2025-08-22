import { spawn } from 'child_process';
import { join, dirname, basename, extname, resolve } from 'path';
import { mkdir, access, readdir, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import { PythonDetector } from './python-detector';

interface OCRProcessingOptions {
  dpi?: number;
  retryAttempts?: number;
  timeout?: number;
  outputDir?: string;
}

interface OCRResult {
  success: boolean;
  outputPath?: string;
  pngOutputPath?: string;
  textOutputPath?: string;
  pngCount?: number;
  pageCount?: number;
  ocrConfidence?: number;
  detectedLanguages?: string[];
  processingDuration?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export class OCRProcessor {
  private pythonPath: string | null = null;
  private pdfScriptPath: string;
  private ocrScriptPath: string;
  private logsDir: string;

  constructor() {
    // Use absolute paths from project root to avoid path resolution issues
    const projectRoot = resolve(process.cwd(), '..');
    
    this.pdfScriptPath = process.env.PDF_SCRIPT_PATH 
      ? resolve(process.cwd(), process.env.PDF_SCRIPT_PATH)
      : join(projectRoot, 'PDF_2_PNG.py');
      
    this.ocrScriptPath = process.env.OCR_SCRIPT_PATH 
      ? resolve(process.cwd(), process.env.OCR_SCRIPT_PATH)
      : join(projectRoot, 'src', 'batch-process.js');
      
    this.logsDir = process.env.OCR_LOGS_DIR 
      ? resolve(process.cwd(), process.env.OCR_LOGS_DIR)
      : join(projectRoot, 'logs');
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
    const pathsToCheck = [
      { path: this.pdfScriptPath, name: 'PDF_2_PNG.py script' },
      { path: this.ocrScriptPath, name: 'batch-process.js script' },
    ];

    for (const { path, name } of pathsToCheck) {
      try {
        await access(path);
        console.log(`✅ Found ${name}: ${path}`);
      } catch (error) {
        throw new Error(`❌ Required ${name} not found at: ${path}\nPlease ensure the file exists or update the environment variable.`);
      }
    }

    // Ensure logs directory exists
    try {
      await mkdir(this.logsDir, { recursive: true });
      console.log(`✅ Logs directory ready: ${this.logsDir}`);
    } catch (error) {
      throw new Error(`Failed to create logs directory: ${this.logsDir}`);
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

    try {
      // Initialize Python and validate paths
      await this.initializePython();
      await this.validatePaths();
      
      // Validate input file
      await this.validateFile(filePath);

      // Create output directories
      const pngDir = join(outputDir, 'pngs');
      const textDir = join(outputDir, 'text');
      await mkdir(pngDir, { recursive: true });
      await mkdir(textDir, { recursive: true });

      // Step 1: Convert PDF to PNG
      console.log(`Starting PDF to PNG conversion for ${basename(filePath)}`);
      const pdfResult = await this.convertPdfToPng(filePath, pngDir, dpi, timeout);
      
      if (!pdfResult.success) {
        return {
          success: false,
          error: `PDF conversion failed: ${pdfResult.error}`,
          processingDuration: Date.now() - startTime
        };
      }

      // Step 2: OCR Processing
      console.log(`Starting OCR processing for ${basename(filePath)}`);
      const ocrResult = await this.runOCRProcessing(pngDir, textDir, timeout);

      if (!ocrResult.success) {
        return {
          success: false,
          error: `OCR processing failed: ${ocrResult.error}`,
          pngOutputPath: pngDir,
          pngCount: pdfResult.pageCount,
          pageCount: pdfResult.pageCount,
          processingDuration: Date.now() - startTime
        };
      }

      // Calculate final statistics
      const finalStats = await this.calculateStatistics(pngDir, textDir);

      return {
        success: true,
        outputPath: outputDir,
        pngOutputPath: pngDir,
        textOutputPath: textDir,
        pngCount: finalStats.pngCount,
        pageCount: finalStats.pageCount,
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
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingDuration: Date.now() - startTime
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
    timeout: number
  ): Promise<{ success: boolean; pageCount?: number; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        // Ensure Python is initialized
        const pythonCommand = await this.initializePython();
        
        // Create a temporary script that processes just this one file
        const tempScript = this.createTempPDFScript(pdfPath, outputDir, dpi);
        
        const pythonProcess = spawn(pythonCommand, ['-c', tempScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout
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
        if (code === 0) {
          try {
            // Count generated PNG files
            const files = await readdir(outputDir);
            const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
            
            resolve({
              success: true,
              pageCount: pngFiles.length
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to count PNG files: ${error}`
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start PDF conversion: ${error.message}`
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: 'PDF conversion timed out'
          });
        }
      }, timeout);
      
      } catch (error) {
        resolve({
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
    timeout: number
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Set up environment variables for the OCR processor
      const env: Record<string, string | undefined> = {
        ...process.env,
        OCR_INPUT_DIR: pngDir,
        OCR_OUTPUT_DIR: textDir,
        OCR_BATCH_SIZE: '5',
        OCR_CONCURRENCY: '2'
      };

      const childProcess = spawn('node', [this.ocrScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env as any,
        timeout
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: stderr || `OCR process exited with code ${code}`
          });
        }
      });

      childProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start OCR processing: ${error.message}`
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!childProcess.killed) {
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
   * Create a temporary Python script for PDF processing
   */
  private createTempPDFScript(pdfPath: string, outputDir: string, dpi: number): string {
    return `
import os
import fitz  # PyMuPDF

def process_single_pdf(pdf_path, output_dir, dpi=300):
    try:
        doc = fitz.open(pdf_path)
        total_pages = doc.page_count
        
        os.makedirs(output_dir, exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        for i in range(total_pages):
            page = doc.load_page(i)
            zoom = dpi / 72  # DPI scaling
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            output_path = os.path.join(output_dir, f"{base_name}_{i+1:04d}.png")
            pix.save(output_path)
            
        doc.close()
        print(f"Successfully processed {total_pages} pages")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

# Process the file
process_single_pdf("${pdfPath.replace(/\\/g, '\\\\')}", "${outputDir.replace(/\\/g, '\\\\')}", ${dpi})
`;
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

          // Simple heuristics for confidence estimation
          // In a real implementation, this would use actual OCR confidence scores
          const confidence = Math.min(0.95, Math.max(0.75, stats.size / 1000));
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
   * Clean up temporary files
   */
  async cleanup(outputDir: string): Promise<void> {
    try {
      // Implementation would recursively delete the output directory
      // For safety, we'll just log this for now
      console.log(`Cleanup requested for: ${outputDir}`);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const ocrProcessor = new OCRProcessor();