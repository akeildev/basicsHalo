const path = require('path');
const fs = require('fs');

/**
 * EchoCancellation - WebAssembly-based Acoustic Echo Cancellation (AEC)
 * Handles real-time echo cancellation between microphone and system audio
 */
class EchoCancellation {
    constructor() {
        this.isInitialized = false;
        this.wasmModule = null;
        // Ensure single-load semantics for the WASM module
        this.modulePromise = null;
        // Placeholder for a single AEC instance pointer if provided by WASM
        this.aecPtr = 0;
        
        this.audioBuffer = {
            microphone: new Float32Array(4096),
            systemAudio: new Float32Array(4096),
            output: new Float32Array(4096)
        };
        this.bufferIndex = 0;
        this.sampleRate = 24000;
        this.frameSize = 4096;
        
        // AEC parameters
        this.aecConfig = {
            filterLength: 1024,
            adaptationRate: 0.01,
            noiseThreshold: 0.01,
            echoThreshold: 0.1
        };
        
        // Performance metrics
        this.metrics = {
            processedFrames: 0,
            echoReduction: 0,
            processingTime: 0
        };
    }

    /**
     * Initialize the echo cancellation module
     */
    async initialize() {
        try {
            console.log('[EchoCancellation] Initializing WebAssembly module...');
            
            // Try to load WebAssembly module (singleton)
            await this.loadWasmModule();
            
            // Initialize audio buffers
            this.initializeBuffers();
            
            this.isInitialized = true;
            console.log('[EchoCancellation] Initialization complete');
            return true;
            
        } catch (error) {
            console.error('[EchoCancellation] Initialization failed:', error);
            // Fall back to software implementation
            await this.initializeSoftwareFallback();
            return true;
        }
    }

    /**
     * Load WebAssembly module (singleton)
     */
    async loadWasmModule() {
        // If already loaded or loading, reuse the promise
        if (this.modulePromise) {
            await this.modulePromise;
            return;
        }

        this.modulePromise = (async () => {
            try {
                const wasmPath = path.join(__dirname, '../../../wasm/echo_cancellation.wasm');

                // Check if WASM file exists
                if (!fs.existsSync(wasmPath)) {
                    console.log('[EchoCancellation] WebAssembly module not found at:', wasmPath);
                    throw new Error('WebAssembly module not found');
                }

                console.log('[EchoCancellation] Loading WebAssembly module from:', wasmPath);

                const wasmBytes = fs.readFileSync(wasmPath);
                const wasmModule = await WebAssembly.instantiate(wasmBytes);
                this.wasmModule = wasmModule.instance;

                // Optionally create a single AEC instance if exported by the module
                if (this.wasmModule.exports && typeof this.wasmModule.exports.aec_new === 'function') {
                    this.aecPtr = this.wasmModule.exports.aec_new(this.sampleRate, this.frameSize);
                    console.log('[EchoCancellation] AEC instance created');
                }

                console.log('[EchoCancellation] WebAssembly module loaded successfully');
            } catch (error) {
                console.warn('[EchoCancellation] WebAssembly module not available, using software fallback:', error.message);
                // Don't throw - let the fallback handle it
                this.wasmModule = null;
            }
        })();

        await this.modulePromise;
    }

    /**
     * Initialize software fallback implementation
     */
    async initializeSoftwareFallback() {
        console.log('[EchoCancellation] Using software fallback implementation');
        this.isInitialized = true;
    }

    /**
     * Initialize audio buffers
     */
    initializeBuffers() {
        this.audioBuffer.microphone = new Float32Array(this.frameSize);
        this.audioBuffer.systemAudio = new Float32Array(this.frameSize);
        this.audioBuffer.output = new Float32Array(this.frameSize);
        this.bufferIndex = 0;
    }

    /**
     * Process audio frame with echo cancellation
     * @param {Float32Array} microphoneData - Microphone input
     * @param {Float32Array} systemAudioData - System audio reference
     * @returns {Float32Array} - Echo-cancelled output
     */
    processFrame(microphoneData, systemAudioData) {
        if (!this.isInitialized) {
            throw new Error('EchoCancellation not initialized');
        }

        const startTime = performance.now();
        
        try {
            let output;
            
            if (this.wasmModule && this.wasmModule.exports && typeof this.wasmModule.exports.process_echo_cancellation === 'function') {
                output = this.processWithWasm(microphoneData, systemAudioData);
            } else {
                output = this.processWithSoftware(microphoneData, systemAudioData);
            }
            
            // Update metrics
            this.updateMetrics(startTime, microphoneData, output);
            
            return output;
            
        } catch (error) {
            console.error('[EchoCancellation] Processing error:', error);
            // Return original microphone data on error
            return microphoneData;
        }
    }

