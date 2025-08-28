import express from 'express';
import multer from 'multer';
import PDFProcessor from '../services/pdfProcessor.js';
import OCRProcessor from '../services/ocrProcessor.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 1000 // Max 1000 files
  }
});

// Global pipeline state
let pipelineState = {
  isRunning: false,
  currentStep: null,
  progress: 0,
  inputFolder: null,
  stats: {
    pdfFiles: 0,
    pngFiles: 0,
    txtFiles: 0
  },
  lastUpdate: null
};

// Set input folder
router.post('/set-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    console.log('Backend received folder path:', folderPath);

    pipelineState.inputFolder = folderPath;
    pipelineState.lastUpdate = new Date().toISOString();
    
    // Count PDF files in the specified folder
    try {
      const pdfProcessor = new PDFProcessor(req.io);
      const countedFiles = await pdfProcessor.countPDFFiles(folderPath);
      pipelineState.stats.pdfFiles = countedFiles;
      
      if (countedFiles === 0) {
        return res.json({ 
          success: true, 
          message: `Folder set, but no PDF files found in "${folderPath}". Please check the path and ensure it contains PDF files.`,
          state: pipelineState,
          warning: true
        });
      }
    } catch (error) {
      return res.status(400).json({ 
        error: `Could not access folder "${folderPath}": ${error.message}. Please check if the path exists and is accessible.`
      });
    }
    
    // Emit update to clients
    req.io.emit('pipeline-update', pipelineState);
    
    res.json({ 
      success: true, 
      message: `Folder set successfully. Found ${pipelineState.stats.pdfFiles} PDF files in "${folderPath}".`,
      state: pipelineState 
    });
  } catch (error) {
    console.error('Set folder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start PDF to PNG conversion with uploaded files
router.post('/pdf-to-png-upload', upload.array('pdfs'), async (req, res) => {
  try {
    if (pipelineState.isRunning) {
      return res.status(400).json({ error: 'Pipeline is already running' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }

    console.log(`📤 Received ${req.files.length} PDF files for processing`);

    pipelineState.isRunning = true;
    pipelineState.currentStep = 'pdf-to-png';
    pipelineState.progress = 0;
    pipelineState.lastUpdate = new Date().toISOString();
    pipelineState.inputFolder = 'Browser Upload';
    pipelineState.stats.pdfFiles = req.files.length;

    // Emit initial state
    req.io.emit('pipeline-update', pipelineState);

    const pdfProcessor = new PDFProcessor(req.io);
    
    // Start processing uploaded files in background
    pdfProcessor.processUploadedPDFs(req.files, req.body.paths || [])
      .then((result) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.progress = 100;
        pipelineState.stats.pngFiles = result.pngCount;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-update', pipelineState);
        req.io.emit('pdf-conversion-complete', result);
      })
      .catch((error) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-error', { step: 'pdf-to-png', error: error.message });
      });

    res.json({ success: true, message: `PDF to PNG conversion started with ${req.files.length} files` });
  } catch (error) {
    pipelineState.isRunning = false;
    res.status(500).json({ error: error.message });
  }
});

// Start PDF to PNG conversion
router.post('/pdf-to-png', async (req, res) => {
  try {
    if (pipelineState.isRunning) {
      return res.status(400).json({ error: 'Pipeline is already running' });
    }

    if (!pipelineState.inputFolder) {
      return res.status(400).json({ error: 'No input folder selected' });
    }

    pipelineState.isRunning = true;
    pipelineState.currentStep = 'pdf-to-png';
    pipelineState.progress = 0;
    pipelineState.lastUpdate = new Date().toISOString();

    // Emit initial state
    req.io.emit('pipeline-update', pipelineState);

    const pdfProcessor = new PDFProcessor(req.io);
    
    // Start processing in background
    pdfProcessor.processPDFs(pipelineState.inputFolder)
      .then((result) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.progress = 100;
        pipelineState.stats.pngFiles = result.pngCount;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-update', pipelineState);
        req.io.emit('pdf-conversion-complete', result);
      })
      .catch((error) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-error', { step: 'pdf-to-png', error: error.message });
      });

    res.json({ success: true, message: 'PDF to PNG conversion started' });
  } catch (error) {
    pipelineState.isRunning = false;
    res.status(500).json({ error: error.message });
  }
});

// Start OCR processing
router.post('/ocr-processing', async (req, res) => {
  try {
    if (pipelineState.isRunning) {
      return res.status(400).json({ error: 'Pipeline is already running' });
    }

    pipelineState.isRunning = true;
    pipelineState.currentStep = 'ocr-processing';
    pipelineState.progress = 0;
    pipelineState.lastUpdate = new Date().toISOString();

    // Emit initial state
    req.io.emit('pipeline-update', pipelineState);

    const ocrProcessor = new OCRProcessor(req.io);
    
    // Start processing in background
    ocrProcessor.processOCR()
      .then((result) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.progress = 100;
        pipelineState.stats.txtFiles = result.txtCount;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-update', pipelineState);
        req.io.emit('ocr-processing-complete', result);
      })
      .catch((error) => {
        pipelineState.isRunning = false;
        pipelineState.currentStep = null;
        pipelineState.lastUpdate = new Date().toISOString();
        req.io.emit('pipeline-error', { step: 'ocr-processing', error: error.message });
      });

    res.json({ success: true, message: 'OCR processing started' });
  } catch (error) {
    pipelineState.isRunning = false;
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline status
router.get('/status', (req, res) => {
  res.json(pipelineState);
});

// Reset pipeline
router.post('/reset', async (req, res) => {
  try {
    pipelineState = {
      isRunning: false,
      currentStep: null,
      progress: 0,
      inputFolder: null,
      stats: {
        pdfFiles: 0,
        pngFiles: 0,
        txtFiles: 0
      },
      lastUpdate: new Date().toISOString()
    };

    req.io.emit('pipeline-update', pipelineState);
    res.json({ success: true, message: 'Pipeline reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;