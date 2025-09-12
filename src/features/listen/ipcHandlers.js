const { ipcMain } = require('electron');
const listenService = require('./listenService');
const listenCapture = require('./services/listenCapture');
const permissionService = require('./services/permissionService');

/**
 * IPC Handlers for Listen Service
 * Handles all IPC communication for screen capture and audio recording
 */
class ListenIPCHandlers {
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

        console.log('[ListenIPC] Initializing IPC handlers...');

        // Listen service handlers
        this.setupListenHandlers();
        
        // Screen capture handlers
        this.setupScreenCaptureHandlers();
        
        // Permission handlers
        this.setupPermissionHandlers();
        
        // Audio processing handlers
        this.setupAudioHandlers();

        this.isInitialized = true;
        console.log('[ListenIPC] IPC handlers initialized');
    }

    /**
     * Setup listen service IPC handlers
     */
    setupListenHandlers() {
        // NOTE: listen:start, listen:stop, and listen:status are handled by featureBridge
        // to avoid duplicate handler registration
        
        // Get listening status (different endpoint from featureBridge)
        ipcMain.handle('listen:getStatus', async (event) => {
            try {
                const status = listenService.getStatus();
                return { success: true, status };
            } catch (error) {
                console.error('[ListenIPC] Get status error:', error);
                return { success: false, error: error.message };
            }
        });

        // Start transcription
        ipcMain.handle('listen:startTranscription', async (event) => {
            try {
                await listenService.startTranscription();
                return { success: true };
            } catch (error) {
                console.error('[ListenIPC] Start transcription error:', error);
                return { success: false, error: error.message };
            }
        });

        // Stop transcription
        ipcMain.handle('listen:stopTranscription', async (event) => {
            try {
                await listenService.stopTranscription();
                return { success: true };
            } catch (error) {
                console.error('[ListenIPC] Stop transcription error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get metrics
        ipcMain.handle('listen:getMetrics', async (event) => {
            try {
                const metrics = listenService.getMetrics();
                return { success: true, metrics };
            } catch (error) {
                console.error('[ListenIPC] Get metrics error:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup screen capture IPC handlers
     */
    setupScreenCaptureHandlers() {
        // Get available screen sources
        ipcMain.handle('screen:getSources', async (event, options = {}) => {
            try {
                console.log('[ListenIPC] Getting screen sources...');
                
                const sources = await listenCapture.getScreenSources(options);

                return {
                    success: true,
                    sources: sources.map(source => ({
                        id: source.id,
                        name: source.name,
                        thumbnail: source.thumbnail.toDataURL(),
                        display_id: source.display_id
                    }))
                };
            } catch (error) {
                console.error('[ListenIPC] Get sources error:', error);
                return { success: false, error: error.message };
            }
        });

        // Start screen capture
        ipcMain.handle('screen:startCapture', async (event, sourceId, options = {}) => {
            try {
                console.log('[ListenIPC] Starting screen capture for source:', sourceId);
                
                const result = await listenCapture.startScreenCapture(sourceId, options);
                return { success: result, sourceId, options };
            } catch (error) {
                console.error('[ListenIPC] Start screen capture error:', error);
                return { success: false, error: error.message };
            }
        });

        // Stop screen capture
        ipcMain.handle('screen:stopCapture', async (event) => {
            try {
                console.log('[ListenIPC] Stopping screen capture...');
                
                const result = await listenCapture.stopScreenCapture();
                return { success: result };
            } catch (error) {
                console.error('[ListenIPC] Stop screen capture error:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup permission IPC handlers
     */
    setupPermissionHandlers() {
        // Check permissions
        ipcMain.handle('permissions:check', async (event, permissionType) => {
            try {
                const hasPermission = await permissionService.hasPermission(permissionType);
                return { success: true, hasPermission };
            } catch (error) {
                console.error('[ListenIPC] Check permission error:', error);
                return { success: false, error: error.message };
            }
        });

        // Request permissions
        ipcMain.handle('permissions:request', async (event, permissionType) => {
            try {
                let result;
                switch (permissionType) {
                    case 'microphone':
                        result = await permissionService.requestMicrophonePermission();
                        break;
                    case 'screen':
                        result = await permissionService.requestScreenPermission();
                        break;
                    case 'systemAudio':
                        result = await permissionService.requestSystemAudioPermission();
                        break;
                    default:
                        throw new Error(`Unknown permission type: ${permissionType}`);
                }
                return { success: result.success, granted: result.status === 'granted' };
            } catch (error) {
                console.error('[ListenIPC] Request permission error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get all permissions
        ipcMain.handle('permissions:getAll', async (event) => {
            try {
                const permissions = await permissionService.getAllPermissions();
                return { success: true, permissions };
            } catch (error) {
                console.error('[ListenIPC] Get all permissions error:', error);
                return { success: false, error: error.message };
            }
        });

        // Request all required permissions
        ipcMain.handle('permissions:requestAll', async (event) => {
            try {
                const results = await permissionService.requestAllPermissions();
                return { success: true, results };
            } catch (error) {
                console.error('[ListenIPC] Request all permissions error:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup audio processing IPC handlers
     */
    setupAudioHandlers() {
        // Get audio configuration
        ipcMain.handle('audio:getConfig', async (event) => {
            try {
                const config = listenService.processor.config;
                return { success: true, config };
            } catch (error) {
                console.error('[ListenIPC] Get audio config error:', error);
                return { success: false, error: error.message };
            }
        });

        // Update audio configuration
        ipcMain.handle('audio:updateConfig', async (event, config) => {
            try {
                listenService.processor.updateConfig(config);
                return { success: true };
            } catch (error) {
                console.error('[ListenIPC] Update audio config error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get audio metrics
        ipcMain.handle('audio:getMetrics', async (event) => {
            try {
                const metrics = listenService.processor.getMetrics();
                return { success: true, metrics };
            } catch (error) {
                console.error('[ListenIPC] Get audio metrics error:', error);
                return { success: false, error: error.message };
            }
        });

        // Reset audio processor
        ipcMain.handle('audio:reset', async (event) => {
            try {
                listenService.processor.reset();
                return { success: true };
            } catch (error) {
                console.error('[ListenIPC] Reset audio processor error:', error);
                return { success: false, error: error.message };
            }
        });

        // Update echo cancellation config
        ipcMain.handle('audio:updateEchoCancellation', async (event, config) => {
            try {
                listenService.processor.echoCancellation.updateConfig(config);
                return { success: true };
            } catch (error) {
                console.error('[ListenIPC] Update echo cancellation error:', error);
                return { success: false, error: error.message };
            }
        });

        // Set microphone mute state
        ipcMain.handle('audio:setMicrophoneMute', async (event, muted) => {
            console.log(`\n[ListenIPC] 🎤 Received mute request from renderer: ${muted ? 'MUTE' : 'UNMUTE'}`);
            console.log('[ListenIPC] Timestamp:', new Date().toISOString());
            
            try {
                console.log('[ListenIPC] Forwarding to listenService.setMicrophoneMute()...');
                const result = await listenService.setMicrophoneMute(muted);
                
                console.log('[ListenIPC] Result from service:', JSON.stringify(result));
                
                if (!result.success) {
                    console.error('[ListenIPC] ❌ Mute operation failed:', result.error);
                } else {
                    console.log('[ListenIPC] ✅ Mute operation succeeded');
                }
                
                return result;
            } catch (error) {
                console.error('[ListenIPC] ❌ Exception during mute operation:', error);
                console.error('[ListenIPC] Stack:', error.stack);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Setup event broadcasting
     */
    setupEventBroadcasting() {
        // Set up service callbacks to broadcast events
        listenService.setCallback('onStatusUpdate', (status) => {
            this.broadcastEvent('listen:statusUpdate', status);
        });

        listenService.setCallback('onTranscriptionComplete', (data) => {
            this.broadcastEvent('listen:transcriptionComplete', data);
        });

        listenService.setCallback('onError', (error) => {
            this.broadcastEvent('listen:error', { message: error.message, timestamp: Date.now() });
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
            console.error('[ListenIPC] Broadcast error:', error);
        }
    }

    /**
     * Clean up IPC handlers
     */
    cleanup() {
        if (!this.isInitialized) {
            return;
        }

        console.log('[ListenIPC] Cleaning up IPC handlers...');

        // Remove all IPC handlers
        const handlers = [
            'listen:start', 'listen:stop', 'listen:getStatus',
            'listen:startTranscription', 'listen:stopTranscription', 'listen:getMetrics',
            'screen:getSources', 'screen:startCapture', 'screen:stopCapture',
            'permissions:check', 'permissions:request', 'permissions:getAll', 'permissions:requestAll',
            'audio:getConfig', 'audio:updateConfig', 'audio:getMetrics', 'audio:reset', 'audio:updateEchoCancellation'
        ];

        handlers.forEach(handler => {
            ipcMain.removeAllListeners(handler);
        });

        this.isInitialized = false;
        console.log('[ListenIPC] IPC handlers cleaned up');
    }
}

module.exports = new ListenIPCHandlers();
