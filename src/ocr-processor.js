import Lens from 'chrome-lens-ocr';
import fs from 'fs-extra';
import path from 'path';
import { config } from './config.js';
import { Utils } from './utils.js';

export class OCRProcessor {
  constructor() {
    this.lens = new Lens();
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalFiles: 0,
      startTime: null,
      endTime: null
    };
  }

  async processImage(inputPath, outputPath, retryCount = 0) {
    try {
      Utils.log(`Processing: ${path.basename(inputPath)}`, 'verbose');
      
      // Add delay between requests to respect rate limits
      if (retryCount === 0) {
        await Utils.delay(config.processing.requestDelay);
      }
      
      const result = await this.performOCR(inputPath);
      
      if (!result || !result.segments || result.segments.length === 0) {
        throw new Error('No text detected in image');
      }

      // Validate and preserve original script content
      const validatedResult = this.validateAndPreserveOriginalText(result);
      
      await this.saveResult(validatedResult, inputPath, outputPath);
      
      this.stats.successful++;
      Utils.log(`Successfully processed: ${path.basename(inputPath)} (Language: ${validatedResult.language || 'mixed'})`, 'success');
      
      return {
        success: true,
        inputPath,
        outputPath,
        textLength: validatedResult.segments.reduce((total, segment) => total + segment.text.length, 0),
        language: validatedResult.language || 'mixed',
        segmentCount: validatedResult.segments.length,
        languageInfo: validatedResult.languageInfo || {}
      };

    } catch (error) {
      const isRateLimitError = this.isRateLimitError(error);
      Utils.log(`Failed to process ${path.basename(inputPath)}: ${error.message}${isRateLimitError ? ' (Rate Limit)' : ''}`, 'error');
      
      if (retryCount < config.processing.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount, isRateLimitError);
        
        Utils.log(`Retrying ${path.basename(inputPath)} (attempt ${retryCount + 1}/${config.processing.maxRetries}) in ${Math.round(delay/1000)}s`, 'warning');
        await Utils.delay(delay);
        return this.processImage(inputPath, outputPath, retryCount + 1);
      }

      this.stats.failed++;
      await Utils.logError(inputPath, error);
      
      return {
        success: false,
        inputPath,
        outputPath,
        error: error.message,
        rateLimited: isRateLimitError
      };
    } finally {
      this.stats.processed++;
    }
  }

  isRateLimitError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toUpperCase() || '';
    
    return (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429') ||
      config.processing.apiErrorCodes.includes(errorCode) ||
      error.status === 429
    );
  }

  calculateRetryDelay(retryCount, isRateLimitError) {
    let baseDelay = config.processing.retryDelay;
    
    if (isRateLimitError) {
      baseDelay *= config.processing.rateLimitRetryMultiplier;
    }
    
    if (config.processing.exponentialBackoff) {
      baseDelay *= Math.pow(2, retryCount);
    }
    
    return Math.min(baseDelay, config.processing.maxRetryDelay);
  }

  async performOCR(imagePath) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`OCR timeout after ${config.processing.timeout}ms`));
      }, config.processing.timeout);

      this.lens.scanByFile(imagePath)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async saveResult(result, inputPath, outputPath) {
    const outputDir = path.dirname(outputPath);
    await Utils.ensureDirectoryExists(outputDir);

    let content = '';

    if (config.output.includeMetadata) {
      const fileStats = await Utils.getFileStats(inputPath);
      const timestamp = new Date().toISOString();
      
      content += `OCR Results for: ${path.basename(inputPath)}\n`;
      content += `Processed: ${timestamp}\n`;
      content += `File Size: ${fileStats.formattedSize}\n`;
      content += `Detected Language: ${result.language || 'Unknown'}\n`;
      content += `Text Segments: ${result.segments.length}\n`;
      content += `${'='.repeat(50)}\n\n`;
    }

    if (result.segments && result.segments.length > 0) {
      content += this.assembleTextWithParagraphs(result.segments);
    } else {
      content += 'No text detected in image.\n';
    }

    await fs.writeFile(outputPath, content, config.output.encoding);
  }

  assembleTextWithParagraphs(segments) {
    let assembledText = '';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      
      if (!segment.text || !segment.text.trim()) continue;
      
      const currentText = segment.text.trim();
      
      // Add the current segment text
      assembledText += currentText;
      
      // Determine spacing based on text patterns
      if (nextSegment && nextSegment.text && nextSegment.text.trim()) {
        const nextText = nextSegment.text.trim();
        
        // Check if current text ends with sentence-ending punctuation
        const endsWithSentence = /[।॥\.!\?]$/.test(currentText);
        
        // Check if next text starts with a new paragraph indicator
        const startsNewParagraph = /^[\[\(]|\d+[\.\)]|^[A-Za-z]+\s+[A-Za-z]+:/.test(nextText);
        
        // Check if current text is very short (likely a heading or standalone element)
        const isShortText = currentText.length < 10;
        
        // Check if next text is a continuation (doesn't start with capital or special chars)
        const isContinuation = !/^[A-Z\[\(]/.test(nextText) && 
                              !/^[\u0900-\u097F][\u0900-\u097F]*\s/.test(nextText);
        
        if (endsWithSentence || startsNewParagraph || isShortText) {
          // Add line break for new sentences/paragraphs
          assembledText += '\n';
        } else if (isContinuation) {
          // Add space for text continuation
          assembledText += ' ';
        } else {
          // Default: add line break
          assembledText += '\n';
        }
      }
    }
    
    return assembledText + '\n';
  }

  validateAndPreserveOriginalText(result) {
    if (!config.processing.preserveOriginalScript && !config.processing.validateTextIntegrity) {
      return result;
    }

    // Create a copy of the result to avoid modifying the original
    const validatedResult = {
      ...result,
      languageInfo: {
        detectedLanguage: result.language,
        scriptTypes: new Set(),
        mixedLanguages: false
      }
    };

    // Analyze each segment for script types and potential language mixing
    validatedResult.segments = result.segments.map((segment, index) => {
      if (!segment.text) return segment;

      const analysis = this.analyzeTextSegment(segment.text, result.language);
      
      // Track script types found
      analysis.scriptTypes.forEach(script => {
        validatedResult.languageInfo.scriptTypes.add(script);
      });

      // Check for mixed languages
      if (analysis.scriptTypes.size > 1) {
        validatedResult.languageInfo.mixedLanguages = true;
      }

      // Log potential translation issues
      if (analysis.possibleTranslation && config.processing.validateTextIntegrity) {
        Utils.log(`Potential translation detected in segment ${index + 1}: "${segment.text.substring(0, 50)}..."`, 'warning');
      }

      return {
        ...segment,
        analysis: analysis
      };
    });

    // Update language info based on analysis
    if (validatedResult.languageInfo.mixedLanguages) {
      validatedResult.language = 'mixed';
      Utils.log(`Mixed scripts detected: ${Array.from(validatedResult.languageInfo.scriptTypes).join(', ')}`, 'info');
    }

    return validatedResult;
  }

  analyzeTextSegment(text, detectedLanguage) {
    const analysis = {
      scriptTypes: new Set(),
      possibleTranslation: false,
      confidence: 'high'
    };

    // Unicode ranges for different scripts
    const scriptRanges = {
      devanagari: /[\u0900-\u097F]/g,        // Hindi, Sanskrit, Marathi
      gujarati: /[\u0A80-\u0AFF]/g,         // Gujarati
      latin: /[A-Za-z]/g,                   // English and others
      numbers: /[0-9]/g,                    // Numbers
      punctuation: /[।॥\.!\?,:;()[\]]/g    // Various punctuation
    };

    // Count characters in each script
    for (const [scriptName, regex] of Object.entries(scriptRanges)) {
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        analysis.scriptTypes.add(scriptName);
      }
    }

    // Check for potential translation issues
    // If detected language is Hindi but we have Gujarati script, flag it
    if (detectedLanguage === 'hi' && analysis.scriptTypes.has('gujarati')) {
      analysis.possibleTranslation = true;
      analysis.confidence = 'low';
    }

    // If detected language is Gujarati but we have Devanagari script (could be Sanskrit)
    if (detectedLanguage === 'gu' && analysis.scriptTypes.has('devanagari')) {
      analysis.possibleTranslation = false; // This is actually expected for Sanskrit+Gujarati
    }

    return analysis;
  }

  getStats() {
    const duration = this.stats.endTime ? 
      (this.stats.endTime - this.stats.startTime) / 1000 : 
      this.stats.startTime ? (Date.now() - this.stats.startTime) / 1000 : 0;

    return {
      ...this.stats,
      duration: Math.round(duration * 100) / 100,
      successRate: this.stats.processed > 0 ? 
        Math.round((this.stats.successful / this.stats.processed) * 100) : 0,
      avgTimePerFile: this.stats.processed > 0 ? 
        Math.round((duration / this.stats.processed) * 100) / 100 : 0
    };
  }

  startProcessing(totalFiles) {
    this.stats.totalFiles = totalFiles;
    this.stats.startTime = Date.now();
  }

  finishProcessing() {
    this.stats.endTime = Date.now();
  }

  async validateImageFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      if (stats.size === 0) {
        throw new Error('File is empty');
      }

      if (stats.size > 10 * 1024 * 1024) {
        Utils.log(`Large file detected: ${Utils.formatFileSize(stats.size)} - ${path.basename(filePath)}`, 'warning');
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!config.supportedExtensions.includes(ext)) {
        throw new Error(`Unsupported file extension: ${ext}`);
      }

      return true;
    } catch (error) {
      Utils.log(`Validation failed for ${path.basename(filePath)}: ${error.message}`, 'error');
      return false;
    }
  }
}