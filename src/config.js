export const config = {
  // Input and output directories
  inputDir: './2_Converted_PNGs',    // Changed to read from PDF conversion output
  outputDir: './3_OCR_TXT_Files',
  
  // Supported image file extensions
  supportedExtensions: ['.jpg', '.jpeg', '.png'],
  
  // Processing options
  processing: {
    // Rate limiting for Google API - Optimized settings
    batchSize: 10,             // Start with 10 files per batch (dynamically adjustable)
    batchDelay: 3000,          // Wait 3 seconds between batches (reduced from 10s)
    requestDelay: 500,         // Wait 500ms between individual requests (reduced from 2s)
    
    // Maximum concurrent OCR operations - Allow parallel processing
    maxConcurrency: 3,         // Process up to 3 files concurrently
    
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
    apiErrorCodes: ['RATE_LIMITED', 'QUOTA_EXCEEDED', 'TOO_MANY_REQUESTS'],
    
    // Dynamic rate adjustment settings
    dynamicRateAdjustment: {
      enabled: true,                    // Enable dynamic rate adjustment
      minBatchSize: 3,                  // Minimum batch size when scaling down
      maxBatchSize: 20,                 // Maximum batch size when scaling up
      minBatchDelay: 1000,              // Minimum delay between batches (1s)
      maxBatchDelay: 15000,             // Maximum delay between batches (15s)
      scaleUpThreshold: 0.95,           // Scale up if success rate > 95%
      scaleDownThreshold: 0.80,         // Scale down if success rate < 80%
      adjustmentInterval: 5,            // Adjust every 5 batches
      conservativeMode: false,          // Start in aggressive mode
      scalingFactor: 1.5                // Multiply/divide by this factor when scaling
    }
  },
  
  // Output options
  output: {
    // Text file extension
    textExtension: '.txt',
    
    // Include metadata in output files
    includeMetadata: false,
    
    // Encoding for output files
    encoding: 'utf8',
    
    // Merged file options
    generateMergedFiles: false,       // Generate merged OCR files for each folder (disabled by default - use npm run merge)
    mergedFileSuffix: '_OCR'          // Suffix for merged files (e.g., foldername_OCR.txt)
  },
  
  // Logging options
  logging: {
    // Log file for failed operations
    errorLogFile: './logs/failed-files.log',
    
    // Console output verbosity (0=quiet, 1=normal, 2=verbose)
    verbosity: 2,
    
    // Log successful operations
    logSuccess: true
  }
};