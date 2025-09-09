const BaseService = require('../../services/core/BaseService');
const askService = require('./askService');
const askIPCHandlers = require('./ipcHandlers');

/**
 * AskServiceWrapper - Wraps the Ask service for integration with ServiceRegistry
 */
class AskServiceWrapper extends BaseService {
    constructor() {
        super('AskService');
        this.askService = askService;
        this.askIPCHandlers = askIPCHandlers;
    }

    /**
     * Initialize the Ask service
     */
    async onInitialize() {
        try {
            console.log('[AskServiceWrapper] Initializing Ask service...');
            
            // Initialize the Ask service
            await this.askService.initialize();
            
            // Initialize IPC handlers
            this.askIPCHandlers.initialize();
            
            // Setup event broadcasting
            this.askIPCHandlers.setupEventBroadcasting();
            
            console.log('[AskServiceWrapper] ✅ Ask service initialized');
            
        } catch (error) {
            console.error('[AskServiceWrapper] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start the Ask service
     */
    async onStart() {
        try {
            console.log('[AskServiceWrapper] Starting Ask service...');
            
            // Ask service doesn't need explicit starting
            // It's ready to handle requests after initialization
            
            console.log('[AskServiceWrapper] ✅ Ask service started');
            
        } catch (error) {
            console.error('[AskServiceWrapper] ❌ Start failed:', error);
            throw error;
        }
    }

    /**
     * Stop the Ask service
     */
    async onStop() {
        try {
            console.log('[AskServiceWrapper] Stopping Ask service...');
            
            // Cleanup IPC handlers
            this.askIPCHandlers.cleanup();
            
            // Cleanup Ask service
            await this.askService.cleanup();
            
            console.log('[AskServiceWrapper] ✅ Ask service stopped');
            
        } catch (error) {
            console.error('[AskServiceWrapper] ❌ Stop failed:', error);
            throw error;
        }
    }

    /**
     * Get service health status
     */
    getHealthStatus() {
        try {
            const status = this.askService.getStatus();
            const metrics = this.askService.getMetrics();
            
            return {
                healthy: status.isInitialized && !status.isProcessing,
                status: status.isInitialized ? 'ready' : 'not_initialized',
                details: {
                    isInitialized: status.isInitialized,
                    isProcessing: status.isProcessing,
                    currentModel: status.currentModel,
                    historySize: status.historySize,
                    desktopCaptureStatus: status.desktopCaptureStatus,
                    metrics: {
                        capturesPerformed: metrics.capturesPerformed,
                        averageCaptureTime: metrics.averageCaptureTime,
                        errors: metrics.errors
                    }
                }
            };
        } catch (error) {
            return {
                healthy: false,
                status: 'error',
                details: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Get service metrics
     */
    getMetrics() {
        try {
            return this.askService.getMetrics();
        } catch (error) {
            console.error('[AskServiceWrapper] Error getting metrics:', error);
            return {
                error: error.message
            };
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        try {
            return this.askService.getStatus();
        } catch (error) {
            console.error('[AskServiceWrapper] Error getting status:', error);
            return {
                error: error.message
            };
        }
    }
}

module.exports = AskServiceWrapper;
