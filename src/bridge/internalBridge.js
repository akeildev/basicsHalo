const { EventEmitter } = require('events');

class InternalBridge extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Allow more listeners for complex applications
        this.messageQueue = [];
        this.isProcessing = false;
        this.setupErrorHandling();
    }

    setupErrorHandling() {
        // Handle uncaught errors in event listeners
        this.on('error', (error) => {
            console.error('[InternalBridge] Uncaught error:', error);
        });

        // Handle memory leaks
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                console.warn('[InternalBridge] Max listeners exceeded:', warning.message);
            }
        });
    }

    // Enhanced emit with error handling and logging
    emit(event, ...args) {
        try {
            console.log(`[InternalBridge] Emitting event: ${event}`, args.length > 0 ? args : '');
            
            // Add to message queue for processing
            this.messageQueue.push({
                event,
                args,
                timestamp: Date.now()
            });

            // Process queue if not already processing
            if (!this.isProcessing) {
                this.processQueue();
            }

            return super.emit(event, ...args);
        } catch (error) {
            console.error('[InternalBridge] Error emitting event:', error);
            this.emit('error', error);
            return false;
        }
    }

    // Process message queue
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                
                // Check for stale messages (older than 5 seconds)
                if (Date.now() - message.timestamp > 5000) {
                    console.warn('[InternalBridge] Dropping stale message:', message.event);
                    continue;
                }

                // Process the message
                await this.processMessage(message);
            }
        } catch (error) {
            console.error('[InternalBridge] Error processing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    // Process individual message
    async processMessage(message) {
        try {
            // Add any message processing logic here
            // For now, just log the processing
            console.log(`[InternalBridge] Processing: ${message.event}`);
        } catch (error) {
            console.error('[InternalBridge] Error processing message:', error);
        }
    }

    // Window Management Events
    emitWindowRequestVisibility(name, visible, options = {}) {
        this.emit('window:requestVisibility', { name, visible, options });
    }

    emitWindowMoveStep(direction, distance = 10) {
        this.emit('window:moveStep', { direction, distance });
    }

    emitWindowResizeHeaderWindow(width, height) {
        this.emit('window:resizeHeaderWindow', { width, height });
    }

    emitWindowGetHeaderPosition(callback) {
        this.emit('window:getHeaderPosition', callback);
    }

    emitWindowMoveHeaderTo(newX, newY) {
        this.emit('window:moveHeaderTo', { newX, newY });
    }

    emitWindowAdjustWindowHeight(winName, targetHeight) {
        this.emit('window:adjustWindowHeight', { winName, targetHeight });
    }

    emitWindowHeaderAnimationFinished(state) {
        this.emit('window:headerAnimationFinished', state);
    }

    // Feature Events
    emitListenStart(data = {}) {
        this.emit('listen:start', data);
    }

    emitListenStop(data = {}) {
        this.emit('listen:stop', data);
    }

    emitListenStatus() {
        this.emit('listen:status');
    }

    emitAskPrompt(data) {
        this.emit('ask:prompt', data);
    }

    emitAskStream(data) {
        this.emit('ask:stream', data);
    }

    emitAskHistory(data = {}) {
        this.emit('ask:history', data);
    }

    emitSettingsUpdate(data) {
        this.emit('settings:update', data);
    }

    emitSettingsGet(key = null) {
        this.emit('settings:get', key);
    }

    emitSettingsReset(data = {}) {
        this.emit('settings:reset', data);
    }

    // System Events
    emitSystemShutdown() {
        this.emit('system:shutdown');
    }

    emitSystemError(error) {
        this.emit('system:error', { error: error.message, stack: error.stack });
    }

    emitSystemWarning(warning) {
        this.emit('system:warning', warning);
    }

    // Application State Events
    emitAppStateChanged(state) {
        this.emit('app:stateChanged', state);
    }

    emitAppReady() {
        this.emit('app:ready');
    }

    emitAppClosing() {
        this.emit('app:closing');
    }

    // Service Events
    emitServiceStarted(serviceName) {
        this.emit('service:started', { service: serviceName });
    }

    emitServiceStopped(serviceName) {
        this.emit('service:stopped', { service: serviceName });
    }

    emitServiceError(serviceName, error) {
        this.emit('service:error', { service: serviceName, error: error.message });
    }

    // User Events
    emitUserAction(action, data = {}) {
        this.emit('user:action', { action, data, timestamp: Date.now() });
    }

    emitUserPreferenceChanged(preference, value) {
        this.emit('user:preferenceChanged', { preference, value });
    }

    // Data Events
    emitDataUpdated(type, data) {
        this.emit('data:updated', { type, data, timestamp: Date.now() });
    }

    emitDataDeleted(type, id) {
        this.emit('data:deleted', { type, id });
    }

    // Network Events
    emitNetworkConnected() {
        this.emit('network:connected');
    }

    emitNetworkDisconnected() {
        this.emit('network:disconnected');
    }

    emitNetworkError(error) {
        this.emit('network:error', { error: error.message });
    }

    // Utility Methods
    getQueueLength() {
        return this.messageQueue.length;
    }

    clearQueue() {
        this.messageQueue = [];
        console.log('[InternalBridge] Message queue cleared');
    }

    getEventNames() {
        return this.eventNames();
    }

    getListenerCount(event) {
        return this.listenerCount(event);
    }

    // Debug Methods
    logEventStats() {
        const events = this.eventNames();
        console.log('[InternalBridge] Event Statistics:');
        events.forEach(event => {
            const count = this.listenerCount(event);
            console.log(`  ${event}: ${count} listeners`);
        });
        console.log(`  Queue length: ${this.messageQueue.length}`);
    }

    // Cleanup
    destroy() {
        console.log('[InternalBridge] Destroying bridge...');
        
        // Clear message queue
        this.clearQueue();
        
        // Remove all listeners
        this.removeAllListeners();
        
        // Reset state
        this.isProcessing = false;
        
        console.log('[InternalBridge] Bridge destroyed');
    }

    // Health Check
    healthCheck() {
        return {
            isHealthy: true,
            queueLength: this.messageQueue.length,
            isProcessing: this.isProcessing,
            listenerCount: this.eventNames().length,
            maxListeners: this.getMaxListeners()
        };
    }
}

module.exports = new InternalBridge();
