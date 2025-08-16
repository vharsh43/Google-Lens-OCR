export const config = {
  // Input and output directories
  inputDir: './JPG2TXT',
  outputDir: './TXT_Files',
  
  // Supported image file extensions
  supportedExtensions: ['.jpg', '.jpeg', '.png'],
  
  // Processing options
  processing: {
    // Rate limiting for Google API
    batchSize: 5,              // Process 5 files per batch
    batchDelay: 10000,         // Wait 10 seconds between batches
    requestDelay: 2000,        // Wait 2 seconds between individual requests
    
    // Maximum concurrent OCR operations (reduced for rate limiting)
    maxConcurrency: 1,         // Process one at a time to avoid rate limits
    
    // Retry attempts for failed operations
    maxRetries: 3,             // Increased retries for rate limit errors
    
    // Delay between retries (ms)
    retryDelay: 5000,          // Increased delay for rate limit recovery
    
    // Exponential backoff for retries
    exponentialBackoff: true,
    maxRetryDelay: 30000,      // Maximum retry delay (30 seconds)
    
    // Timeout for each OCR operation (ms)
    timeout: 45000,            // Increased timeout for slower processing
    
    // Language detection and preservation
    preserveOriginalScript: true,
    
    // Language hints (empty array means auto-detect all)
    languageHints: [], // e.g., ['gu', 'hi', 'sa'] for Gujarati, Hindi, Sanskrit
    
    // Validate text integrity (ensure no unwanted translation)
    validateTextIntegrity: true,
    
    // Rate limit error handling
    rateLimitRetryMultiplier: 2.0,  // Multiply delay by this on rate limit errors
    apiErrorCodes: ['RATE_LIMITED', 'QUOTA_EXCEEDED', 'TOO_MANY_REQUESTS']
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
    verbosity: 2,
    
    // Log successful operations
    logSuccess: true
  }
};