    /**
     * Process audio with WebAssembly module
     */
    processWithWasm(microphoneData, systemAudioData) {
        try {
            // Allocate memory in WebAssembly
            const micPtr = this.wasmModule.exports.allocate(microphoneData.length * 4);
            const sysPtr = this.wasmModule.exports.allocate(systemAudioData.length * 4);
            const outPtr = this.wasmModule.exports.allocate(microphoneData.length * 4);
            
            // Copy data to WebAssembly memory
            const micMemory = new Float32Array(this.wasmModule.exports.memory.buffer, micPtr, microphoneData.length);
            const sysMemory = new Float32Array(this.wasmModule.exports.memory.buffer, sysPtr, systemAudioData.length);
            
            micMemory.set(microphoneData);
            sysMemory.set(systemAudioData);
            
            // Call WebAssembly function (prefer instance-based API if available)
            if (this.aecPtr && typeof this.wasmModule.exports.process_echo_cancellation_ptr === 'function') {
                this.wasmModule.exports.process_echo_cancellation_ptr(this.aecPtr, micPtr, sysPtr, outPtr, microphoneData.length);
            } else {
                this.wasmModule.exports.process_echo_cancellation(micPtr, sysPtr, outPtr, microphoneData.length);
            }
            
            // Copy result back
            const outputMemory = new Float32Array(this.wasmModule.exports.memory.buffer, outPtr, microphoneData.length);
            const output = new Float32Array(outputMemory);
            
            // Free memory
            this.wasmModule.exports.deallocate(micPtr);
            this.wasmModule.exports.deallocate(sysPtr);
            this.wasmModule.exports.deallocate(outPtr);
            
            return output;
            
        } catch (error) {
            console.error('[EchoCancellation] WebAssembly processing error:', error);
            throw error;
        }
    }

    /**
     * Process audio with software implementation
     */
    processWithSoftware(microphoneData, systemAudioData) {
        try {
            const output = new Float32Array(microphoneData.length);
            
            // Simple adaptive filter implementation
            for (let i = 0; i < microphoneData.length; i++) {
                // Estimate echo from system audio
                let echoEstimate = 0;
                const filterLength = Math.min(this.aecConfig.filterLength, i + 1);
                
                for (let j = 0; j < filterLength; j++) {
                    if (i - j >= 0 && i - j < systemAudioData.length) {
                        // Simple linear filter (in real implementation, this would be more sophisticated)
                        echoEstimate += systemAudioData[i - j] * 0.1;
                    }
                }
                
                // Subtract estimated echo from microphone signal
                output[i] = microphoneData[i] - echoEstimate;
                
                // Apply noise gate
                if (Math.abs(output[i]) < this.aecConfig.noiseThreshold) {
                    output[i] = 0;
                }
            }
            
            return output;
            
        } catch (error) {
            console.error('[EchoCancellation] Software processing error:', error);
            throw error;
        }
    }

    /**
     * Update performance metrics
     */
    updateMetrics(startTime, input, output) {
        const processingTime = performance.now() - startTime;
        
        this.metrics.processedFrames++;
        this.metrics.processingTime = processingTime;
        
        // Calculate echo reduction (simplified)
        const inputPower = this.calculatePower(input);
        const outputPower = this.calculatePower(output);
        
        if (inputPower > 0) {
            this.metrics.echoReduction = 20 * Math.log10(inputPower / Math.max(outputPower, 0.001));
        }
    }

    /**
     * Calculate signal power
     */
    calculatePower(signal) {
        let sum = 0;
        for (let i = 0; i < signal.length; i++) {
            sum += signal[i] * signal[i];
        }
        return sum / signal.length;
    }

    /**
     * Update AEC configuration
     */
    updateConfig(config) {
        this.aecConfig = { ...this.aecConfig, ...config };
        console.log('[EchoCancellation] Configuration updated:', this.aecConfig);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            isInitialized: this.isInitialized,
            hasWasmModule: !!this.wasmModule,
            config: this.aecConfig
        };
    }

    /**
     * Reset the echo cancellation filter
     */
    reset() {
        try {
            if (this.wasmModule && this.wasmModule.exports && this.wasmModule.exports.reset_filter) {
                this.wasmModule.exports.reset_filter();
            }
            
            this.initializeBuffers();
            this.metrics = {
                processedFrames: 0,
                echoReduction: 0,
                processingTime: 0
            };
            
            console.log('[EchoCancellation] Filter reset');
            
        } catch (error) {
            console.error('[EchoCancellation] Reset error:', error);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        try {
            if (this.wasmModule) {
                if (this.aecPtr && this.wasmModule.exports && typeof this.wasmModule.exports.aec_destroy === 'function') {
                    this.wasmModule.exports.aec_destroy(this.aecPtr);
                }
                if (this.wasmModule.exports && this.wasmModule.exports.cleanup) {
                    this.wasmModule.exports.cleanup();
                }
            }
            
            this.aecPtr = 0;
            this.wasmModule = null;
            this.modulePromise = null;
            this.isInitialized = false;
            
            console.log('[EchoCancellation] Cleanup complete');
            
        } catch (error) {
            console.error('[EchoCancellation] Cleanup error:', error);
        }
    }
}

module.exports = new EchoCancellation();
