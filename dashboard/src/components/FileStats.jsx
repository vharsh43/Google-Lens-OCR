import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { FileText, FileImage, File, TrendingUp } from 'lucide-react';

const FileStats = ({ stats }) => {
  const { pdfFiles, pngFiles, txtFiles } = stats;
  
  const getConversionRate = () => {
    if (pdfFiles === 0) return 0;
    if (txtFiles === 0) return 0;
    // If we have text files, consider it successful
    // Cap at 100% even if we have more text files than PDFs (multi-page PDFs)
    return Math.min(100, Math.round((txtFiles > 0 ? 1 : 0) * 100));
  };

  const getProcessingEfficiency = () => {
    if (pdfFiles === 0) return "No files";
    if (pngFiles === 0 && txtFiles === 0) return "Not started";
    if (pngFiles > 0 && txtFiles === 0) return "In progress";
    if (txtFiles > 0) return "Completed";
    return "Processing";
  };

  const StatItem = ({ icon: Icon, label, count, color }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="font-medium text-gray-700">{label}</span>
      </div>
      <Badge variant="outline" className="font-mono text-lg">
        {count}
      </Badge>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          File Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatItem
          icon={File}
          label="PDF Files"
          count={pdfFiles}
          color="bg-red-500"
        />
        
        <StatItem
          icon={FileImage}
          label="PNG Files"
          count={pngFiles}
          color="bg-blue-500"
        />
        
        <StatItem
          icon={FileText}
          label="Text Files"
          count={txtFiles}
          color="bg-green-500"
        />

        {/* Processing Status */}
        <div className="border-t pt-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Processing Status
            </span>
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    txtFiles > 0 ? 'bg-green-500' : pngFiles > 0 ? 'bg-blue-500' : 'bg-gray-400'
                  }`}
                  style={{ 
                    width: txtFiles > 0 ? '100%' : pngFiles > 0 ? '50%' : pdfFiles > 0 ? '10%' : '0%' 
                  }}
                />
              </div>
              <Badge 
                variant={txtFiles > 0 ? "default" : "secondary"}
                className={txtFiles > 0 ? "bg-green-500 text-white" : pngFiles > 0 ? "bg-blue-500 text-white" : ""}
              >
                {getProcessingEfficiency()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Processing Flow Indicator */}
        <div className="border-t pt-3 mt-4">
          <div className="text-xs text-gray-500 mb-2">Processing Flow:</div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge variant="outline" className="text-red-600">PDF</Badge>
            <span>→</span>
            <Badge variant="outline" className="text-blue-600">PNG</Badge>
            <span>→</span>
            <Badge variant="outline" className="text-green-600">TXT</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileStats;