class OllamaService {
    constructor() {
        this.isConnected = false;
        this.availableModels = [];
    }

    async connect() {
        this.isConnected = true;
        console.log('Ollama service connected');
    }

    async disconnect() {
        this.isConnected = false;
        console.log('Ollama service disconnected');
    }

    async getAvailableModels() {
        if (!this.isConnected) {
            return [];
        }
        return this.availableModels;
    }

    async pullModel(modelName) {
        if (!this.isConnected) {
            throw new Error('Ollama service not connected');
        }
        console.log(`Pulling model: ${modelName}`);
        return true;
    }

    async generateResponse(prompt, model = 'llama2') {
        if (!this.isConnected) {
            throw new Error('Ollama service not connected');
        }
        
        console.log(`Generating response with model: ${model}`);
        return {
            response: `Simulated Ollama response to: "${prompt}"`,
            model: model,
            timestamp: new Date().toISOString()
        };
    }

    isConnected() {
        return this.isConnected;
    }

    /**
     * Wait for service to be available with retry logic
     */
    async waitForService(checkFn, maxAttempts = 30, delayMs = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            if (await checkFn()) {
                console.log(`[${this.constructor.name}] Service is ready`);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        throw new Error(`${this.constructor.name} service failed to start within timeout`);
    }

    /**
     * Execute function with exponential backoff retry
     */
    async withExponentialBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error.code === 401 || error.code === 403) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);
                const jitter = Math.random() * delay * 0.1; // Add 10% jitter
                
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay + jitter}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }
        
        throw lastError;
    }
}

module.exports = new OllamaService();
