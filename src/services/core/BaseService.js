/**
 * Base Service Class
 * Provides lifecycle management, state tracking, and resource management
 * for all services in the Halo application
 */
class BaseService {
    constructor(name, options = {}) {
        this.name = name;
        this.state = 'uninitialized';
        this.isCritical = options.isCritical || false;
        this.dependencies = options.dependencies || [];
        
        // Resource tracking
        this.resources = {
            timers: [],
            intervals: [],
            listeners: [],
            connections: [],
            subscriptions: []
        };
        
        // Performance tracking
        this.metrics = {
            initializeTime: null,
            startTime: null,
            stopTime: null,
            errorCount: 0
        };
        
        // Error handling
        this.lastError = null;
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 3;
        
        console.log(`[${this.name}] Service created`);
    }
    
    /**
     * Initialize the service - acquire resources, setup connections
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.state !== 'uninitialized' && this.state !== 'failed') {
            console.log(`[${this.name}] Already initialized, state: ${this.state}`);
            return;
        }
        
        console.log(`[${this.name}] Initializing...`);
        this.state = 'initializing';
        const startTime = Date.now();
        
        try {
            // Check dependencies
            await this.checkDependencies();
            
            // Call child class implementation
            await this.onInitialize();
            
            this.state = 'initialized';
            this.metrics.initializeTime = Date.now() - startTime;
            console.log(`[${this.name}] Initialized in ${this.metrics.initializeTime}ms`);
        } catch (error) {
            this.state = 'failed';
            this.lastError = error;
            this.metrics.errorCount++;
            console.error(`[${this.name}] Initialization failed:`, error);
            
            if (this.isCritical) {
                throw error;
            }
        }
    }
    
    /**
     * Start the service - begin active operations
     * @returns {Promise<void>}
     */
    async start() {
        if (this.state === 'active') {
            console.log(`[${this.name}] Already active`);
            return;
        }
        
        if (this.state !== 'initialized' && this.state !== 'stopped') {
            throw new Error(`[${this.name}] Cannot start from state: ${this.state}`);
        }
        
        console.log(`[${this.name}] Starting...`);
        this.state = 'starting';
        const startTime = Date.now();
        
        try {
            await this.onStart();
            this.state = 'active';
            this.metrics.startTime = Date.now() - startTime;
            console.log(`[${this.name}] Started in ${this.metrics.startTime}ms`);
        } catch (error) {
            this.state = 'failed';
            this.lastError = error;
            this.metrics.errorCount++;
            console.error(`[${this.name}] Start failed:`, error);
            throw error;
        }
    }
    
