import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import FolderSelector from './FolderSelector';
import ProcessingSteps from './ProcessingSteps';
import FileStats from './FileStats';
import ActionButtons from './ActionButtons';
import pipelineAPI from '../api/pipelineAPI';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const Dashboard = () => {
  const [pipelineState, setPipelineState] = useState({
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
  });

  const [progressMessage, setProgressMessage] = useState('');
  const [notification, setNotification] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to Socket.IO
    const socket = pipelineAPI.connect();

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('pipeline-update', (state) => {
      console.log('Pipeline state update:', state);
      setPipelineState(state);
    });

    socket.on('pipeline-progress', (progress) => {
      console.log('Pipeline progress:', progress);
      setProgressMessage(progress.message);
      if (progress.progress >= 0) {
        setPipelineState(prev => ({
          ...prev,
          progress: progress.progress
        }));
      }
    });

    socket.on('pdf-conversion-complete', (result) => {
      console.log('PDF conversion complete:', result);
      showNotification('success', `PDF conversion completed! Generated ${result.pngCount} PNG files.`);
    });

    socket.on('ocr-processing-complete', (result) => {
      console.log('OCR processing complete:', result);
      showNotification('success', `OCR processing completed! Generated ${result.txtCount} text files.`);
    });

    socket.on('pipeline-error', (error) => {
      console.error('Pipeline error:', error);
      showNotification('error', `Error in ${error.step}: ${error.error}`);
    });

    // Load initial state
    loadPipelineStatus();

    return () => {
      pipelineAPI.disconnect();
    };
  }, []);

  const loadPipelineStatus = async () => {
    try {
      const status = await pipelineAPI.getPipelineStatus();
      setPipelineState(status);
    } catch (error) {
      console.error('Failed to load pipeline status:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFolderSelect = async (folderData) => {
    try {
      console.log('📨 Dashboard received folder data:', folderData);
      
      if (folderData.isBrowserSelection) {
        // For browser selection, we work with the file objects directly
        console.log('📁 Browser folder selection detected');
        
        // Update local state immediately with what we know
        setPipelineState(prev => ({
          ...prev,
          inputFolder: folderData.folderName,
          stats: {
            ...prev.stats,
            pdfFiles: folderData.pdfCount
          },
          lastUpdate: new Date().toISOString()
        }));
        
        if (folderData.pdfCount === 0) {
          showNotification('error', `No PDF files found in "${folderData.folderName}". Please select a different folder.`);
          return;
        }
        
        showNotification('success', `Selected folder "${folderData.folderName}" with ${folderData.pdfCount} PDF files`);
        
        // Store the files for later processing
        window.selectedFolderFiles = folderData.files;
        
      } else {
        // For manual path input (fallback)
        const folderPath = typeof folderData === 'string' ? folderData : folderData.folderPath;
        
        if (!folderPath) {
          showNotification('error', 'No folder path provided');
          return;
        }
        
        const result = await pipelineAPI.setFolder({
          folderPath: folderPath.trim()
        });
        
        showNotification('success', result.message);
      }
    } catch (error) {
      showNotification('error', error.message);
      console.error('❌ Folder selection error:', error);
    }
  };

  const handleStartPdfToPng = async () => {
    try {
      // Check if we have browser-selected files
      if (window.selectedFolderFiles) {
        console.log('📤 Starting PDF to PNG with browser-selected files');
        const result = await pipelineAPI.startPdfToPngWithFiles(window.selectedFolderFiles);
        showNotification('success', result.message);
      } else {
        // Fallback to path-based processing
        const result = await pipelineAPI.startPdfToPng();
        showNotification('success', result.message);
      }
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleStartOcr = async () => {
    try {
      const result = await pipelineAPI.startOcrProcessing();
      showNotification('success', result.message);
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleOpenFolder = async (folder) => {
    try {
      const result = await pipelineAPI.openFolder(folder);
      showNotification('success', result.message);
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleClearAll = async () => {
    try {
      const result = await pipelineAPI.clearAllFiles();
      showNotification('success', result.message);
      // Refresh stats after clearing
      loadPipelineStatus();
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleClearSelection = () => {
    console.log('🗑️ Clearing folder selection from Dashboard');
    setPipelineState(prev => ({
      ...prev,
      inputFolder: null,
      stats: {
        pdfFiles: 0,
        pngFiles: prev.stats.pngFiles,
        txtFiles: prev.stats.txtFiles
      },
      lastUpdate: new Date().toISOString()
    }));
    showNotification('success', 'Folder selection cleared');
  };

  const handleReset = async () => {
    try {
      const result = await pipelineAPI.resetPipeline();
      showNotification('success', result.message);
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PDF OCR Processing Dashboard
          </h1>
          <p className="text-gray-600 mb-4">
            Convert PDF documents to text using Google Lens OCR
          </p>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {connected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <FolderSelector 
              onFolderSelect={handleFolderSelect}
              selectedFolder={pipelineState.inputFolder ? {
                folderPath: pipelineState.inputFolder,
                pdfCount: pipelineState.stats.pdfFiles
              } : null}
              disabled={pipelineState.isRunning}
              onClearSelection={handleClearSelection}
            />
            
            <FileStats stats={pipelineState.stats} />
            
            <ActionButtons
              onOpenFolder={handleOpenFolder}
              onClearAll={handleClearAll}
              onReset={handleReset}
              disabled={pipelineState.isRunning}
            />
          </div>

          {/* Right Column - Processing */}
          <div className="lg:col-span-2">
            <ProcessingSteps
              pipelineState={pipelineState}
              progressMessage={progressMessage}
              onStartPdfToPng={handleStartPdfToPng}
              onStartOcr={handleStartOcr}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;