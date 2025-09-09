/**
 * Capture Controller - Runs in renderer process
 * Handles screen and microphone capture
 */
class CaptureController {
    constructor() {
        this.screenStream = null;
        this.micStream = null;
        this.audioContext = null;
        this.micProcessor = null;
        this.screenProcessor = null;
        this.isCapturing = {
            screen: false,
            microphone: false
        };
        
        this.initializeAudioContext();
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000,
                latencyHint: 'interactive'
            });
            console.log('[CaptureController] Audio context initialized');
        } catch (error) {
            console.error('[CaptureController] Failed to initialize audio context:', error);
        }
    }

    /**
     * Start capture based on options
     */
    async start(options = {}) {
        console.log('[CaptureController] Starting capture with options:', options);
        
        const results = {
            screen: false,
            microphone: false
        };

        try {
            // Start screen capture if requested
            if (options.screen !== false) {
                try {
                    await this.startScreenCapture(options.screenSourceId);
                    results.screen = true;
                } catch (error) {
                    console.error('[CaptureController] Screen capture failed:', error);
                    window.captureAPI.sendError({
                        type: 'screen',
                        message: error.message
                    });
                }
            }

            // Start microphone capture if requested
            if (options.microphone !== false) {
                try {
                    await this.startMicrophoneCapture(options.microphoneOptions);
                    results.microphone = true;
                } catch (error) {
                    console.error('[CaptureController] Microphone capture failed:', error);
                    window.captureAPI.sendError({
                        type: 'microphone',
                        message: error.message
                    });
                }
            }

            // Send status update
            window.captureAPI.sendStatus({
                capturing: true,
                screen: results.screen,
                microphone: results.microphone
            });

            return { 
                success: true, 
                results 
            };

        } catch (error) {
            console.error('[CaptureController] Start capture error:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * Start screen capture
     */
    async startScreenCapture(sourceId) {
        if (this.isCapturing.screen) {
            console.log('[CaptureController] Screen already capturing');
            return;
        }

        console.log('[CaptureController] Starting screen capture...');
        
        try {
            // Get available sources
            const sources = await window.captureAPI.getSources();
            
            if (sources.length === 0) {
                throw new Error('No screen sources available');
            }

            // Select source
            let selectedSource = sources[0];
            if (sourceId) {
                const found = sources.find(s => s.id === sourceId);
                if (found) selectedSource = found;
            }

            console.log('[CaptureController] Using source:', selectedSource.name);

            // Get screen stream with audio
            this.screenStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            });

            // Process audio if available
            const audioTracks = this.screenStream.getAudioTracks();
            if (audioTracks.length > 0) {
                this.processScreenAudio(this.screenStream);
            }

            this.isCapturing.screen = true;
            console.log('[CaptureController] ✅ Screen capture started');

            // Handle stream ending
            const videoTrack = this.screenStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
                    console.log('[CaptureController] Screen capture ended by user');
                    this.stopScreenCapture();
                });
            }

        } catch (error) {
            console.error('[CaptureController] Screen capture error:', error);
            throw error;
        }
    }

    /**
     * Start microphone capture
     */
    async startMicrophoneCapture(options = {}) {
        if (this.isCapturing.microphone) {
            console.log('[CaptureController] Microphone already capturing');
            return;
        }

        console.log('[CaptureController] Starting microphone capture...');
        
        try {
            // Request microphone access
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: options.echoCancellation !== false,
                    noiseSuppression: options.noiseSuppression !== false,
                    autoGainControl: options.autoGainControl !== false,
                    sampleRate: 24000,
                    channelCount: 1
                },
                video: false
            });

            // Process microphone audio
            this.processMicrophoneAudio(this.micStream);

            this.isCapturing.microphone = true;
            console.log('[CaptureController] ✅ Microphone capture started');

        } catch (error) {
            console.error('[CaptureController] Microphone capture error:', error);
            throw error;
        }
    }

    /**
     * Process microphone audio
     */
    processMicrophoneAudio(stream) {
        if (!this.audioContext) return;
        
        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            this.micProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.micProcessor.onaudioprocess = (e) => {
                if (!this.isCapturing.microphone) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const audioData = new Float32Array(inputData);
                
                // Send audio data to main process
                window.captureAPI.sendAudioData('microphone', Array.from(audioData));
            };
            
            source.connect(this.micProcessor);
            this.micProcessor.connect(this.audioContext.destination);
            
            console.log('[CaptureController] Microphone audio processing started');
            
        } catch (error) {
            console.error('[CaptureController] Error processing microphone audio:', error);
        }
    }

    /**
     * Process screen audio
     */
    processScreenAudio(stream) {
        if (!this.audioContext) return;
        
        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            this.screenProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.screenProcessor.onaudioprocess = (e) => {
                if (!this.isCapturing.screen) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const audioData = new Float32Array(inputData);
                
                // Send audio data to main process
                window.captureAPI.sendAudioData('screen', Array.from(audioData));
            };
            
            source.connect(this.screenProcessor);
            this.screenProcessor.connect(this.audioContext.destination);
            
            console.log('[CaptureController] Screen audio processing started');
            
        } catch (error) {
            console.error('[CaptureController] Error processing screen audio:', error);
        }
    }

    /**
     * Stop all capture
     */
    async stop() {
        console.log('[CaptureController] Stopping capture...');
        
        const results = {
            screen: false,
            microphone: false
        };

        // Stop screen capture
        if (this.isCapturing.screen) {
            this.stopScreenCapture();
            results.screen = true;
        }

        // Stop microphone capture
        if (this.isCapturing.microphone) {
            this.stopMicrophoneCapture();
            results.microphone = true;
        }

        // Send status update
        window.captureAPI.sendStatus({
            capturing: false,
            screen: false,
            microphone: false
        });

        return { 
            success: true, 
            results 
        };
    }

    /**
     * Stop screen capture
     */
    stopScreenCapture() {
        if (!this.isCapturing.screen) return;
        
        try {
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }
            
            if (this.screenProcessor) {
                this.screenProcessor.disconnect();
                this.screenProcessor = null;
            }
            
            this.isCapturing.screen = false;
            console.log('[CaptureController] ✅ Screen capture stopped');
            
        } catch (error) {
            console.error('[CaptureController] Error stopping screen capture:', error);
        }
    }

    /**
     * Stop microphone capture
     */
    stopMicrophoneCapture() {
        if (!this.isCapturing.microphone) return;
        
        try {
            if (this.micStream) {
                this.micStream.getTracks().forEach(track => track.stop());
                this.micStream = null;
            }
            
            if (this.micProcessor) {
                this.micProcessor.disconnect();
                this.micProcessor = null;
            }
            
            this.isCapturing.microphone = false;
            console.log('[CaptureController] ✅ Microphone capture stopped');
            
        } catch (error) {
            console.error('[CaptureController] Error stopping microphone capture:', error);
        }
    }

    /**
     * Get capture status
     */
    getStatus() {
        return {
            microphone: this.isCapturing.microphone,
            screen: this.isCapturing.screen,
            hasAudioContext: !!this.audioContext
        };
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.stop();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('[CaptureController] Cleanup complete');
    }
}