    /**
     * Stop the service - pause operations but maintain resources
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.state !== 'active') {
            console.log(`[${this.name}] Not active, current state: ${this.state}`);
            return;
        }
        
        console.log(`[${this.name}] Stopping...`);
        this.state = 'stopping';
        const startTime = Date.now();
        
        try {
            await this.onStop();
            this.state = 'stopped';
            this.metrics.stopTime = Date.now() - startTime;
            console.log(`[${this.name}] Stopped in ${this.metrics.stopTime}ms`);
        } catch (error) {
            this.lastError = error;
            this.metrics.errorCount++;
            console.error(`[${this.name}] Stop failed:`, error);
            // Continue with cleanup even if stop fails
        }
    }
    
    /**
     * Cleanup the service - release all resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        console.log(`[${this.name}] Cleaning up...`);
        
        try {
            // Stop if active
            if (this.state === 'active') {
                await this.stop();
            }
            
            // Clean up tracked resources
            await this.cleanupResources();
            
            // Call child class implementation
            await this.onCleanup();
            
            this.state = 'cleaned';
            console.log(`[${this.name}] Cleanup complete`);
        } catch (error) {
            console.error(`[${this.name}] Cleanup failed:`, error);
            // Don't throw - cleanup should always complete
        }
    }
    
    /**
     * Graceful shutdown with timeout
     * @param {number} timeout - Maximum time to wait in ms
     * @returns {Promise<void>}
     */
    async gracefulShutdown(timeout = 5000) {
        console.log(`[${this.name}] Graceful shutdown initiated (timeout: ${timeout}ms)`);
        
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                console.warn(`[${this.name}] Graceful shutdown timeout, forcing cleanup`);
                this.cleanup().finally(resolve);
            }, timeout);
            
            this.cleanup()
                .then(() => {
                    clearTimeout(timer);
                    resolve();
                })
                .catch((error) => {
                    console.error(`[${this.name}] Graceful shutdown error:`, error);
                    clearTimeout(timer);
                    resolve();
                });
        });
    }
    
    /**
     * Check if all dependencies are ready
     * @returns {Promise<void>}
     */
    async checkDependencies() {
        for (const dep of this.dependencies) {
            if (!dep || !dep.isReady()) {
                throw new Error(`Dependency not ready: ${dep?.name || 'unknown'}`);
            }
        }
    }
    
    /**
     * Clean up tracked resources
     * @returns {Promise<void>}
     */
    async cleanupResources() {
        // Clear timers
        this.resources.timers.forEach(timer => clearTimeout(timer));
        this.resources.intervals.forEach(interval => clearInterval(interval));
        
        // Remove event listeners
        this.resources.listeners.forEach(({ target, event, handler }) => {
            target.removeListener(event, handler);
        });
        
        // Close connections
        for (const connection of this.resources.connections) {
            try {
                if (connection && typeof connection.close === 'function') {
                    await connection.close();
                }
            } catch (error) {
                console.error(`[${this.name}] Error closing connection:`, error);
            }
        }
        
        // Cancel subscriptions
        this.resources.subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        
        // Clear all resource arrays
        Object.keys(this.resources).forEach(key => {
            this.resources[key] = [];
        });
    }
    
    /**
     * Track a timer for cleanup
     * @param {NodeJS.Timeout} timer
     */
    trackTimer(timer) {
        this.resources.timers.push(timer);
        return timer;
    }
    
    /**
     * Track an interval for cleanup
     * @param {NodeJS.Timeout} interval
     */
    trackInterval(interval) {
        this.resources.intervals.push(interval);
        return interval;
    }
    
    /**
     * Track an event listener for cleanup
     * @param {EventEmitter} target
     * @param {string} event
     * @param {Function} handler
     */
    trackListener(target, event, handler) {
        target.on(event, handler);
        this.resources.listeners.push({ target, event, handler });
    }
    
    /**
     * Track a connection for cleanup
     * @param {any} connection
     */
    trackConnection(connection) {
        this.resources.connections.push(connection);
        return connection;
    }
    
    /**
     * Track a subscription for cleanup
     * @param {any} subscription
     */
    trackSubscription(subscription) {
        this.resources.subscriptions.push(subscription);
        return subscription;
    }
    
    /**
     * Check if service is ready
     * @returns {boolean}
     */
    isReady() {
        return this.state === 'active' || this.state === 'initialized';
    }
    
    /**
     * Get service status
     * @returns {Object}
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            isCritical: this.isCritical,
            metrics: { ...this.metrics },
            lastError: this.lastError ? this.lastError.message : null,
            resourceCounts: {
                timers: this.resources.timers.length,
                intervals: this.resources.intervals.length,
                listeners: this.resources.listeners.length,
                connections: this.resources.connections.length,
                subscriptions: this.resources.subscriptions.length
            }
        };
    }
    
    /**
     * Retry an operation with exponential backoff
     * @param {Function} operation
     * @param {number} maxRetries
     * @returns {Promise<any>}
     */
    async retryWithBackoff(operation, maxRetries = this.maxRetries) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                const delay = Math.min(1000 * Math.pow(2, i), 10000);
                console.log(`[${this.name}] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Methods to be implemented by child classes
    async onInitialize() {
        // Override in child class
    }
    
    async onStart() {
        // Override in child class
    }
    
    async onStop() {
        // Override in child class
    }
    
    async onCleanup() {
        // Override in child class
    }
}

module.exports = BaseService;