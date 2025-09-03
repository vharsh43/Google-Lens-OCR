#!/usr/bin/env node

/**
 * Enhanced API Server for Train Ticket Search System
 * 
 * Provides REST API endpoints for:
 * - Ticket search by PNR, passenger name, train details
 * - File upload and processing
 * - Real-time processing status
 * - Database statistics and analytics
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import chalk from 'chalk';
import { SupabaseClient } from '../supabase/client.js';
import { validateEnvironment } from '../env-validator.js';
import StreamlinedPDFPipeline from '../pdf-pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.supabase = null;
        this.pipeline = null;
        this.processingQueue = new Map();
        this.fileHashes = new Map(); // Track uploaded file hashes to prevent duplicates
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? process.env.FRONTEND_URL || 'http://localhost:3000'
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        }));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(chalk.gray(`[${timestamp}] ${req.method} ${req.path}`));
            next();
        });

        // File upload configuration
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadDir = path.join(__dirname, '../../1_Ticket_PDF');
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueName = `${Date.now()}-${file.originalname}`;
                cb(null, uniqueName);
            }
        });

        this.upload = multer({
            storage,
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'application/pdf') {
                    cb(null, true);
                } else {
                    cb(new Error('Only PDF files are allowed'), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB limit
            }
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            });
        });

        // Environment status
        this.app.get('/api/env-status', async (req, res) => {
            try {
                const envResult = await validateEnvironment();
                res.json(envResult);
            } catch (error) {
                res.status(500).json({
                    valid: false,
                    errors: [error.message]
                });
            }
        });

        // Database statistics
        this.app.get('/api/stats', async (req, res) => {
            try {
                if (!this.supabase) {
                    return res.json({ message: 'Supabase not connected', tickets: 0, passengers: 0 });
                }
                const stats = await this.supabase.getStatistics();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Search tickets by PNR
        this.app.get('/api/tickets/search/pnr/:pnr', async (req, res) => {
            try {
                if (!this.supabase) {
                    return res.status(503).json({ error: 'Database not available' });
                }
                const { pnr } = req.params;
                const results = await this.supabase.searchByPNR(pnr);
                res.json(results);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Search tickets by passenger name
        this.app.get('/api/tickets/search/passenger', async (req, res) => {
            try {
                const { name, age } = req.query;
                if (!name) {
                    return res.status(400).json({ error: 'Name parameter is required' });
                }
                
                const results = await this.supabase.searchByPassengerName(name, age);
                res.json(results);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Advanced ticket search
        this.app.post('/api/tickets/search', async (req, res) => {
            try {
                const searchParams = req.body;
                const results = await this.supabase.searchTickets(searchParams);
                res.json(results);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get journey timeline
        this.app.get('/api/tickets/:pnr/timeline', async (req, res) => {
            try {
                const { pnr } = req.params;
                const timeline = await this.supabase.getJourneyTimeline(pnr);
                res.json(timeline);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // File upload and processing with enhanced validation
        this.app.post('/api/upload', this.upload.single('pdf'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No PDF file uploaded' });
                }

                const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const filePath = req.file.path;
                const fileName = req.file.filename;

                console.log(chalk.blue(`📤 Processing upload: ${fileName}`));

                // Step 1: Validate PDF content
                const validation = await this.validatePDFContent(filePath);
                if (!validation.valid) {
                    await fs.unlink(filePath).catch(() => {}); // Clean up invalid file
                    return res.status(400).json({ error: validation.error });
                }

                // Step 2: Calculate file hash to check for duplicates
                const fileHash = await this.calculateFileHash(filePath);
                if (fileHash && this.fileHashes.has(fileHash)) {
                    const existingJob = this.fileHashes.get(fileHash);
                    await fs.unlink(filePath).catch(() => {}); // Clean up duplicate file
                    
                    console.log(chalk.yellow(`⚠️  Duplicate file detected: ${fileName}`));
                    return res.status(409).json({ 
                        error: 'Duplicate file detected', 
                        existingJobId: existingJob.jobId,
                        message: 'This file has already been processed'
                    });
                }

                // Step 3: Add to processing queue
                const jobData = {
                    status: 'queued',
                    fileName,
                    filePath,
                    fileHash,
                    uploadedAt: new Date(),
                    progress: 0
                };

                this.processingQueue.set(jobId, jobData);
                
                // Track file hash
                if (fileHash) {
                    this.fileHashes.set(fileHash, { jobId, fileName, uploadedAt: new Date() });
                }

                // Step 4: Process file asynchronously with enhanced error handling
                this.processUploadedFile(jobId, filePath).catch(error => {
                    console.error(chalk.red(`❌ Processing failed for job ${jobId}:`), error);
                    this.processingQueue.set(jobId, {
                        ...this.processingQueue.get(jobId),
                        status: 'failed',
                        error: error.message,
                        completedAt: new Date()
                    });
                });

                console.log(chalk.green(`✅ File queued for processing: ${jobId}`));
                res.json({
                    jobId,
                    fileName,
                    message: 'File uploaded successfully and queued for processing',
                    fileHash: fileHash?.substring(0, 8) + '...' // Show partial hash for reference
                });

            } catch (error) {
                console.error(chalk.red('Upload error:'), error);
                // Clean up file if it exists
                if (req.file?.path) {
                    await fs.unlink(req.file.path).catch(() => {});
                }
                res.status(500).json({ error: error.message });
            }
        });

        // Check processing status
        this.app.get('/api/status/:jobId', (req, res) => {
            const { jobId } = req.params;
            const job = this.processingQueue.get(jobId);
            
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            
            res.json(job);
        });

        // Get all processing jobs
        this.app.get('/api/jobs', (req, res) => {
            const jobs = Array.from(this.processingQueue.entries()).map(([id, job]) => ({
                id,
                ...job
            }));
            res.json(jobs);
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
                }
            }
            
            console.error(chalk.red('API Error:'), error);
            res.status(500).json({ error: 'Internal server error' });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
    }

    async calculateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const hashSum = createHash('md5');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            console.error('Error calculating file hash:', error);
            return null;
        }
    }

    async validatePDFContent(filePath) {
        try {
            // Basic PDF validation - check file header
            const buffer = await fs.readFile(filePath, { encoding: null });
            const pdfHeader = buffer.subarray(0, 4).toString();
            
            if (pdfHeader !== '%PDF') {
                return { valid: false, error: 'Invalid PDF file format' };
            }

            // Check file size (should be reasonable for train ticket)
            const stats = await fs.stat(filePath);
            if (stats.size > 15 * 1024 * 1024) { // 15MB
                return { valid: false, error: 'PDF file is too large' };
            }

            if (stats.size < 1024) { // 1KB
                return { valid: false, error: 'PDF file is too small or corrupted' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `PDF validation failed: ${error.message}` };
        }
    }

    async processUploadedFile(jobId, filePath) {
        try {
            console.log(chalk.blue(`🔄 Starting processing for job ${jobId}`));
            
            // Update status to processing
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                status: 'processing',
                progress: 10,
                startedAt: new Date()
            });

            // Step 1: Initialize pipeline with validation
            const pipeline = new StreamlinedPDFPipeline();
            pipeline.config.autoImport = true;
            pipeline.config.debugMode = false;
            
            await pipeline.initialize();
            console.log(chalk.green(`✓ Pipeline initialized for job ${jobId}`));

            // Update progress
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                progress: 25
            });

            // Step 2: Extract data from PDF
            console.log(chalk.blue(`📄 Extracting data from PDF: ${path.basename(filePath)}`));
            const extractionResult = await pipeline.processPDF(filePath);

            if (!extractionResult || !extractionResult.success) {
                throw new Error(`Data extraction failed: ${extractionResult?.error || 'Unknown extraction error'}`);
            }

            // Update progress
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                progress: 50
            });

            // Step 3: Enhanced field validation
            console.log(chalk.blue(`🔍 Validating extracted data for job ${jobId}`));
            const validationResult = await this.validateExtractedData(extractionResult);
            
            if (!validationResult.isValid) {
                console.warn(chalk.yellow(`⚠️ Validation issues found for job ${jobId}:`));
                validationResult.errors.forEach(error => {
                    console.warn(chalk.yellow(`  • ${error}`));
                });
            }

            // Update progress
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                progress: 70
            });

            // Step 4: Calculate cost per passenger
            const enhancedData = this.calculateCostPerPassenger(extractionResult);
            console.log(chalk.green(`💰 Cost calculations completed for job ${jobId}`));

            // Step 5: Check for passenger duplicates before database import
            if (this.supabase) {
                console.log(chalk.blue(`🔍 Checking for duplicate passengers for job ${jobId}`));
                const duplicateCheck = await this.checkPassengerDuplicates(enhancedData);
                
                if (duplicateCheck.hasDuplicates) {
                    console.warn(chalk.yellow(`⚠️ Potential duplicate passengers found for job ${jobId}:`));
                    duplicateCheck.duplicates.forEach(dup => {
                        console.warn(chalk.yellow(`  • ${dup.name} (${dup.age}) - PNR: ${dup.existingPNR}`));
                    });
                }
            }

            // Update progress
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                progress: 85
            });

            // Step 6: Store in database with transaction safety
            let databaseResult = null;
            if (this.supabase && enhancedData.pnr) {
                console.log(chalk.blue(`💾 Storing data in database for job ${jobId}`));
                databaseResult = await this.storeTicketData(enhancedData);
                
                if (databaseResult.success) {
                    console.log(chalk.green(`✅ Data successfully stored in database for PNR: ${enhancedData.pnr}`));
                } else {
                    console.warn(chalk.yellow(`⚠️ Database storage warning: ${databaseResult.error}`));
                }
            }

            // Update progress
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                progress: 95
            });

            // Step 7: Final result compilation
            const finalResult = {
                ...enhancedData,
                validation: validationResult,
                database: databaseResult,
                processing: {
                    jobId,
                    fileName: path.basename(filePath),
                    processedAt: new Date().toISOString(),
                    validationScore: validationResult.overallScore,
                    costPerPassenger: enhancedData.costAnalysis?.costPerPassenger || 0,
                    passengerCount: enhancedData.passengers?.length || 0
                }
            };

            // Update final status
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                status: 'completed',
                progress: 100,
                result: finalResult,
                completedAt: new Date(),
                validationScore: validationResult.overallScore,
                pnr: enhancedData.pnr
            });

            console.log(chalk.green(`✅ Processing completed successfully for job ${jobId} (PNR: ${enhancedData.pnr})`));

            // Clean up file after successful processing
            setTimeout(() => {
                fs.unlink(filePath).catch(console.error);
            }, 300000); // Delete after 5 minutes

            return finalResult;

        } catch (error) {
            console.error(chalk.red(`❌ Processing failed for job ${jobId}:`), error.message);
            
            // Update status to failed with detailed error info
            this.processingQueue.set(jobId, {
                ...this.processingQueue.get(jobId),
                status: 'failed',
                error: error.message,
                completedAt: new Date(),
                stackTrace: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });

            // Clean up file on failure
            setTimeout(() => {
                fs.unlink(filePath).catch(console.error);
            }, 60000); // Delete after 1 minute on failure

            throw error;
        }
    }

    async validateExtractedData(data) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            overallScore: 0,
            fieldScores: {}
        };

        let totalScore = 0;
        let maxScore = 0;

        // PNR validation
        maxScore += 100;
        if (!data.pnr || typeof data.pnr !== 'string') {
            validation.errors.push('Missing PNR');
            validation.fieldScores.pnr = 0;
        } else if (!/^[A-Z0-9]{10}$/.test(data.pnr)) {
            validation.errors.push('Invalid PNR format');
            validation.fieldScores.pnr = 30;
            totalScore += 30;
        } else {
            validation.fieldScores.pnr = 100;
            totalScore += 100;
        }

        // Passenger validation
        maxScore += 100;
        if (!data.passengers || !Array.isArray(data.passengers) || data.passengers.length === 0) {
            validation.errors.push('Missing or invalid passenger data');
            validation.fieldScores.passengers = 0;
        } else {
            let passengerScore = 0;
            const requiredFields = ['name', 'age', 'gender'];
            
            data.passengers.forEach((passenger, index) => {
                requiredFields.forEach(field => {
                    if (passenger[field] && passenger[field] !== null && passenger[field] !== '') {
                        passengerScore += (100 / (data.passengers.length * requiredFields.length));
                    } else {
                        validation.warnings.push(`Passenger ${index + 1}: Missing ${field}`);
                    }
                });
            });
            
            validation.fieldScores.passengers = Math.round(passengerScore);
            totalScore += passengerScore;
        }

        // Journey validation
        maxScore += 100;
        if (!data.journeys || !Array.isArray(data.journeys) || data.journeys.length === 0) {
            validation.errors.push('Missing or invalid journey data');
            validation.fieldScores.journeys = 0;
        } else {
            let journeyScore = 0;
            const requiredJourneyFields = ['train_number', 'boarding', 'destination'];
            
            data.journeys.forEach((journey, index) => {
                requiredJourneyFields.forEach(field => {
                    if (field === 'boarding' || field === 'destination') {
                        if (journey[field] && journey[field].station && journey[field].datetime) {
                            journeyScore += (100 / (data.journeys.length * requiredJourneyFields.length));
                        } else {
                            validation.warnings.push(`Journey ${index + 1}: Missing ${field} details`);
                        }
                    } else if (journey[field] && journey[field] !== null) {
                        journeyScore += (100 / (data.journeys.length * requiredJourneyFields.length));
                    } else {
                        validation.warnings.push(`Journey ${index + 1}: Missing ${field}`);
                    }
                });
            });
            
            validation.fieldScores.journeys = Math.round(journeyScore);
            totalScore += journeyScore;
        }

        // Payment validation
        maxScore += 50;
        if (!data.payment || typeof data.payment !== 'object') {
            validation.warnings.push('Missing payment information');
            validation.fieldScores.payment = 0;
        } else if (!data.payment.total || data.payment.total <= 0) {
            validation.warnings.push('Invalid payment total');
            validation.fieldScores.payment = 25;
            totalScore += 25;
        } else {
            validation.fieldScores.payment = 50;
            totalScore += 50;
        }

        validation.overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        validation.isValid = validation.errors.length === 0 && validation.overallScore >= 70;

        return validation;
    }

    calculateCostPerPassenger(data) {
        const enhancedData = { ...data };
        
        if (!enhancedData.costAnalysis) {
            enhancedData.costAnalysis = {};
        }

        const passengerCount = enhancedData.passengers?.length || 1;
        const totalFare = enhancedData.payment?.total || 0;
        const ticketFare = enhancedData.payment?.ticket_fare || totalFare;

        // Calculate cost per passenger
        const costPerPassenger = passengerCount > 0 ? (ticketFare / passengerCount) : 0;
        const totalCostPerPassenger = passengerCount > 0 ? (totalFare / passengerCount) : 0;

        enhancedData.costAnalysis = {
            totalPassengers: passengerCount,
            totalFare: totalFare,
            ticketFare: ticketFare,
            costPerPassenger: Math.round(costPerPassenger * 100) / 100,
            totalCostPerPassenger: Math.round(totalCostPerPassenger * 100) / 100,
            additionalCharges: totalFare - ticketFare,
            averageAdditionalChargesPerPassenger: passengerCount > 0 ? 
                Math.round(((totalFare - ticketFare) / passengerCount) * 100) / 100 : 0
        };

        // Add cost per passenger to each passenger record
        if (enhancedData.passengers && Array.isArray(enhancedData.passengers)) {
            enhancedData.passengers = enhancedData.passengers.map(passenger => ({
                ...passenger,
                allocated_cost: {
                    ticket_share: costPerPassenger,
                    total_share: totalCostPerPassenger,
                    additional_charges_share: enhancedData.costAnalysis.averageAdditionalChargesPerPassenger
                }
            }));
        }

        return enhancedData;
    }

    async checkPassengerDuplicates(data) {
        if (!this.supabase || !data.passengers) {
            return { hasDuplicates: false, duplicates: [] };
        }

        try {
            const duplicates = [];
            
            for (const passenger of data.passengers) {
                if (!passenger.name || !passenger.age) continue;
                
                // Search for existing passengers with same name and age
                const { data: existingPassengers, error } = await this.supabase.client
                    .from('passengers')
                    .select(`
                        name, age, gender,
                        ticket:tickets!inner(pnr, ticket_print_time)
                    `)
                    .eq('name', passenger.name.toUpperCase())
                    .eq('age', passenger.age);

                if (!error && existingPassengers && existingPassengers.length > 0) {
                    // Check if it's from a different PNR
                    const differentPNRs = existingPassengers.filter(existing => 
                        existing.ticket.pnr !== data.pnr
                    );

                    if (differentPNRs.length > 0) {
                        duplicates.push({
                            name: passenger.name,
                            age: passenger.age,
                            gender: passenger.gender,
                            existingPNR: differentPNRs[0].ticket.pnr,
                            existingTicketDate: differentPNRs[0].ticket.ticket_print_time,
                            matchCount: differentPNRs.length
                        });
                    }
                }
            }

            return {
                hasDuplicates: duplicates.length > 0,
                duplicates,
                totalDuplicatePassengers: duplicates.length
            };

        } catch (error) {
            console.error('Error checking passenger duplicates:', error);
            return { hasDuplicates: false, duplicates: [], error: error.message };
        }
    }

    async storeTicketData(data) {
        if (!this.supabase) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            // Use the existing SupabaseTicketOperations for consistent data storage
            const operations = this.supabase.operations || this.supabase;
            const result = await operations.importTicketData(data, `uploaded_${Date.now()}.pdf`);
            
            return {
                success: result.success,
                action: result.action,
                ticketId: result.ticketId,
                pnr: result.pnr,
                error: result.error
            };

        } catch (error) {
            console.error('Error storing ticket data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async initialize() {
        try {
            console.log(chalk.blue.bold('🌐 Starting Enhanced API Server'));
            console.log(chalk.gray('================================'));

            // Validate environment
            const envResult = await validateEnvironment();
            if (!envResult.valid) {
                console.warn(chalk.yellow('⚠ Environment validation warnings:'));
                envResult.errors.forEach(error => {
                    console.warn(chalk.yellow(`  • ${error}`));
                });
            }

            // Initialize Supabase
            try {
                this.supabase = new SupabaseClient();
                await this.supabase.initialize();
                console.log(chalk.green('✓ Supabase connection established'));
            } catch (error) {
                console.warn(chalk.yellow('⚠ Supabase connection failed, running in limited mode'));
                console.warn(chalk.gray(`  Error: ${error.message}`));
                this.supabase = null;
            }

            // Initialize pipeline
            this.pipeline = new StreamlinedPDFPipeline();
            console.log(chalk.green('✓ PDF Pipeline initialized'));

            console.log(chalk.green('✓ API Server initialization complete\n'));

        } catch (error) {
            console.error(chalk.red('✗ API Server initialization failed:'), error.message);
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            this.app.listen(this.port, () => {
                console.log(chalk.green.bold(`🚀 API Server running on port ${this.port}`));
                console.log(chalk.cyan(`📍 Local: http://localhost:${this.port}`));
                console.log(chalk.cyan(`📋 Health: http://localhost:${this.port}/health`));
                console.log(chalk.cyan(`🔍 API Docs: http://localhost:${this.port}/api`));
                console.log(chalk.gray(`\n📁 Upload directory: 1_Ticket_PDF/`));
                console.log(chalk.gray(`📤 Max file size: 10MB`));
                console.log(chalk.gray(`🎯 Supported: PDF files only\n`));
            });

        } catch (error) {
            console.error(chalk.red('Failed to start server:'), error.message);
            process.exit(1);
        }
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new EnhancedAPIServer();
    server.start().catch(console.error);
}

export default EnhancedAPIServer;