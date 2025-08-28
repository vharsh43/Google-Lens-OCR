import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  FileImage, 
  FileText, 
  Play, 
  Loader2, 
  CheckCircle2,
  AlertTriangle 
} from 'lucide-react';

const ProcessingSteps = ({ 
  pipelineState, 
  progressMessage, 
  onStartPdfToPng, 
  onStartOcr 
}) => {
  const canStartPdfToPng = !pipelineState.isRunning && pipelineState.inputFolder && pipelineState.stats.pdfFiles > 0;
  const canStartOcr = !pipelineState.isRunning && pipelineState.stats.pngFiles > 0;
  
  const getStepStatus = (step) => {
    if (pipelineState.currentStep === step) {
      return 'running';
    } else if (step === 'pdf-to-png' && pipelineState.stats.pngFiles > 0) {
      return 'completed';
    } else if (step === 'ocr-processing' && pipelineState.stats.txtFiles > 0) {
      return 'completed';
    }
    return 'pending';
  };

  const getStatusIcon = (step) => {
    const status = getStepStatus(step);
    
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (step) => {
    const status = getStepStatus(step);
    
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline">Ready</Badge>;
      default:
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Processing Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: PDF to PNG */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon('pdf-to-png')}
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  Step 1: PDF to PNG Conversion
                </h3>
                <p className="text-sm text-gray-600">
                  Convert PDF files to high-resolution PNG images (300 DPI)
                </p>
              </div>
            </div>
            {getStatusBadge('pdf-to-png')}
          </div>

          {pipelineState.currentStep === 'pdf-to-png' && (
            <div className="space-y-2">
              <Progress value={pipelineState.progress} className="w-full" />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{progressMessage || 'Processing...'}</span>
                <span>{Math.round(pipelineState.progress)}%</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {pipelineState.stats.pdfFiles > 0 
                ? `${pipelineState.stats.pdfFiles} PDF files → ${pipelineState.stats.pngFiles} PNG files`
                : 'No PDF files selected'
              }
            </div>
            <Button 
              onClick={onStartPdfToPng}
              disabled={!canStartPdfToPng}
              size="sm"
            >
              <Play className="w-4 h-4 mr-1" />
              Start Conversion
            </Button>
          </div>
        </div>

        <div className="border-t pt-6">
          {/* Step 2: OCR Processing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon('ocr-processing')}
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Step 2: Google Lens OCR Processing
                  </h3>
                  <p className="text-sm text-gray-600">
                    Extract text from PNG images using Google Lens OCR
                  </p>
                </div>
              </div>
              {getStatusBadge('ocr-processing')}
            </div>

            {pipelineState.currentStep === 'ocr-processing' && (
              <div className="space-y-2">
                <Progress 
                  value={pipelineState.progress} 
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{progressMessage || 'Processing OCR...'}</span>
                  <span>{Math.round(pipelineState.progress)}%</span>
                </div>
                
                {progressMessage?.includes('Rate limiting') && (
                  <div className="flex items-center gap-2 text-yellow-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Rate limiting detected - automatically adjusting speed
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {pipelineState.stats.pngFiles > 0 
                  ? `${pipelineState.stats.pngFiles} PNG files → ${pipelineState.stats.txtFiles} text files`
                  : 'No PNG files available'
                }
              </div>
              <Button 
                onClick={onStartOcr}
                disabled={!canStartOcr}
                size="sm"
              >
                <Play className="w-4 h-4 mr-1" />
                Start OCR
              </Button>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {pipelineState.isRunning && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="font-medium text-blue-700">
                Pipeline is running...
              </span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              {progressMessage || `Processing ${pipelineState.currentStep}...`}
            </p>
          </div>
        )}

        {/* Completion Message */}
        {!pipelineState.isRunning && pipelineState.stats.txtFiles > 0 && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-700">
                Processing Complete!
              </span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              Successfully converted {pipelineState.stats.pdfFiles} PDF files to {pipelineState.stats.txtFiles} text files.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessingSteps;