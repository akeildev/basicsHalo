/**
 * Media Capture Renderer Service
 * Handles microphone and screen capture in the renderer process
 * Bridges captured audio to the main process
 */
class MediaCaptureRenderer {
    constructor() {
        this.microphoneStream = null;
        this.screenStream = null;
        this.audioContext = null;
        this.isCapturing = {
            microphone: false,
            screen: false
        };
        
        this.initializeAudioContext();
        this.setupIPCListeners();
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000,
                latencyHint: 'interactive'
            });
            console.log('[MediaCaptureRenderer] Audio context initialized');
        } catch (error) {
            console.error('[MediaCaptureRenderer] Failed to initialize audio context:', error);
        }
    }

    setupIPCListeners() {
        // Listen for capture commands from main process
        if (window.electronAPI) {
            // These would be exposed through preload
            console.log('[MediaCaptureRenderer] IPC listeners ready');
        }
    }

    /**
     * Start microphone capture
     */
    async startMicrophoneCapture(options = {}) {
        if (this.isCapturing.microphone) {
            console.log('[MediaCaptureRenderer] Microphone already capturing');
            return { success: true };
        }

        try {
            console.log('[MediaCaptureRenderer] Starting microphone capture...');
            
            // Request microphone access
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: options.echoCancellation !== false,
                    noiseSuppression: options.noiseSuppression !== false,
                    autoGainControl: options.autoGainControl !== false,
                    sampleRate: 24000,
                    channelCount: 1
                },
                video: false
            });

            // Process audio and send to main process
            this.processMicrophoneAudio(this.microphoneStream);
            
            this.isCapturing.microphone = true;
            console.log('[MediaCaptureRenderer] ✅ Microphone capture started');
            
            // Notify main process
            if (window.electronAPI && window.electronAPI.notifyMicrophoneStarted) {
                window.electronAPI.notifyMicrophoneStarted();
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] ❌ Microphone capture failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop microphone capture
     */
    stopMicrophoneCapture() {
        if (!this.isCapturing.microphone) {
            return { success: true };
        }

        try {
            if (this.microphoneStream) {
                this.microphoneStream.getTracks().forEach(track => track.stop());
                this.microphoneStream = null;
            }
            
            this.isCapturing.microphone = false;
            console.log('[MediaCaptureRenderer] ✅ Microphone capture stopped');
            
            // Notify main process
            if (window.electronAPI && window.electronAPI.notifyMicrophoneStopped) {
                window.electronAPI.notifyMicrophoneStopped();
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] Error stopping microphone:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Start screen capture with audio
     */
    async startScreenCapture(options = {}) {
        if (this.isCapturing.screen) {
            console.log('[MediaCaptureRenderer] Screen already capturing');
            return { success: true };
        }

        try {
            console.log('[MediaCaptureRenderer] Starting screen capture...');
            
            // Request screen capture with audio
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Process screen audio if available
            const audioTracks = this.screenStream.getAudioTracks();
            if (audioTracks.length > 0) {
                this.processScreenAudio(this.screenStream);
            }
            
            this.isCapturing.screen = true;
            console.log('[MediaCaptureRenderer] ✅ Screen capture started');
            
            // Notify main process
            if (window.electronAPI && window.electronAPI.notifyScreenStarted) {
                window.electronAPI.notifyScreenStarted();
            }
            
            // Handle stream ending
            this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopScreenCapture();
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] ❌ Screen capture failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop screen capture
     */
    stopScreenCapture() {
        if (!this.isCapturing.screen) {
            return { success: true };
        }

        try {
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }
            
            this.isCapturing.screen = false;
            console.log('[MediaCaptureRenderer] ✅ Screen capture stopped');
            
            // Notify main process
            if (window.electronAPI && window.electronAPI.notifyScreenStopped) {
                window.electronAPI.notifyScreenStopped();
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] Error stopping screen:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process microphone audio and send to main process
     */
    processMicrophoneAudio(stream) {
        if (!this.audioContext) return;
        
        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (!this.isCapturing.microphone) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const audioData = new Float32Array(inputData);
                
                // Send audio data to main process
                if (window.electronAPI && window.electronAPI.sendMicrophoneData) {
                    // Convert to array for IPC transfer
                    window.electronAPI.sendMicrophoneData(Array.from(audioData));
                }
            };
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            console.log('[MediaCaptureRenderer] Microphone audio processing started');
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] Error processing microphone audio:', error);
        }
    }

    /**
     * Process screen audio and send to main process
     */
    processScreenAudio(stream) {
        if (!this.audioContext) return;
        
        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (!this.isCapturing.screen) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const audioData = new Float32Array(inputData);
                
                // Send audio data to main process
                if (window.electronAPI && window.electronAPI.sendScreenAudioData) {
                    // Convert to array for IPC transfer
                    window.electronAPI.sendScreenAudioData(Array.from(audioData));
                }
            };
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            console.log('[MediaCaptureRenderer] Screen audio processing started');
            
        } catch (error) {
            console.error('[MediaCaptureRenderer] Error processing screen audio:', error);
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
        this.stopMicrophoneCapture();
        this.stopScreenCapture();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('[MediaCaptureRenderer] Cleanup complete');
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaCaptureRenderer;
}