console.log('[Capture Script] Script loaded, readyState:', document.readyState);

// Initialize capture controller when DOM is ready
function initializeCapture() {
    console.log('[Capture Script] Initializing capture controller...');
    try {
        const captureController = new CaptureController();
        window.__captureController = captureController;

        // Log ready state
        console.log('[Capture Renderer] Capture controller initialized successfully');
        console.log('[Capture Renderer] Controller assigned to window:', !!window.__captureController);
        console.log('[Capture Renderer] Controller type:', typeof window.__captureController);
        
        // Update status display if element exists
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = 'Capture renderer initialized and ready';
        }
        
        // Signal to preload that we're ready
        if (window.captureAPI) {
            window.captureAPI.sendStatus({ ready: true, controller: true });
        }
        
        // Also set a flag that preload can check
        window.__captureReady = true;
        
        // Dispatch a custom event that the preload can listen for
        window.dispatchEvent(new CustomEvent('captureReady', { detail: { ready: true } }));
    } catch (error) {
        console.error('[Capture Renderer] Failed to initialize:', error);
        console.error('[Capture Renderer] Error stack:', error.stack);
    }
}

// Initialize when DOM is ready
console.log('[Capture Script] Setting up initialization...');
if (document.readyState === 'loading') {
    console.log('[Capture Script] DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initializeCapture);
} else {
    console.log('[Capture Script] DOM already loaded, initializing immediately');
    // DOM is already ready
    initializeCapture();
}