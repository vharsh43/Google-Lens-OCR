import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Folder, FileText, FolderOpen, X } from 'lucide-react';

const FolderSelector = ({ onFolderSelect, selectedFolder, disabled, onClearSelection }) => {
  const handleFolderSelect = async () => {
    try {
      // Create input element for folder selection
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;
      
      input.onchange = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
          // Get folder path from the first file
          const firstFile = files[0];
          const folderPath = firstFile.webkitRelativePath.split('/')[0];
          const fullPath = firstFile.path || firstFile.webkitRelativePath;
          
          // Extract the parent directory path
          let parentPath;
          if (firstFile.path) {
            // If full system path is available
            parentPath = firstFile.path.substring(0, firstFile.path.lastIndexOf('/') - folderPath.length);
          } else {
            // Fallback - we'll send what we have
            parentPath = folderPath;
          }
          
          console.log('📁 Browser folder selected:', {
            folderName: folderPath,
            parentPath: parentPath,
            fileCount: files.length
          });
          
          onFolderSelect({
            folderName: folderPath,
            folderPath: parentPath,
            pdfCount: files.filter(file => file.name.toLowerCase().endsWith('.pdf')).length,
            files: files,
            isBrowserSelection: true
          });
        }
      };
      
      // Trigger the folder selection dialog
      input.click();
    } catch (error) {
      console.error('Error selecting folder:', error);
      alert('Error selecting folder. Please try again.');
    }
  };

  const handleClearSelection = () => {
    console.log('🗑️ Clearing folder selection');
    if (onClearSelection) {
      onClearSelection(); // Call parent clear handler
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="w-5 h-5" />
          Select Input Folder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600 mb-4">
          Click the button below to select a folder containing PDF files to process
        </div>

        <Button 
          onClick={handleFolderSelect}
          disabled={disabled}
          className="w-full"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Select Folder
        </Button>
        
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p>💡 <strong>Note:</strong></p>
          <p>• Choose a folder that contains PDF files</p>
          <p>• All PDF files in the folder and subfolders will be processed</p>
          <p>• The browser will ask you to select a folder from your computer</p>
        </div>

        {selectedFolder && (
          <div className={`mt-4 p-3 rounded-lg border ${
            typeof selectedFolder === 'object' && selectedFolder.pdfCount === 0 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${
                  typeof selectedFolder === 'object' && selectedFolder.pdfCount === 0 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
                }`} />
                <span className={`text-sm font-medium ${
                  typeof selectedFolder === 'object' && selectedFolder.pdfCount === 0 
                    ? 'text-yellow-800' 
                    : 'text-green-800'
                }`}>Selected Folder:</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-6 w-6 p-0 hover:bg-red-100"
                title="Clear selection"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <Badge variant="outline" className="text-xs font-mono mb-2 break-all">
              {typeof selectedFolder === 'string' ? selectedFolder : selectedFolder.folderPath || selectedFolder}
            </Badge>
            {typeof selectedFolder === 'object' && selectedFolder.pdfCount !== undefined && (
              <div className={`text-xs mt-2 ${
                selectedFolder.pdfCount === 0 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {selectedFolder.pdfCount === 0 ? (
                  <div className="space-y-1">
                    <div>⚠️ No PDF files found in this folder</div>
                    <div className="text-xs">• Check if the folder path is correct</div>
                    <div className="text-xs">• Ensure the folder contains PDF files</div>
                  </div>
                ) : (
                  <div>📄 Found {selectedFolder.pdfCount} PDF files ready for processing</div>
                )}
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default FolderSelector;