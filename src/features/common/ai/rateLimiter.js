/**
 * Token bucket rate limiter for API requests
 * Allows burst capacity while maintaining average rate
 */
class TokenBucketRateLimiter {
    constructor(options = {}) {
        this.capacity = options.capacity || 100;        // Maximum tokens
        this.refillRate = options.refillRate || 10;     // Tokens per second
        this.tokens = this.capacity;                     // Current tokens
        this.lastRefill = Date.now();
        
        // Start refill timer
        this.refillInterval = setInterval(() => this.refill(), 1000);
    }
    
    /**
     * Refill tokens based on elapsed time
     */
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    
    /**
     * Try to consume tokens for a request
     * @param {number} cost - Number of tokens required
     * @returns {boolean} Whether tokens were consumed
     */
    tryConsume(cost = 1) {
        this.refill(); // Ensure tokens are current
        
        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }
    
    /**
     * Wait until tokens are available
     * @param {number} cost - Number of tokens required
     * @returns {Promise<void>}
     */
    async waitForTokens(cost = 1) {
        while (!this.tryConsume(cost)) {
            const waitTime = ((cost - this.tokens) / this.refillRate) * 1000;
            await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
        }
    }
    
    /**
     * Get current state
     */
    getState() {
        this.refill();
        return {
            available: Math.floor(this.tokens),
            capacity: this.capacity,
            refillRate: this.refillRate
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.refillInterval) {
            clearInterval(this.refillInterval);
            this.refillInterval = null;
        }
    }
}

/**
 * Sliding window rate limiter
 * Tracks exact request times for precise limiting
 */
class SlidingWindowRateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000;      // 1 minute window
        this.maxRequests = options.maxRequests || 100;  // Max in window
        this.requests = [];                              // Timestamp array
        
        // Cleanup old entries periodically
        this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
    }
    
    /**
     * Remove requests outside the window
     */
    cleanup() {
        const cutoff = Date.now() - this.windowMs;
        this.requests = this.requests.filter(time => time > cutoff);
    }
    
    /**
     * Check if request is allowed
     * @returns {boolean}
     */
    tryRequest() {
        this.cleanup();
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(Date.now());
            return true;
        }
        return false;
    }
    
    /**
     * Get time until next available slot
     * @returns {number} Milliseconds to wait
     */
    getWaitTime() {
        this.cleanup();
        
        if (this.requests.length < this.maxRequests) {
            return 0;
        }
        
        // Find oldest request in window
        const oldestRequest = Math.min(...this.requests);
        const waitTime = (oldestRequest + this.windowMs) - Date.now();
        return Math.max(0, waitTime);
    }
    
    /**
     * Wait for available slot
     * @returns {Promise<void>}
     */
    async waitForSlot() {
        const waitTime = this.getWaitTime();
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        return this.tryRequest();
    }
    
    /**
     * Get current state
     */
    getState() {
        this.cleanup();
        return {
            current: this.requests.length,
            max: this.maxRequests,
            window: this.windowMs,
            nextSlot: this.getWaitTime()
        };
    }
    
    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

/**
 * Priority queue for rate-limited requests
 */
class RequestQueue {
    constructor() {
        this.queues = {
            high: [],
            medium: [],
            low: []
        };
        this.processing = false;
    }
    
    /**
     * Add request to queue
     */
    enqueue(request, priority = 'medium') {
        return new Promise((resolve, reject) => {
            this.queues[priority].push({
                request,
                resolve,
                reject,
                timestamp: Date.now()
            });
            
            this.processQueue();
        });
    }
    
    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.processing) return;
        this.processing = true;
        
        while (this.hasRequests()) {
            const item = this.dequeue();
            if (!item) break;
            
            try {
                const result = await item.request();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }
        
        this.processing = false;
    }
    
    /**
     * Get next request from highest priority queue
     */
    dequeue() {
        for (const priority of ['high', 'medium', 'low']) {
            if (this.queues[priority].length > 0) {
                return this.queues[priority].shift();
            }
        }
        return null;
    }
    
    /**
     * Check if any requests are queued
     */
    hasRequests() {
        return Object.values(this.queues).some(q => q.length > 0);
    }
    
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            high: this.queues.high.length,
            medium: this.queues.medium.length,
            low: this.queues.low.length,
            total: this.queues.high.length + this.queues.medium.length + this.queues.low.length,
            processing: this.processing
        };
    }
}

module.exports = {
    TokenBucketRateLimiter,
    SlidingWindowRateLimiter,
    RequestQueue
};
