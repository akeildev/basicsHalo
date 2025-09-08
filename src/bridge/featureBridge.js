const { ipcMain } = require('electron');
const { EventEmitter } = require('events');

class FeatureBridge extends EventEmitter {
    constructor() {
        super();
        this.setupIPC();
        this.messageHandlers = new Map();
        this.setupDefaultHandlers();
    }

    setupIPC() {
        // Listen for feature-specific messages
        ipcMain.handle('listen:start', this.handleListenStart.bind(this));
        ipcMain.handle('listen:stop', this.handleListenStop.bind(this));
        ipcMain.handle('listen:status', this.handleListenStatus.bind(this));
        
        ipcMain.handle('ask:prompt', this.handleAskPrompt.bind(this));
        ipcMain.handle('ask:stream', this.handleAskStream.bind(this));
        ipcMain.handle('ask:history', this.handleAskHistory.bind(this));
        
        ipcMain.handle('settings:update', this.handleSettingsUpdate.bind(this));
        ipcMain.handle('settings:get', this.handleSettingsGet.bind(this));
        ipcMain.handle('settings:reset', this.handleSettingsReset.bind(this));
        
        // Handle window-specific feature requests
        ipcMain.handle('feature:request', this.handleFeatureRequest.bind(this));
        
        console.log('[FeatureBridge] IPC handlers registered');
    }

    setupDefaultHandlers() {
        // Default handlers that can be overridden by services
        this.messageHandlers.set('listen:start', this.defaultListenStart);
        this.messageHandlers.set('listen:stop', this.defaultListenStop);
        this.messageHandlers.set('ask:prompt', this.defaultAskPrompt);
        this.messageHandlers.set('settings:update', this.defaultSettingsUpdate);
    }

