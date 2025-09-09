const desktopCaptureService = require('./services/desktopCaptureService');
const { createStreamingLLM } = require('../common/ai/providers/openai');
const settingsService = require('../settings/settingsService');

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
        
        // Streaming state
        this.state = {
            isVisible: false,
            isLoading: false,
            isStreaming: false,
            currentQuestion: '',
            currentResponse: '',
            showTextInput: true
        };
        
        // Abort controller for streaming
        this.abortController = null;
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
     * Process the question with AI
     */
    async _processQuestion(question, screenshot, options) {
        try {
            // Get API key from settings
            const settings = await settingsService.getSettings();
            const apiKey = settings.openaiApiKey;
            
            if (!apiKey || !apiKey.startsWith('sk-')) {
                console.error('[AskService] No valid OpenAI API key found in settings');
                return 'Please configure your OpenAI API key in Settings to use AI features.';
            }
            
            console.log('[AskService] Using OpenAI API with key:', apiKey.substring(0, 7) + '...');
            
            // Prepare messages for OpenAI
            let messages;
            if (screenshot) {
                // Use vision model for screenshot analysis
                messages = [
                    { role: 'system', content: 'You are a helpful AI assistant that can analyze screenshots and answer questions about what you see.' },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: question },
                            { 
                                type: 'image_url', 
                                image_url: { 
                                    url: `data:image/jpeg;base64,${screenshot.base64}`,
                                    detail: 'auto'
                                } 
                            }
                        ]
                    }
                ];
            } else {
                // Text-only query
                messages = [
                    { role: 'system', content: 'You are a helpful AI assistant.' },
                    { role: 'user', content: question }
                ];
            }
            
            // Use the appropriate model
            const model = screenshot ? 'gpt-4o' : (options.model || 'gpt-4o');
            
            // Create streaming LLM and get response
            const streamingLLM = createStreamingLLM({ 
                apiKey, 
                model,
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 2048
            });
            
            const response = await streamingLLM.streamChat(messages);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            
            // Read the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(l => l.trim() !== '');
                
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    
                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                        }
                    } catch (e) {
                        // Ignore partial JSON
                    }
                }
            }
            
            console.log('[AskService] AI response received, length:', fullResponse.length);
            return fullResponse || 'No response received from AI.';
            
        } catch (error) {
            console.error('[AskService] Error processing with AI:', error);
            
            // Check if it's a vision model error and retry with text-only
            if (screenshot && error.message?.includes('vision')) {
                console.log('[AskService] Vision model failed, retrying with text-only...');
                return this._processQuestion(question, null, options);
            }
            
            return `Error: ${error.message || 'Failed to process your question with AI.'}`;
        }
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

    /**
     * Stream a message to an AI model and update internal state as tokens arrive
     */
    async sendMessage(userPrompt, opts = {}) {
        // Get API key from settings if not provided
        const settings = await settingsService.getSettings();
        const {
            apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY || '',
            model = 'gpt-4-turbo-preview',
            temperature = 0.7,
            maxTokens = 2048,
            includeScreenshot = false
        } = opts;

        if (!apiKey || !apiKey.startsWith('sk-')) {
            console.error('[AskService] Invalid or missing OpenAI API key');
            throw new Error('Please configure your OpenAI API key in Settings.');
        }
        
        console.log('[AskService] Sending message with API key:', apiKey.substring(0, 7) + '...');

        // Cancel any ongoing stream
        if (this.abortController) {
            try { this.abortController.abort('Starting new request'); } catch (_) {}
        }
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        // Reset and broadcast state
        this.state.isVisible = true;
        this.state.isLoading = true;
        this.state.isStreaming = false;
        this.state.currentQuestion = userPrompt;
        this.state.currentResponse = '';
        this.state.showTextInput = false;
        this._broadcastState();

        // Optional screenshot for multimodal
        let messages;
        if (includeScreenshot) {
            try {
                const captureResult = await this.desktopCapture.captureScreenshot({ quality: 70, maxWidth: 1280, maxHeight: 720 });
                if (captureResult?.success && captureResult.base64) {
                    messages = [
                        { role: 'system', content: 'You are a helpful AI assistant that can analyze screenshots and answer questions about what you see.' },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: userPrompt },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${captureResult.base64}` } }
                            ]
                        }
                    ];
                }
            } catch (e) {
                console.warn('[AskService] Screenshot unavailable, continuing text-only:', e.message);
            }
        }
        if (!messages) {
            messages = [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: userPrompt }
            ];
        }

        // Create streaming LLM
        const streamingLLM = createStreamingLLM({ apiKey, model, temperature, maxTokens });

        try {
            const response = await streamingLLM.streamChat(messages);
            const reader = response.body.getReader();

            // Handle aborts
            signal.addEventListener('abort', () => {
                try { reader.cancel(signal.reason); } catch (_) {}
            });

            await this._processStream(reader, signal);
            return { success: true, response: this.state.currentResponse };
        } catch (error) {
            // End state on error
            this.state.isLoading = false;
            this.state.isStreaming = false;
            this.state.showTextInput = true;
            this._broadcastState();
            console.error('[AskService] Streaming error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process an SSE streaming response
     */
    async _processStream(reader, signal) {
        const decoder = new TextDecoder();
        let fullResponse = '';
        this.state.isLoading = false;
        this.state.isStreaming = true;
        this._broadcastState();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(l => l.trim() !== '');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        break;
                    }
                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                            this.state.currentResponse = fullResponse;
                            this._broadcastState();
                        }
                    } catch (_) {
                        // ignore partial JSON
                    }
                }
            }
        } catch (err) {
            if (signal.aborted) {
                console.log('[AskService] Stream aborted:', signal.reason);
            } else {
                console.error('[AskService] Stream processing error:', err);
            }
        } finally {
            this.state.isStreaming = false;
            this.state.isLoading = false;
            this.state.showTextInput = true;
            this._broadcastState();
        }
    }

    /** Stop current streaming response if active */
    stopStreaming(reason = 'User cancelled') {
        if (this.abortController) {
            try { this.abortController.abort(reason); } catch (_) {}
        }
    }

    /** Placeholder for state updates (wire to IPC/UI as needed) */
    _broadcastState() {
        // In this codebase, we simply log. Hook into IPC/UI where applicable.
        try {
            console.log('[AskService] State:', JSON.stringify(this.state));
        } catch (_) {}
    }

    /**
     * Determine if error is multimodal-related
     * @private
     */
    _isMultimodalError(error) {
        const errorMessage = error.message?.toLowerCase() || '';
        return (
            errorMessage.includes('vision') ||
            errorMessage.includes('image') ||
            errorMessage.includes('multimodal') ||
            errorMessage.includes('unsupported') ||
            errorMessage.includes('image_url') ||
            errorMessage.includes('400') ||  // Bad Request often for unsupported features
            errorMessage.includes('invalid') ||
            errorMessage.includes('not supported')
        );
    }

    /**
     * Send message with multimodal fallback on error
     */
    async sendMessageWithFallback(userPrompt, opts = {}) {
        const { includeScreenshot = false, ...restOpts } = opts;
        
        try {
            return await this.sendMessage(userPrompt, { ...restOpts, includeScreenshot });
        } catch (error) {
            // If multimodal request failed and screenshot was included, retry with text-only
            if (includeScreenshot && this._isMultimodalError(error)) {
                console.log(`[AskService] Multimodal request failed, retrying with text-only: ${error.message}`);
                return await this.sendMessage(userPrompt, { ...restOpts, includeScreenshot: false });
            } else {
                throw error;
            }
        }
    }
}

module.exports = new AskService();
