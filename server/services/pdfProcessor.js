import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFProcessor {
  constructor(io) {
    this.io = io;
    this.projectRoot = path.resolve(__dirname, '../../');
  }

  async detectPythonCommand() {
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        await new Promise((resolve, reject) => {
          const pythonCheck = spawn(cmd, ['--version'], { stdio: 'pipe' });
          
          pythonCheck.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`${cmd} not found`));
            }
          });
          
          pythonCheck.on('error', () => {
            reject(new Error(`${cmd} not found in PATH`));
          });
        });
        return cmd;
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('Python is required but not found. Please install Python 3.6+');
  }

  async countPDFFiles(inputFolder) {
    try {
      const pdfPattern = path.join(inputFolder, '**/*.pdf').replace(/\\/g, '/');
      const pdfFiles = await glob(pdfPattern);
      return pdfFiles.length;
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

  async processUploadedPDFs(uploadedFiles, relativePaths = []) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`📤 Processing ${uploadedFiles.length} uploaded PDF files`);

        this.io.emit('pipeline-progress', {
          step: 'pdf-to-png',
          message: `Processing ${uploadedFiles.length} uploaded PDF files...`,
          progress: 0
        });

        // Create input directory for uploaded files
        const uploadInputDir = path.join(this.projectRoot, '1_New_File_Process_PDF_2_PNG');
        await fs.ensureDir(uploadInputDir);

        // Copy uploaded files to input directory with proper structure
        this.io.emit('pipeline-progress', {
          step: 'pdf-to-png',
          message: 'Organizing uploaded files...',
          progress: 10
        });

        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const relativePath = relativePaths[i] || file.originalname;
          
          // Create directory structure if needed
          const targetPath = path.join(uploadInputDir, relativePath);
          await fs.ensureDir(path.dirname(targetPath));
          
          // Copy file to target location
          await fs.copy(file.path, targetPath);
          
          // Clean up temp file
          await fs.remove(file.path);
        }

        this.io.emit('pipeline-progress', {
          step: 'pdf-to-png',
          message: 'Starting PDF to PNG conversion...',
          progress: 20
        });

        // Now process using the standard method
        const result = await this.processPDFs(uploadInputDir);
        resolve(result);

      } catch (error) {
        reject(error);
      }
    });
  }

  async processPDFs(inputFolder) {
    return new Promise(async (resolve, reject) => {
      try {
        // Validate input folder exists
        if (!await fs.pathExists(inputFolder)) {
          reject(new Error(`Input folder does not exist: ${inputFolder}`));
          return;
        }

        // Count PDFs to set expectations
        const pdfCount = await this.countPDFFiles(inputFolder);
        if (pdfCount === 0) {
          reject(new Error(`No PDF files found in folder: ${inputFolder}`));
          return;
        }

        this.io.emit('pipeline-progress', {
          step: 'pdf-to-png',
          message: `Processing ${pdfCount} PDF files directly from ${path.basename(inputFolder)}...`,
          progress: 0
        });

        // Run the Python conversion script with input folder argument
        const pythonCmd = await this.detectPythonCommand();
        const pythonScriptPath = path.join(this.projectRoot, 'PDF_2_PNG.py');
        
        this.io.emit('pipeline-progress', {
          step: 'pdf-to-png',
          message: 'Starting PDF to PNG conversion...',
          progress: 5
        });

        // Pass the input folder as an argument to Python script
        const pythonProcess = spawn(pythonCmd, [
          pythonScriptPath, 
          '--input', inputFolder,
          '--output', path.join(this.projectRoot, '2_Converted_PNGs'),
          '--log', path.join(this.projectRoot, 'logs/ConversionLog.txt')
        ], {
          cwd: this.projectRoot,
          stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // Parse progress from Python output if possible
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes('%') || line.includes('page')) {
              this.io.emit('pipeline-progress', {
                step: 'pdf-to-png',
                message: line.trim(),
                progress: Math.min(20 + Math.random() * 60, 90) // Simulate progress
              });
            }
          }
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          if (code === 0) {
            // Count generated PNG files
            const pngCount = await this.countPNGFiles();
            
            this.io.emit('pipeline-progress', {
              step: 'pdf-to-png',
              message: `Conversion completed! Generated ${pngCount} PNG files.`,
              progress: 100
            });

            resolve({
              success: true,
              pdfCount: pdfCount,
              pngCount: pngCount,
              inputFolder: inputFolder,
              message: `Successfully converted ${pdfCount} PDFs to ${pngCount} PNG files from ${path.basename(inputFolder)}`
            });
          } else {
            const errorMsg = `PDF conversion failed with exit code ${code}`;
            const fullError = stderr ? `${errorMsg}\nError: ${stderr.trim()}` : errorMsg;
            reject(new Error(fullError));
          }
        });

        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start PDF conversion: ${error.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

export default PDFProcessor;