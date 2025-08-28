import io from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3003/api';

class PipelineAPI {
  constructor() {
    this.socket = null;
  }

  // Connect to Socket.IO
  connect() {
    if (!this.socket) {
      this.socket = io('http://localhost:3003');
    }
    return this.socket;
  }

  // Disconnect from Socket.IO
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // HTTP API calls
  async setFolder(folderData) {
    // Ensure we always send an object with folderPath
    const payload = typeof folderData === 'string' 
      ? { folderPath: folderData }
      : folderData;
      
    console.log('API sending folder path:', payload.folderPath);
    
    const response = await fetch(`${API_BASE_URL}/pipeline/set-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        error = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || 'Failed to set folder');
    }

    return response.json();
  }

  async startPdfToPng() {
    const response = await fetch(`${API_BASE_URL}/pipeline/pdf-to-png`, {
      method: 'POST',
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        error = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || 'Failed to start PDF to PNG conversion');
    }

    return response.json();
  }

  async startPdfToPngWithFiles(files) {
    const formData = new FormData();
    
    // Add all PDF files to the form data
    const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith('.pdf'));
    pdfFiles.forEach((file, index) => {
      formData.append(`pdfs`, file);
      // Also send the relative path structure
      formData.append(`paths`, file.webkitRelativePath);
    });

    const response = await fetch(`${API_BASE_URL}/pipeline/pdf-to-png-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        // If response is not JSON, create error from status
        error = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || 'Failed to start PDF to PNG conversion with files');
    }

    return response.json();
  }

  async startOcrProcessing() {
    const response = await fetch(`${API_BASE_URL}/pipeline/ocr-processing`, {
      method: 'POST',
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        error = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || 'Failed to start OCR processing');
    }

    return response.json();
  }

  async getPipelineStatus() {
    const response = await fetch(`${API_BASE_URL}/pipeline/status`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get pipeline status');
    }

    return response.json();
  }

  async resetPipeline() {
    const response = await fetch(`${API_BASE_URL}/pipeline/reset`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset pipeline');
    }

    return response.json();
  }

  async openFolder(folder) {
    const response = await fetch(`${API_BASE_URL}/files/open-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to open folder');
    }

    return response.json();
  }

  async clearFolder(folder) {
    const response = await fetch(`${API_BASE_URL}/files/clear-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear folder');
    }

    return response.json();
  }

  async clearAllFiles() {
    const response = await fetch(`${API_BASE_URL}/files/clear-all`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear all files');
    }

    return response.json();
  }

  async getFileStats() {
    const response = await fetch(`${API_BASE_URL}/files/stats`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get file stats');
    }

    return response.json();
  }
}

export default new PipelineAPI();