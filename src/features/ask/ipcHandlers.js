const { ipcMain } = require('electron');
const askService = require('./askService');

/**
 * IPC Handlers for Ask Service
 * Handles all IPC communication for the Ask feature with desktop capture
 */
class AskIPCHandlers {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize IPC handlers
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }

        console.log('[AskIPC] Initializing IPC handlers...');

        // Ask service handlers
        this.setupAskHandlers();
        
        // Desktop capture handlers
        this.setupDesktopCaptureHandlers();

        this.isInitialized = true;
        console.log('[AskIPC] IPC handlers initialized');
    }

    /**
     * Setup ask service IPC handlers
     */
    setupAskHandlers() {
        // Ask a question
        ipcMain.handle('ask:question', async (event, question, options = {}) => {
            try {
                console.log('[AskIPC] Processing question:', question);
                const result = await askService.askQuestion(question, options);
                return { success: true, result };
            } catch (error) {
                console.error('[AskIPC] Ask question error:', error);
                return { success: false, error: error.message };
            }
        });

        // Set AI model
        ipcMain.handle('ask:setModel', async (event, model) => {
            try {
                await askService.setModel(model);
                return { success: true };
            } catch (error) {
                console.error('[AskIPC] Set model error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get current model
        ipcMain.handle('ask:getModel', async (event) => {
            try {
                const model = askService.getCurrentModel();
                return { success: true, model };
            } catch (error) {
                console.error('[AskIPC] Get model error:', error);
                return { success: false, error: error.message };
            }
        });

        // Check if processing
        ipcMain.handle('ask:isProcessing', async (event) => {
            try {
                const isProcessing = askService.isCurrentlyProcessing();
                return { success: true, isProcessing };
            } catch (error) {
                console.error('[AskIPC] Is processing error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get processing history
        ipcMain.handle('ask:getHistory', async (event, limit = 10) => {
            try {
                const history = askService.getHistory(limit);
                return { success: true, history };
            } catch (error) {
                console.error('[AskIPC] Get history error:', error);
                return { success: false, error: error.message };
            }
        });

        // Clear processing history
        ipcMain.handle('ask:clearHistory', async (event) => {
            try {
                askService.clearHistory();
                return { success: true };
            } catch (error) {
                console.error('[AskIPC] Clear history error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get service status
        ipcMain.handle('ask:getStatus', async (event) => {
            try {
                const status = askService.getStatus();
                return { success: true, status };
            } catch (error) {
                console.error('[AskIPC] Get status error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get metrics
        ipcMain.handle('ask:getMetrics', async (event) => {
            try {
                const metrics = askService.getMetrics();
                return { success: true, metrics };
            } catch (error) {
                console.error('[AskIPC] Get metrics error:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup desktop capture IPC handlers
     */
    setupDesktopCaptureHandlers() {
        // NOTE: ask:captureScreenshot and ask:getSources are handled by featureBridge
        // to avoid duplicate handler registration
        
        // Additional desktop capture handlers can be added here if needed

        // Setup display media handler (Windows)
        ipcMain.handle('ask:setupDisplayMediaHandler', async (event) => {
            try {
                console.log('[AskIPC] Setting up display media handler...');
                const result = await askService.desktopCapture.setupDisplayMediaHandler();
                return result;
            } catch (error) {
                console.error('[AskIPC] Setup display media handler error:', error);
                return { success: false, error: error.message };
            }
        });

        // Update desktop capture configuration
        ipcMain.handle('ask:updateCaptureConfig', async (event, config) => {
            try {
                askService.desktopCapture.updateConfig(config);
                return { success: true };
            } catch (error) {
                console.error('[AskIPC] Update capture config error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get desktop capture metrics
        ipcMain.handle('ask:getCaptureMetrics', async (event) => {
            try {
                const metrics = askService.desktopCapture.getCaptureMetrics();
                return { success: true, metrics };
            } catch (error) {
                console.error('[AskIPC] Get capture metrics error:', error);
                return { success: false, error: error.message };
            }
        });

        // Reset desktop capture metrics
        ipcMain.handle('ask:resetCaptureMetrics', async (event) => {
            try {
                askService.desktopCapture.resetMetrics();
                return { success: true };
            } catch (error) {
                console.error('[AskIPC] Reset capture metrics error:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup event broadcasting
     */
    setupEventBroadcasting() {
        // Set up service callbacks to broadcast events
        askService.desktopCapture.on('screenshotCaptured', (data) => {
            this.broadcastEvent('ask:screenshotCaptured', data);
        });

        askService.desktopCapture.on('error', (error) => {
            this.broadcastEvent('ask:error', { message: error.message, timestamp: Date.now() });
        });

        askService.desktopCapture.on('configUpdated', (config) => {
            this.broadcastEvent('ask:configUpdated', config);
        });
    }

    /**
     * Broadcast event to all windows
     */
    broadcastEvent(channel, data) {
        try {
            const { windowPool } = require('../../window/windowManager');
            
            for (const [name, window] of windowPool) {
                if (window && !window.isDestroyed()) {
                    window.webContents.send(channel, data);
                }
            }
        } catch (error) {
            console.error('[AskIPC] Broadcast error:', error);
        }
    }

    /**
     * Clean up IPC handlers
     */
    cleanup() {
        if (!this.isInitialized) {
            return;
        }

        console.log('[AskIPC] Cleaning up IPC handlers...');

        // Remove all IPC handlers
        const handlers = [
            'ask:question', 'ask:setModel', 'ask:getModel', 'ask:isProcessing',
            'ask:getHistory', 'ask:clearHistory', 'ask:getStatus', 'ask:getMetrics',
            'ask:captureScreenshot', 'ask:getSources', 'ask:setupDisplayMediaHandler',
            'ask:updateCaptureConfig', 'ask:getCaptureMetrics', 'ask:resetCaptureMetrics'
        ];

        handlers.forEach(handler => {
            ipcMain.removeAllListeners(handler);
        });

        this.isInitialized = false;
        console.log('[AskIPC] IPC handlers cleaned up');
    }
}

module.exports = new AskIPCHandlers();
