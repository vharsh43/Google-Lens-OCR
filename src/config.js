export const config = {
  // Input and output directories
  inputDir: './JPG2TXT',
  outputDir: './TXT_Files',
  
  // Supported image file extensions
  supportedExtensions: ['.jpg', '.jpeg', '.png'],
  
  // Processing options
  processing: {
    // Maximum concurrent OCR operations
    maxConcurrency: 3,
    
    // Retry attempts for failed operations
    maxRetries: 2,
    
    // Delay between retries (ms)
    retryDelay: 1000,
    
    // Timeout for each OCR operation (ms)
    timeout: 30000,
    
    // Language detection and preservation
    preserveOriginalScript: true,
    
    // Language hints (empty array means auto-detect all)
    languageHints: [], // e.g., ['gu', 'hi', 'sa'] for Gujarati, Hindi, Sanskrit
    
    // Validate text integrity (ensure no unwanted translation)
    validateTextIntegrity: true
  },
  
  // Output options
  output: {
    // Text file extension
    textExtension: '.txt',
    
    // Include metadata in output files
    includeMetadata: false,
    
    // Encoding for output files
    encoding: 'utf8'
  },
  
  // Logging options
  logging: {
    // Log file for failed operations
    errorLogFile: './failed-files.log',
    
    // Console output verbosity (0=quiet, 1=normal, 2=verbose)
    verbosity: 1,
    
    // Log successful operations
    logSuccess: true
  }
};