    // Listen Service Handlers
    async handleListenStart(event, data = {}) {
        try {
            console.log('[FeatureBridge] Listen start requested:', data);
            const handler = this.messageHandlers.get('listen:start');
            const result = await handler(data);
            
            // Emit event for other services to listen
            this.emit('listen:started', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Listen start error:', error);
            this.emit('listen:error', { error: error.message, windowId: event.sender.id });
            return { success: false, error: error.message };
        }
    }

    async handleListenStop(event, data = {}) {
        try {
            console.log('[FeatureBridge] Listen stop requested:', data);
            const handler = this.messageHandlers.get('listen:stop');
            const result = await handler(data);
            
            this.emit('listen:stopped', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Listen stop error:', error);
            this.emit('listen:error', { error: error.message, windowId: event.sender.id });
            return { success: false, error: error.message };
        }
    }

    async handleListenStatus(event) {
        try {
            const handler = this.messageHandlers.get('listen:status');
            const status = await handler();
            return { success: true, status };
        } catch (error) {
            console.error('[FeatureBridge] Listen status error:', error);
            return { success: false, error: error.message };
        }
    }

    // Ask Service Handlers
    async handleAskPrompt(event, data) {
        try {
            console.log('[FeatureBridge] Ask prompt requested:', data);
            this.validatePromptData(data);
            
            const handler = this.messageHandlers.get('ask:prompt');
            const result = await handler(data);
            
            this.emit('ask:prompted', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Ask prompt error:', error);
            this.emit('ask:error', { error: error.message, windowId: event.sender.id });
            return { success: false, error: error.message };
        }
    }

    async handleAskStream(event, data) {
        try {
            console.log('[FeatureBridge] Ask stream requested:', data);
            const handler = this.messageHandlers.get('ask:stream');
            const result = await handler(data);
            
            this.emit('ask:streaming', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Ask stream error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleAskHistory(event, data = {}) {
        try {
            const handler = this.messageHandlers.get('ask:history');
            const history = await handler(data);
            return { success: true, history };
        } catch (error) {
            console.error('[FeatureBridge] Ask history error:', error);
            return { success: false, error: error.message };
        }
    }

    // Settings Service Handlers
    async handleSettingsUpdate(event, data) {
        try {
            console.log('[FeatureBridge] Settings update requested:', data);
            this.validateSettingsData(data);
            
            const handler = this.messageHandlers.get('settings:update');
            const result = await handler(data);
            
            this.emit('settings:updated', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Settings update error:', error);
            this.emit('settings:error', { error: error.message, windowId: event.sender.id });
            return { success: false, error: error.message };
        }
    }

    async handleSettingsGet(event, key = null) {
        try {
            const handler = this.messageHandlers.get('settings:get');
            const settings = await handler(key);
            return { success: true, settings };
        } catch (error) {
            console.error('[FeatureBridge] Settings get error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSettingsReset(event, data = {}) {
        try {
            console.log('[FeatureBridge] Settings reset requested:', data);
            const handler = this.messageHandlers.get('settings:reset');
            const result = await handler(data);
            
            this.emit('settings:reset', { data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Settings reset error:', error);
            return { success: false, error: error.message };
        }
    }

    // Generic Feature Request Handler
    async handleFeatureRequest(event, { feature, action, data = {} }) {
        try {
            console.log('[FeatureBridge] Feature request:', { feature, action, data });
            
            const handlerKey = `${feature}:${action}`;
            const handler = this.messageHandlers.get(handlerKey);
            
            if (!handler) {
                throw new Error(`No handler found for ${handlerKey}`);
            }
            
            const result = await handler(data);
            
            this.emit('feature:requested', { feature, action, data, result, windowId: event.sender.id });
            
            return { success: true, data: result };
        } catch (error) {
            console.error('[FeatureBridge] Feature request error:', error);
            return { success: false, error: error.message };
        }
    }

    // Message Validation
    validatePromptData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Prompt data must be an object');
        }
        if (!data.prompt || typeof data.prompt !== 'string') {
            throw new Error('Prompt must be a non-empty string');
        }
        if (data.prompt.length > 10000) {
            throw new Error('Prompt too long (max 10000 characters)');
        }
    }

    validateSettingsData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Settings data must be an object');
        }
        // Add specific validation for sensitive settings
        if (data.apiKey && typeof data.apiKey !== 'string') {
            throw new Error('API key must be a string');
        }
    }

    // Service Registration
    registerHandler(feature, action, handler) {
        const key = `${feature}:${action}`;
        this.messageHandlers.set(key, handler);
        console.log(`[FeatureBridge] Registered handler for ${key}`);
    }

    // Default Handlers (to be replaced by actual services)
    defaultListenStart = async (data) => {
        console.log('[FeatureBridge] Default listen start handler');
        return { message: 'Listen service not initialized' };
    };

    defaultListenStop = async (data) => {
        console.log('[FeatureBridge] Default listen stop handler');
        return { message: 'Listen service not initialized' };
    };

    defaultAskPrompt = async (data) => {
        console.log('[FeatureBridge] Default ask prompt handler');
        return { message: 'Ask service not initialized' };
    };

    defaultSettingsUpdate = async (data) => {
        console.log('[FeatureBridge] Default settings update handler');
        return { message: 'Settings service not initialized' };
    };

    // Cleanup
    destroy() {
        // Remove all IPC handlers
        ipcMain.removeAllListeners('listen:start');
        ipcMain.removeAllListeners('listen:stop');
        ipcMain.removeAllListeners('listen:status');
        ipcMain.removeAllListeners('ask:prompt');
        ipcMain.removeAllListeners('ask:stream');
        ipcMain.removeAllListeners('ask:history');
        ipcMain.removeAllListeners('settings:update');
        ipcMain.removeAllListeners('settings:get');
        ipcMain.removeAllListeners('settings:reset');
        ipcMain.removeAllListeners('feature:request');
        
        this.messageHandlers.clear();
        this.removeAllListeners();
        
        console.log('[FeatureBridge] Destroyed');
    }
}

module.exports = new FeatureBridge();
