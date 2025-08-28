import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get the project root directory (go up from server/routes to project root)
const projectRoot = path.resolve(__dirname, '../../');

const directories = {
  pdf: path.join(projectRoot, '1_New_File_Process_PDF_2_PNG'),
  png: path.join(projectRoot, '2_Converted_PNGs'),
  txt: path.join(projectRoot, '3_OCR_TXT_Files'),
  logs: path.join(projectRoot, 'logs')
};

// Open folder in OS
router.post('/open-folder', async (req, res) => {
  try {
    const { folder } = req.body;
    
    if (!folder || !directories[folder]) {
      return res.status(400).json({ error: 'Invalid folder type' });
    }

    const folderPath = directories[folder];
    
    // Ensure folder exists
    await fs.ensureDir(folderPath);
    
    // Open folder in OS
    await open(folderPath);
    
    res.json({ success: true, message: `Opened ${folder} folder` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear files from specific folder
router.post('/clear-folder', async (req, res) => {
  try {
    const { folder } = req.body;
    
    if (!folder || !directories[folder]) {
      return res.status(400).json({ error: 'Invalid folder type' });
    }

    const folderPath = directories[folder];
    
    if (await fs.pathExists(folderPath)) {
      // Remove all contents but keep the folder
      await fs.emptyDir(folderPath);
    }
    
    res.json({ success: true, message: `Cleared ${folder} folder` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all processed files
router.post('/clear-all', async (req, res) => {
  try {
    const foldersToClean = ['pdf', 'png', 'txt', 'logs'];
    
    for (const folder of foldersToClean) {
      const folderPath = directories[folder];
      if (await fs.pathExists(folderPath)) {
        await fs.emptyDir(folderPath);
      }
    }

    // Also remove completion flag if it exists
    const flagFile = path.join(projectRoot, 'pdf_conversion_complete.flag');
    if (await fs.pathExists(flagFile)) {
      await fs.remove(flagFile);
    }
    
    res.json({ success: true, message: 'All files cleared successfully (PDF, PNG, TXT, and logs)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file counts for each directory
router.get('/stats', async (req, res) => {
  try {
    const stats = {};
    
    for (const [key, dirPath] of Object.entries(directories)) {
      if (key === 'logs') continue; // Skip logs directory for file counts
      
      stats[key] = 0;
      
      if (await fs.pathExists(dirPath)) {
        const files = await fs.readdir(dirPath, { recursive: true });
        
        if (key === 'pdf') {
          stats[key] = files.filter(file => file.toLowerCase().endsWith('.pdf')).length;
        } else if (key === 'png') {
          stats[key] = files.filter(file => file.toLowerCase().endsWith('.png')).length;
        } else if (key === 'txt') {
          stats[key] = files.filter(file => file.toLowerCase().endsWith('.txt')).length;
        }
      }
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;