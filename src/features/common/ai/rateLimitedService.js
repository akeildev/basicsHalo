const { TokenBucketRateLimiter, SlidingWindowRateLimiter, RequestQueue } = require('./rateLimiter');

/**
 * Enhanced AI Service with rate limiting
 */
class RateLimitedAIService {
    constructor() {
        // Initialize rate limiters per provider
        this.rateLimiters = new Map([
            ['openai', new TokenBucketRateLimiter({ capacity: 100, refillRate: 3 })],
            ['anthropic', new TokenBucketRateLimiter({ capacity: 50, refillRate: 2 })],
            ['gemini', new SlidingWindowRateLimiter({ windowMs: 60000, maxRequests: 60 })]
        ]);
        
        // Track rate limit headers
        this.rateLimitInfo = new Map();
        
        // Request queue for managing requests
        this.requestQueue = new RequestQueue();
        
        // Retry tracking
        this.retryCount = new Map();
    }
    
    /**
     * Send message with rate limiting
     */
    async sendMessageWithRateLimit(provider, messages) {
        const limiter = this.rateLimiters.get(provider);
        
        if (limiter) {
            // Wait for rate limit clearance
            await limiter.waitForTokens ? 
                limiter.waitForTokens(1) : 
                limiter.waitForSlot();
        }
        
        try {
            const response = await this.makeRequest(provider, messages);
            
            // Update rate limit info from headers
            this.updateRateLimitInfo(provider, response.headers);
            
            // Reset retry count on success
            this.retryCount.delete(provider);
            
            return response;
        } catch (error) {
            if (error.status === 429) {
                return this.handleRateLimitError(provider, error, messages);
            }
            throw error;
        }
    }
    
    /**
     * Handle 429 rate limit errors
     */
    async handleRateLimitError(provider, error, messages) {
        console.log(`[RateLimiter] Rate limited by ${provider}`);
        
        // Parse Retry-After header
        const retryAfter = this.parseRetryAfter(error.headers);
        
        if (retryAfter) {
            console.log(`[RateLimiter] Waiting ${retryAfter}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
        } else {
            // Exponential backoff if no Retry-After
            const currentRetries = this.retryCount.get(provider) || 0;
            const backoff = Math.min(60000, 1000 * Math.pow(2, currentRetries));
            console.log(`[RateLimiter] Using exponential backoff: ${backoff}ms`);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
        
        // Retry the request
        const newRetryCount = (this.retryCount.get(provider) || 0) + 1;
        this.retryCount.set(provider, newRetryCount);
        
        // Limit retries to prevent infinite loops
        if (newRetryCount > 5) {
            throw new Error(`Rate limit exceeded for ${provider} after ${newRetryCount} retries`);
        }
        
        return this.sendMessageWithRateLimit(provider, messages);
    }
    
    /**
     * Parse Retry-After header
     */
    parseRetryAfter(headers) {
        const retryAfter = headers?.['retry-after'];
        if (!retryAfter) return null;
        
        // Check if it's a number (seconds) or date
        const seconds = parseInt(retryAfter);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
        
        // Try parsing as date
        const retryDate = new Date(retryAfter);
        if (!isNaN(retryDate)) {
            return Math.max(0, retryDate - Date.now());
        }
        
        return null;
    }
    
    /**
     * Update rate limit info from response headers
     */
    updateRateLimitInfo(provider, headers) {
        const info = {
            limit: parseInt(headers?.['x-ratelimit-limit']),
            remaining: parseInt(headers?.['x-ratelimit-remaining']),
            reset: parseInt(headers?.['x-ratelimit-reset']),
            updatedAt: Date.now()
        };
        
        if (!isNaN(info.limit)) {
            this.rateLimitInfo.set(provider, info);
            
            // Adjust rate limiter based on actual limits
            this.adjustRateLimiter(provider, info);
        }
    }
    
    /**
     * Dynamically adjust rate limiter based on API feedback
     */
    adjustRateLimiter(provider, info) {
        const limiter = this.rateLimiters.get(provider);
        if (!limiter || !info.remaining) return;
        
        // Slow down if running low on quota
        const percentRemaining = info.remaining / info.limit;
        if (percentRemaining < 0.2 && limiter.refillRate) {
            console.log(`[RateLimiter] Slowing down ${provider} - only ${Math.round(percentRemaining * 100)}% quota remaining`);
            limiter.refillRate = Math.max(1, limiter.refillRate * 0.5);
        }
    }
    
    /**
     * Queue a request with priority
     */
    async queueRequest(requestFn, priority = 'medium') {
        return this.requestQueue.enqueue(requestFn, priority);
    }
    
    /**
     * Make a request (placeholder - implement based on your AI service)
     */
    async makeRequest(provider, messages) {
        // This is a placeholder - implement based on your actual AI service
        // For example, using the createStreamingLLM from the OpenAI provider
        throw new Error('makeRequest method must be implemented by subclass');
    }
    
    /**
     * Get current rate limit status
     */
    getRateLimitStatus() {
        const status = {};
        
        for (const [provider, limiter] of this.rateLimiters) {
            status[provider] = {
                limiter: limiter.getState(),
                apiInfo: this.rateLimitInfo.get(provider) || null,
                retryCount: this.retryCount.get(provider) || 0
            };
        }
        
        return {
            ...status,
            queue: this.requestQueue.getStats()
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        for (const limiter of this.rateLimiters.values()) {
            if (limiter.dispose) {
                limiter.dispose();
            }
        }
        this.rateLimiters.clear();
        this.rateLimitInfo.clear();
        this.retryCount.clear();
    }
}

module.exports = {
    RateLimitedAIService
};
