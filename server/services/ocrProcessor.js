import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OCRProcessor {
  constructor(io) {
    this.io = io;
    this.projectRoot = path.resolve(__dirname, '../../');
  }

  async countTXTFiles() {
    try {
      const txtDir = path.join(this.projectRoot, '3_OCR_TXT_Files');
      const txtPattern = path.join(txtDir, '**/*.txt').replace(/\\/g, '/');
      const txtFiles = await glob(txtPattern);
      return txtFiles.length;
    } catch (error) {
      return 0;
    }
  }

  async countPNGFiles() {
    try {
      const pngDir = path.join(this.projectRoot, '2_Converted_PNGs');
      const pngPattern = path.join(pngDir, '**/*.png').replace(/\\/g, '/');
      const pngFiles = await glob(pngPattern);
      return pngFiles.length;
    } catch (error) {
      return 0;
    }
  }

  async processOCR() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if PNG files exist
        const pngCount = await this.countPNGFiles();
        if (pngCount === 0) {
          reject(new Error('No PNG files found for OCR processing. Please run PDF to PNG conversion first.'));
          return;
        }

        this.io.emit('pipeline-progress', {
          step: 'ocr-processing',
          message: `Starting OCR processing of ${pngCount} PNG files...`,
          progress: 0
        });

        // Run the Node.js OCR processing
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const ocrProcess = spawn(npmCmd, ['start'], {
          cwd: this.projectRoot,
          stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        ocrProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // Parse progress from OCR output
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes('✓') || line.includes('✗') || line.includes('%') || line.includes('Batch')) {
              // Extract percentage if available
              const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
              let progress = 0;
              
              if (percentMatch) {
                progress = parseFloat(percentMatch[1]);
              } else if (line.includes('✓')) {
                // Increment progress for completed files
                progress = Math.min(progress + (100 / pngCount), 95);
              }

              this.io.emit('pipeline-progress', {
                step: 'ocr-processing',
                message: line.trim(),
                progress: Math.max(progress, 5) // Ensure minimum progress
              });
            }
          }
        });

        ocrProcess.stderr.on('data', (data) => {
          const error = data.toString();
          stderr += error;
          
          // Handle rate limiting messages
          if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('429')) {
            this.io.emit('pipeline-progress', {
              step: 'ocr-processing',
              message: 'Rate limiting detected, adjusting speed...',
              progress: -1 // Special value to indicate rate limiting
            });
          }
        });

        ocrProcess.on('close', async (code) => {
          if (code === 0) {
            // Count generated text files
            const txtCount = await this.countTXTFiles();
            
            this.io.emit('pipeline-progress', {
              step: 'ocr-processing',
              message: `OCR processing completed! Generated ${txtCount} text files.`,
              progress: 100
            });

            resolve({
              success: true,
              pngCount: pngCount,
              txtCount: txtCount,
              message: `Successfully processed ${pngCount} PNG files to ${txtCount} text files`
            });
          } else {
            const errorMsg = `OCR processing failed with exit code ${code}`;
            const fullError = stderr ? `${errorMsg}\nError: ${stderr.trim()}` : errorMsg;
            
            // Provide specific error guidance
            if (stderr.includes('chrome-lens-ocr')) {
              reject(new Error(`${errorMsg}\nChrome Lens OCR issue. Check internet connection and try again.`));
            } else if (stderr.includes('ECONNREFUSED') || stderr.includes('network')) {
              reject(new Error(`${errorMsg}\nNetwork connection issue. Check internet connectivity.`));
            } else if (stderr.includes('rate limit') || stderr.includes('429')) {
              reject(new Error(`${errorMsg}\nRate limit exceeded. Wait a few minutes and try again.`));
            } else {
              reject(new Error(fullError));
            }
          }
        });

        ocrProcess.on('error', (error) => {
          if (error.code === 'ENOENT') {
            reject(new Error(`Failed to start OCR processing: npm not found. Please install Node.js and npm.`));
          } else {
            reject(new Error(`Failed to start OCR processing: ${error.message}`));
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

export default OCRProcessor;