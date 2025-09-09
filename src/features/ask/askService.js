const desktopCaptureService = require('./services/desktopCaptureService');

class AskService {
    constructor() {
        this.isProcessing = false;
        this.currentModel = 'gpt-4';
        this.isInitialized = false;
        
        // Desktop capture integration
        this.desktopCapture = desktopCaptureService;
        
        // Processing state
        this.processingHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Initialize the Ask service
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log('[AskService] Initializing...');
            
            // Initialize desktop capture service
            await this.desktopCapture.initialize();
            
            this.isInitialized = true;
            console.log('[AskService] ✅ Initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('[AskService] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ask a question with optional screenshot capture
     */
    async askQuestion(question, options = {}) {
        try {
            this.isProcessing = true;
            console.log('[AskService] Processing question:', question);
            
            const startTime = Date.now();
            let screenshot = null;
            
            // Capture screenshot if requested
            if (options.includeScreenshot !== false) {
                try {
                    console.log('[AskService] Capturing screenshot...');
                    const captureResult = await this.desktopCapture.captureScreenshot({
                        quality: options.screenshotQuality || 70,
                        maxWidth: options.screenshotWidth || 1920,
                        maxHeight: options.screenshotHeight || 1080
                    });
                    
                    if (captureResult.success) {
                        screenshot = {
                            base64: captureResult.base64,
                            width: captureResult.width,
                            height: captureResult.height,
                            source: captureResult.source,
                            metadata: captureResult.metadata
                        };
                        console.log('[AskService] ✅ Screenshot captured');
                    } else {
                        console.warn('[AskService] ⚠️ Screenshot capture failed:', captureResult.error);
                    }
                } catch (error) {
                    console.warn('[AskService] ⚠️ Screenshot capture error:', error.message);
                }
            }
            
            // Process the question (simulate AI processing)
            const processingTime = Date.now() - startTime;
            const answer = await this._processQuestion(question, screenshot, options);
            
            // Create response
            const response = {
                answer,
                model: this.currentModel,
                timestamp: new Date().toISOString(),
                processingTime,
                screenshot: screenshot ? {
                    width: screenshot.width,
                    height: screenshot.height,
                    source: screenshot.source,
                    metadata: screenshot.metadata
                } : null,
                hasScreenshot: !!screenshot
            };
            
            // Add to history
            this._addToHistory({
                question,
                response,
                timestamp: Date.now()
            });
            
            this.isProcessing = false;
            console.log(`[AskService] ✅ Question processed (${processingTime}ms)`);
            
            return response;
            
        } catch (error) {
            this.isProcessing = false;
            console.error('[AskService] ❌ Question processing failed:', error);
            throw error;
        }
    }

    /**
     * Process the question with AI (simulated)
     */
    async _processQuestion(question, screenshot, options) {
        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Simulate different responses based on content
        let answer = `This is a simulated response to: "${question}"`;
        
        if (screenshot) {
            answer += `\n\nI can see a screenshot (${screenshot.width}x${screenshot.height}) from ${screenshot.source.name}. `;
            answer += `The image appears to be captured at ${new Date(screenshot.metadata.timestamp).toLocaleTimeString()}.`;
        }
        
        if (question.toLowerCase().includes('screenshot') || question.toLowerCase().includes('screen')) {
            answer += `\n\nI can help you analyze what's on your screen. The screenshot shows your current desktop state.`;
        }
        
        return answer;
    }

    /**
     * Capture screenshot only
     */
    async captureScreenshot(options = {}) {
        try {
            console.log('[AskService] Capturing screenshot...');
            
            const result = await this.desktopCapture.captureScreenshot(options);
            
            if (result.success) {
                console.log('[AskService] ✅ Screenshot captured');
                // Map base64 to screenshot for frontend compatibility
                return {
                    ...result,
                    screenshot: result.base64
                };
            } else {
                console.error('[AskService] ❌ Screenshot capture failed:', result.error);
            }
            
            return result;
            
        } catch (error) {
            console.error('[AskService] ❌ Screenshot capture error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available screen sources
     */
    async getAvailableSources() {
        try {
            return await this.desktopCapture.getAvailableSources();
        } catch (error) {
            console.error('[AskService] ❌ Get sources error:', error);
            return {
                success: false,
                error: error.message,
                sources: []
            };
        }
    }

    /**
     * Set AI model
     */
    async setModel(model) {
        this.currentModel = model;
        console.log('[AskService] Model set to:', model);
    }

    /**
     * Get current model
     */
    getCurrentModel() {
        return this.currentModel;
    }

    /**
     * Check if currently processing
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }

    /**
     * Get processing history
     */
    getHistory(limit = 10) {
        return this.processingHistory
            .slice(-limit)
            .map(entry => ({
                question: entry.question,
                answer: entry.response.answer,
                timestamp: entry.timestamp,
                hasScreenshot: entry.response.hasScreenshot,
                processingTime: entry.response.processingTime
            }));
    }

    /**
     * Clear processing history
     */
    clearHistory() {
        this.processingHistory = [];
        console.log('[AskService] History cleared');
    }

    /**
     * Add entry to processing history
     */
    _addToHistory(entry) {
        this.processingHistory.push(entry);
        
        // Maintain max history size
        if (this.processingHistory.length > this.maxHistorySize) {
            this.processingHistory = this.processingHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            currentModel: this.currentModel,
            historySize: this.processingHistory.length,
            desktopCaptureStatus: this.desktopCapture.getStatus()
        };
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.desktopCapture.getCaptureMetrics(),
            processingHistory: {
                totalEntries: this.processingHistory.length,
                averageProcessingTime: this.processingHistory.length > 0 ? 
                    this.processingHistory.reduce((sum, entry) => sum + entry.response.processingTime, 0) / this.processingHistory.length : 0
            }
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('[AskService] Cleaning up...');
            
            // Cleanup desktop capture service
            await this.desktopCapture.cleanup();
            
            // Clear history
            this.processingHistory = [];
            
            // Reset state
            this.isInitialized = false;
            this.isProcessing = false;
            
            console.log('[AskService] ✅ Cleanup complete');
            
        } catch (error) {
            console.error('[AskService] ❌ Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new AskService();
