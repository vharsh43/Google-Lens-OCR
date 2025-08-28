import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { 
  FolderOpen, 
  Trash2, 
  RotateCcw, 
  ExternalLink,
  Settings 
} from 'lucide-react';

const ActionButtons = ({ onOpenFolder, onClearAll, onReset, disabled }) => {
  const handleOpenFolder = (folderType) => {
    onOpenFolder(folderType);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Open Folders */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Open Folders
          </div>
          
          <Button
            variant="outline"
            onClick={() => handleOpenFolder('txt')}
            className="w-full justify-start"
            size="sm"
            disabled={disabled}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Output Text Files
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => handleOpenFolder('png')}
            className="w-full justify-start"
            size="sm"
            disabled={disabled}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Converted PNGs
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => handleOpenFolder('pdf')}
            className="w-full justify-start"
            size="sm"
            disabled={disabled}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Input PDFs
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>
        </div>

        <div className="border-t pt-3">
          {/* System Actions */}
          <div className="text-sm font-medium text-gray-600 mb-2">
            System Actions
          </div>
          
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={onClearAll}
              className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50"
              size="sm"
              disabled={disabled}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Files
            </Button>
            
            <Button
              variant="outline"
              onClick={onReset}
              className="w-full justify-start text-blue-600 border-blue-200 hover:bg-blue-50"
              size="sm"
              disabled={disabled}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Pipeline
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="border-t pt-3">
          <div className="text-xs text-gray-500 space-y-1">
            <p>💡 <strong>Clear All:</strong> Removes processed PNG and TXT files</p>
            <p>🔄 <strong>Reset:</strong> Resets pipeline state without deleting files</p>
            <p>📁 <strong>Open Folder:</strong> Opens folder in your OS file manager</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionButtons;