const echoCancellation = require('./echoCancellation');
const { isVoiceActive, enhancedVAD, convertFloat32ToInt16, arrayBufferToBase64 } = require('./vadUtils');

/**
 * AudioProcessor - Handles audio processing pipeline including VAD, format conversion, and streaming
 * Manages the complete audio processing workflow from raw audio to processed chunks
 */
class AudioProcessor {
    constructor() {
        this.isInitialized = false;
        this.isProcessing = false;
        
        // Audio configuration
        this.config = {
            sampleRate: 24000,
            channels: 1,
            bufferSize: 4096,
            chunkSize: 2400, // 100ms at 24kHz
            vadThreshold: 0.01,
            noiseGateThreshold: 0.005
        };
        
        // Audio buffers
        this.buffers = {
            microphone: [],
            systemAudio: [],
            processed: []
        };
        
        // VAD (Voice Activity Detection) state
        this.vad = {
            isVoiceActive: false,
            silenceFrames: 0,
            voiceFrames: 0,
            energyHistory: [],
            energyThreshold: 0.01
        };
        
        // Processing pipeline
        this.pipeline = {
            echoCancellation: true,
            noiseGate: true,
            voiceActivityDetection: true,
            formatConversion: true
        };
        
        // Callbacks
        this.callbacks = {
            onAudioChunk: null,
            onVoiceActivityChange: null,
            onError: null
        };
        
        // Performance metrics
        this.metrics = {
            processedChunks: 0,
            voiceChunks: 0,
            silenceChunks: 0,
            averageProcessingTime: 0,
            droppedFrames: 0
        };
    }

    /**
     * Initialize the audio processor
     */
    async initialize(config = {}) {
        try {
            console.log('[AudioProcessor] Initializing...');
            
            // Update configuration
            this.config = { ...this.config, ...config };
            
            // Initialize echo cancellation
            await echoCancellation.initialize();
            
            // Initialize VAD
            this.initializeVAD();
            
            // Clear buffers
            this.clearBuffers();
            
            this.isInitialized = true;
            console.log('[AudioProcessor] Initialization complete');
            return true;
            
        } catch (error) {
            console.error('[AudioProcessor] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Start audio processing
     */
    startProcessing() {
        if (!this.isInitialized) {
            throw new Error('AudioProcessor not initialized');
        }
        
        this.isProcessing = true;
        console.log('[AudioProcessor] Processing started');
    }

    /**
     * Stop audio processing
     */
    stopProcessing() {
        this.isProcessing = false;
        console.log('[AudioProcessor] Processing stopped');
    }

    /**
     * Process microphone audio data
     */
    processMicrophoneAudio(audioData) {
        if (!this.isProcessing) return;
        
        try {
            // Add to buffer
            this.buffers.microphone.push(...audioData);
            
            // Process if we have enough data
            if (this.buffers.microphone.length >= this.config.bufferSize) {
                this.processAudioFrame();
            }
            
        } catch (error) {
            console.error('[AudioProcessor] Error processing microphone audio:', error);
            this.notifyError(error);
        }
    }

    /**
     * Process system audio data
     */
    processSystemAudio(audioData) {
        if (!this.isProcessing) return;
        
        try {
            // Add to buffer
            this.buffers.systemAudio.push(...audioData);
            
            // Keep only recent data for echo cancellation
            if (this.buffers.systemAudio.length > this.config.bufferSize * 2) {
                this.buffers.systemAudio = this.buffers.systemAudio.slice(-this.config.bufferSize);
            }
            
        } catch (error) {
            console.error('[AudioProcessor] Error processing system audio:', error);
            this.notifyError(error);
        }
    }

    /**
     * Process a complete audio frame
     */
    processAudioFrame() {
        const startTime = performance.now();
        
        try {
            // Extract frame from microphone buffer
            const microphoneFrame = this.buffers.microphone.splice(0, this.config.bufferSize);
            const systemAudioFrame = this.buffers.systemAudio.slice(0, this.config.bufferSize);
            
            // Pad system audio if needed
            const paddedSystemAudio = new Float32Array(this.config.bufferSize);
            paddedSystemAudio.set(systemAudioFrame);
            
            // Apply echo cancellation
            let processedFrame = microphoneFrame;
            if (this.pipeline.echoCancellation && systemAudioFrame.length > 0) {
                processedFrame = echoCancellation.processFrame(microphoneFrame, paddedSystemAudio);
            }
            
            // Apply noise gate
            if (this.pipeline.noiseGate) {
                processedFrame = this.applyNoiseGate(processedFrame);
            }
            
            // Voice Activity Detection
            const voiceActivity = this.pipeline.voiceActivityDetection ? 
                this.detectVoiceActivity(processedFrame) : true;
            
            // Update VAD state
            this.updateVADState(voiceActivity);
            
            // Process in chunks
            this.processInChunks(processedFrame, voiceActivity);
            
            // Update metrics
            this.updateMetrics(startTime, voiceActivity);
            
        } catch (error) {
            console.error('[AudioProcessor] Error processing audio frame:', error);
            this.notifyError(error);
        }
    }

    /**
     * Apply noise gate to audio frame
     */
    applyNoiseGate(audioFrame) {
        const gatedFrame = new Float32Array(audioFrame.length);
        
        for (let i = 0; i < audioFrame.length; i++) {
            const sample = audioFrame[i];
            if (Math.abs(sample) > this.config.noiseGateThreshold) {
                gatedFrame[i] = sample;
            } else {
                gatedFrame[i] = 0;
            }
        }
        
        return gatedFrame;
    }

    /**
     * Detect voice activity in audio frame
     */
    detectVoiceActivity(audioFrame) {
        // Use enhanced VAD with adaptive threshold
        const vadResult = enhancedVAD(audioFrame, {
            threshold: this.config.vadThreshold,
            adaptiveThreshold: true,
            energyHistory: this.vad.energyHistory,
            minEnergyHistory: 5
        });
        
        // Update energy history from result
        this.vad.energyHistory = vadResult.energyHistory;
        
        return vadResult.isVoiceActive;
    }

    /**
     * Update VAD state
     */
    updateVADState(isVoice) {
        const wasVoiceActive = this.vad.isVoiceActive;
        
        if (isVoice) {
            this.vad.voiceFrames++;
            this.vad.silenceFrames = 0;
            
            // Activate voice after 2 consecutive voice frames
            if (this.vad.voiceFrames >= 2) {
                this.vad.isVoiceActive = true;
            }
        } else {
            this.vad.silenceFrames++;
            this.vad.voiceFrames = 0;
            
            // Deactivate voice after 10 consecutive silence frames
            if (this.vad.silenceFrames >= 10) {
                this.vad.isVoiceActive = false;
            }
        }
        
        // Notify voice activity change
        if (wasVoiceActive !== this.vad.isVoiceActive) {
            this.notifyVoiceActivityChange(this.vad.isVoiceActive);
        }
    }

    /**
     * Process audio in chunks
     */
    processInChunks(audioFrame, voiceActivity) {
        const chunkSize = this.config.chunkSize;
        
        for (let i = 0; i < audioFrame.length; i += chunkSize) {
            const chunk = audioFrame.slice(i, i + chunkSize);
            
            if (chunk.length === chunkSize) {
                this.processAudioChunk(chunk, voiceActivity);
            }
        }
    }

    /**
     * Process individual audio chunk
     */
    processAudioChunk(chunk, voiceActivity) {
        try {
            // Convert to Int16 for transmission
            const int16Chunk = this.convertFloat32ToInt16(chunk);
            
            // Encode to base64
            const base64Data = this.encodeToBase64(int16Chunk);
            
            // Create chunk data
            const chunkData = {
                data: base64Data,
                timestamp: Date.now(),
                sampleRate: this.config.sampleRate,
                channels: this.config.channels,
                voiceActivity: voiceActivity,
                chunkSize: chunk.length
            };
            
            // Notify callback
            if (this.callbacks.onAudioChunk) {
                this.callbacks.onAudioChunk(chunkData);
            }
            
            // Update metrics
            this.metrics.processedChunks++;
            if (voiceActivity) {
                this.metrics.voiceChunks++;
            } else {
                this.metrics.silenceChunks++;
            }
            
        } catch (error) {
            console.error('[AudioProcessor] Error processing audio chunk:', error);
            this.notifyError(error);
        }
    }

    /**
     * Convert Float32Array to Int16Array
     */
    convertFloat32ToInt16(float32Array) {
        return convertFloat32ToInt16(float32Array);
    }

    /**
     * Encode Int16Array to base64
     */
    encodeToBase64(int16Array) {
        return arrayBufferToBase64(int16Array.buffer);
    }

    /**
     * Initialize VAD
     */
    initializeVAD() {
        this.vad = {
            isVoiceActive: false,
            silenceFrames: 0,
            voiceFrames: 0,
            energyHistory: [],
            energyThreshold: this.config.vadThreshold
        };
    }

    /**
     * Clear all buffers
     */
    clearBuffers() {
        this.buffers.microphone = [];
        this.buffers.systemAudio = [];
        this.buffers.processed = [];
    }

    /**
     * Update performance metrics
     */
    updateMetrics(startTime, voiceActivity) {
        const processingTime = performance.now() - startTime;
        
        // Update average processing time
        this.metrics.averageProcessingTime = 
            (this.metrics.averageProcessingTime * (this.metrics.processedChunks - 1) + processingTime) / 
            this.metrics.processedChunks;
    }

    /**
     * Set audio callback
     */
    setCallback(type, callback) {
        if (this.callbacks.hasOwnProperty(type)) {
            this.callbacks[type] = callback;
        } else {
            console.warn(`[AudioProcessor] Unknown callback type: ${type}`);
        }
    }

    /**
     * Notify voice activity change
     */
    notifyVoiceActivityChange(isVoiceActive) {
        if (this.callbacks.onVoiceActivityChange) {
            this.callbacks.onVoiceActivityChange({
                isVoiceActive,
                timestamp: Date.now(),
                energy: this.vad.energyHistory[this.vad.energyHistory.length - 1] || 0
            });
        }
    }

    /**
     * Notify error
     */
    notifyError(error) {
        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('[AudioProcessor] Configuration updated:', this.config);
    }

    /**
     * Update pipeline settings
     */
    updatePipeline(pipeline) {
        this.pipeline = { ...this.pipeline, ...pipeline };
        console.log('[AudioProcessor] Pipeline updated:', this.pipeline);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            vad: { ...this.vad },
            config: { ...this.config },
            pipeline: { ...this.pipeline },
            metrics: { ...this.metrics }
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            echoCancellationMetrics: echoCancellation.getMetrics(),
            bufferSizes: {
                microphone: this.buffers.microphone.length,
                systemAudio: this.buffers.systemAudio.length,
                processed: this.buffers.processed.length
            }
        };
    }

    /**
     * Reset processor state
     */
    reset() {
        this.clearBuffers();
        this.initializeVAD();
        this.metrics = {
            processedChunks: 0,
            voiceChunks: 0,
            silenceChunks: 0,
            averageProcessingTime: 0,
            droppedFrames: 0
        };
        
        echoCancellation.reset();
        console.log('[AudioProcessor] Processor reset');
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopProcessing();
        this.clearBuffers();
        echoCancellation.cleanup();
        this.isInitialized = false;
        console.log('[AudioProcessor] Cleanup complete');
    }
}

module.exports = new AudioProcessor();
