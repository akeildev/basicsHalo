const { desktopCapturer, systemPreferences } = require('electron');
const { EventEmitter } = require('events');
const permissionService = require('./permissionService');
const platformAudioCapture = require('./platformAudioCapture');

/**
 * ListenCapture - Unified media capture service for screen, microphone, and system audio
 * Coordinates capture across all platforms with permission integration
 */
class ListenCapture extends EventEmitter {
    constructor() {
        super();
        this.platform = process.platform;
        this.isInitialized = false;
        this.isCapturing = false;
        
        // Capture state
        this.captureState = {
            screen: {
                active: false,
                stream: null,
                source: null,
                constraints: null
            },
            microphone: {
                active: false,
                stream: null,
                constraints: null
            },
            systemAudio: {
                active: false,
                stream: null,
                process: null,
                constraints: null
            }
        };
        
        // Configuration
        this.config = {
            screen: {
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080,
                frameRate: 30,
                audio: false
            },
            microphone: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 24000,
                channelCount: 1
            },
            systemAudio: {
                sampleRate: 24000,
                channels: 1,
                format: 'float32'
            }
        };
        
        // Callbacks
        this.callbacks = {
            onScreenData: null,
            onMicrophoneData: null,
            onSystemAudioData: null,
            onError: null,
            onStatusChange: null
        };
        
        // Performance metrics
        this.metrics = {
            startTime: null,
            framesCaptured: 0,
            audioChunksCaptured: 0,
            errors: 0,
            lastError: null
        };
    }

    /**
     * Initialize the capture service
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log('[ListenCapture] Initializing media capture service...');
            
            // Initialize permission service
            await permissionService.initialize();
            
            // Initialize platform audio capture
            await platformAudioCapture.initialize();
            
            // Check initial permissions
            const permissions = await permissionService.checkSystemPermissions();
            if (permissions.needsSetup) {
                console.warn('[ListenCapture] ⚠️ Some permissions may not be granted');
            }
            
            this.isInitialized = true;
            console.log('[ListenCapture] ✅ Initialized successfully');
            
            this.emit('initialized');
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Initialization failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Get available screen sources
     */
    async getScreenSources(options = {}) {
        try {
            console.log('[ListenCapture] Getting screen sources...');
            
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 },
                ...options
            });
            
            console.log(`[ListenCapture] Found ${sources.length} screen sources`);
            return sources;
            
        } catch (error) {
            console.error('[ListenCapture] Error getting screen sources:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start screen capture
     */
    async startScreenCapture(sourceId = null, options = {}) {
        try {
            if (this.captureState.screen.active) {
                throw new Error('Screen capture is already active');
            }
            
            console.log('[ListenCapture] Starting screen capture...');
            
            // Check screen recording permission
            const hasPermission = await permissionService.hasPermission('screen');
            if (!hasPermission) {
                throw new Error('Screen recording permission not granted');
            }
            
            // Get screen sources if sourceId not provided
            let source;
            if (sourceId) {
                const sources = await this.getScreenSources();
                source = sources.find(s => s.id === sourceId);
                if (!source) {
                    throw new Error(`Screen source not found: ${sourceId}`);
                }
            } else {
                const sources = await this.getScreenSources();
                source = sources[0]; // Use first available source
                if (!source) {
                    throw new Error('No screen sources available');
                }
            }
            
            // Merge configuration
            const constraints = {
                ...this.config.screen,
                ...options,
                audio: false // Screen audio handled separately
            };
            
            // Start screen capture
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id,
                        minWidth: constraints.minWidth,
                        maxWidth: constraints.maxWidth,
                        minHeight: constraints.minHeight,
                        maxHeight: constraints.maxHeight,
                        minFrameRate: constraints.frameRate,
                        maxFrameRate: constraints.frameRate
                    }
                }
            });
            
            // Update state
            this.captureState.screen = {
                active: true,
                stream,
                source,
                constraints
            };
            
            // Set up stream handling
            this._setupScreenStreamHandling(stream);
            
            console.log('[ListenCapture] ✅ Screen capture started');
            this.emit('screenCaptureStarted', { source, constraints });
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Screen capture failed:', error);
            this.metrics.errors++;
            this.metrics.lastError = error;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start microphone capture
     */
    async startMicrophoneCapture(options = {}) {
        try {
            if (this.captureState.microphone.active) {
                throw new Error('Microphone capture is already active');
            }
            
            console.log('[ListenCapture] Starting microphone capture...');
            
            // Check microphone permission
            const hasPermission = await permissionService.hasPermission('microphone');
            if (!hasPermission) {
                throw new Error('Microphone permission not granted');
            }
            
            // Merge configuration
            const constraints = {
                ...this.config.microphone,
                ...options
            };
            
            // Start microphone capture
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: constraints,
                video: false
            });
            
            // Update state
            this.captureState.microphone = {
                active: true,
                stream,
                constraints
            };
            
            // Set up stream handling
            this._setupMicrophoneStreamHandling(stream);
            
            console.log('[ListenCapture] ✅ Microphone capture started');
            this.emit('microphoneCaptureStarted', { constraints });
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Microphone capture failed:', error);
            this.metrics.errors++;
            this.metrics.lastError = error;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start system audio capture
     */
    async startSystemAudioCapture(options = {}) {
        try {
            if (this.captureState.systemAudio.active) {
                throw new Error('System audio capture is already active');
            }
            
            console.log('[ListenCapture] Starting system audio capture...');
            
            // Check system audio permission
            const hasPermission = await permissionService.hasPermission('systemAudio');
            if (!hasPermission) {
                throw new Error('System audio permission not granted');
            }
            
            // Merge configuration
            const constraints = {
                ...this.config.systemAudio,
                ...options
            };
            
            // Start platform-specific system audio capture
            const result = await platformAudioCapture.startSystemAudioCapture(constraints);
            
            if (!result.success) {
                throw new Error(result.error || 'System audio capture failed');
            }
            
            // Update state
            this.captureState.systemAudio = {
                active: true,
                stream: result.stream,
                process: result.process,
                constraints
            };
            
            // Set up stream handling
            this._setupSystemAudioStreamHandling(result.stream);
            
            console.log('[ListenCapture] ✅ System audio capture started');
            this.emit('systemAudioCaptureStarted', { constraints });
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ System audio capture failed:', error);
            this.metrics.errors++;
            this.metrics.lastError = error;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start all capture types
     */
    async startCapture(options = {}) {
        try {
            if (this.isCapturing) {
                throw new Error('Capture is already active');
            }
            
            console.log('[ListenCapture] Starting all capture types...');
            
            const results = {
                screen: false,
                microphone: false,
                systemAudio: false
            };
            
            // Start screen capture if requested
            if (options.captureScreen !== false) {
                try {
                    results.screen = await this.startScreenCapture(null, options.screen);
                } catch (error) {
                    console.warn('[ListenCapture] Screen capture failed:', error.message);
                }
            }
            
            // Start microphone capture if requested
            if (options.captureMicrophone !== false) {
                try {
                    results.microphone = await this.startMicrophoneCapture(options.microphone);
                } catch (error) {
                    console.warn('[ListenCapture] Microphone capture failed:', error.message);
                }
            }
            
            // Start system audio capture if requested
            if (options.captureSystemAudio !== false) {
                try {
                    results.systemAudio = await this.startSystemAudioCapture(options.systemAudio);
                } catch (error) {
                    console.warn('[ListenCapture] System audio capture failed:', error.message);
                }
            }
            
            // Update capture state
            this.isCapturing = Object.values(results).some(Boolean);
            this.metrics.startTime = Date.now();
            
            if (this.isCapturing) {
                console.log('[ListenCapture] ✅ Capture started:', results);
                this.emit('captureStarted', results);
            } else {
                throw new Error('No capture types could be started');
            }
            
            return results;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Capture start failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop screen capture
     */
    async stopScreenCapture() {
        try {
            if (!this.captureState.screen.active) {
                return true;
            }
            
            console.log('[ListenCapture] Stopping screen capture...');
            
            // Stop stream
            if (this.captureState.screen.stream) {
                this.captureState.screen.stream.getTracks().forEach(track => track.stop());
            }
            
            // Update state
            this.captureState.screen = {
                active: false,
                stream: null,
                source: null,
                constraints: null
            };
            
            console.log('[ListenCapture] ✅ Screen capture stopped');
            this.emit('screenCaptureStopped');
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Screen capture stop failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop microphone capture
     */
    async stopMicrophoneCapture() {
        try {
            if (!this.captureState.microphone.active) {
                return true;
            }
            
            console.log('[ListenCapture] Stopping microphone capture...');
            
            // Stop stream
            if (this.captureState.microphone.stream) {
                this.captureState.microphone.stream.getTracks().forEach(track => track.stop());
            }
            
            // Update state
            this.captureState.microphone = {
                active: false,
                stream: null,
                constraints: null
            };
            
            console.log('[ListenCapture] ✅ Microphone capture stopped');
            this.emit('microphoneCaptureStopped');
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Microphone capture stop failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop system audio capture
     */
    async stopSystemAudioCapture() {
        try {
            if (!this.captureState.systemAudio.active) {
                return true;
            }
            
            console.log('[ListenCapture] Stopping system audio capture...');
            
            // Stop platform-specific system audio capture
            await platformAudioCapture.stopSystemAudioCapture();
            
            // Update state
            this.captureState.systemAudio = {
                active: false,
                stream: null,
                process: null,
                constraints: null
            };
            
            console.log('[ListenCapture] ✅ System audio capture stopped');
            this.emit('systemAudioCaptureStopped');
            
            return true;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ System audio capture stop failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop all capture types
     */
    async stopCapture() {
        try {
            if (!this.isCapturing) {
                return true;
            }
            
            console.log('[ListenCapture] Stopping all capture types...');
            
            const results = {
                screen: false,
                microphone: false,
                systemAudio: false
            };
            
            // Stop all capture types
            try {
                results.screen = await this.stopScreenCapture();
            } catch (error) {
                console.warn('[ListenCapture] Screen capture stop failed:', error.message);
            }
            
            try {
                results.microphone = await this.stopMicrophoneCapture();
            } catch (error) {
                console.warn('[ListenCapture] Microphone capture stop failed:', error.message);
            }
            
            try {
                results.systemAudio = await this.stopSystemAudioCapture();
            } catch (error) {
                console.warn('[ListenCapture] System audio capture stop failed:', error.message);
            }
            
            // Update capture state
            this.isCapturing = false;
            
            console.log('[ListenCapture] ✅ All capture stopped:', results);
            this.emit('captureStopped', results);
            
            return results;
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Capture stop failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Set up screen stream handling
     */
    _setupScreenStreamHandling(stream) {
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack) {
            // Handle track ended
            videoTrack.addEventListener('ended', () => {
                console.log('[ListenCapture] Screen track ended');
                this.emit('screenTrackEnded');
            });
            
            // Handle track muted
            videoTrack.addEventListener('mute', () => {
                console.log('[ListenCapture] Screen track muted');
                this.emit('screenTrackMuted');
            });
            
            // Handle track unmuted
            videoTrack.addEventListener('unmute', () => {
                console.log('[ListenCapture] Screen track unmuted');
                this.emit('screenTrackUnmuted');
            });
        }
    }

    /**
     * Set up microphone stream handling
     */
    _setupMicrophoneStreamHandling(stream) {
        const audioTrack = stream.getAudioTracks()[0];
        
        if (audioTrack) {
            // Handle track ended
            audioTrack.addEventListener('ended', () => {
                console.log('[ListenCapture] Microphone track ended');
                this.emit('microphoneTrackEnded');
            });
            
            // Handle track muted
            audioTrack.addEventListener('mute', () => {
                console.log('[ListenCapture] Microphone track muted');
                this.emit('microphoneTrackMuted');
            });
            
            // Handle track unmuted
            audioTrack.addEventListener('unmute', () => {
                console.log('[ListenCapture] Microphone track unmuted');
                this.emit('microphoneTrackUnmuted');
            });
        }
    }

    /**
     * Set up system audio stream handling
     */
    _setupSystemAudioStreamHandling(stream) {
        if (stream && stream.getAudioTracks) {
            const audioTrack = stream.getAudioTracks()[0];
            
            if (audioTrack) {
                // Handle track ended
                audioTrack.addEventListener('ended', () => {
                    console.log('[ListenCapture] System audio track ended');
                    this.emit('systemAudioTrackEnded');
                });
            }
        }
    }

    /**
     * Set audio callback for platform audio capture
     */
    setAudioCallback(callbackType, callback) {
        if (this.callbacks.hasOwnProperty(callbackType)) {
            this.callbacks[callbackType] = callback;
            
            // Set callback on platform audio capture
            if (callbackType === 'onSystemAudioData') {
                platformAudioCapture.setAudioCallback(callback);
            }
            
            console.log(`[ListenCapture] Set ${callbackType} callback`);
        } else {
            throw new Error(`Unknown callback type: ${callbackType}`);
        }
    }

    /**
     * Update configuration
     */
    updateConfig(configType, config) {
        if (this.config.hasOwnProperty(configType)) {
            this.config[configType] = { ...this.config[configType], ...config };
            console.log(`[ListenCapture] Updated ${configType} configuration`);
            this.emit('configUpdated', { type: configType, config: this.config[configType] });
        } else {
            throw new Error(`Unknown config type: ${configType}`);
        }
    }

    /**
     * Get capture status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isCapturing: this.isCapturing,
            platform: this.platform,
            captureState: {
                screen: {
                    active: this.captureState.screen.active,
                    hasStream: !!this.captureState.screen.stream,
                    source: this.captureState.screen.source?.name
                },
                microphone: {
                    active: this.captureState.microphone.active,
                    hasStream: !!this.captureState.microphone.stream
                },
                systemAudio: {
                    active: this.captureState.systemAudio.active,
                    hasStream: !!this.captureState.systemAudio.stream,
                    hasProcess: !!this.captureState.systemAudio.process
                }
            },
            metrics: this.metrics,
            config: this.config
        };
    }

    /**
     * Get capture metrics
     */
    getMetrics() {
        const duration = this.metrics.startTime ? Date.now() - this.metrics.startTime : 0;
        
        return {
            ...this.metrics,
            duration,
            isCapturing: this.isCapturing,
            captureTypes: {
                screen: this.captureState.screen.active,
                microphone: this.captureState.microphone.active,
                systemAudio: this.captureState.systemAudio.active
            }
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            startTime: this.isCapturing ? Date.now() : null,
            framesCaptured: 0,
            audioChunksCaptured: 0,
            errors: 0,
            lastError: null
        };
        
        console.log('[ListenCapture] Metrics reset');
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('[ListenCapture] Cleaning up...');
            
            // Stop all capture
            if (this.isCapturing) {
                await this.stopCapture();
            }
            
            // Cleanup platform audio capture
            await platformAudioCapture.cleanup();
            
            // Clear callbacks
            Object.keys(this.callbacks).forEach(key => {
                this.callbacks[key] = null;
            });
            
            // Remove all listeners
            this.removeAllListeners();
            
            // Reset state
            this.isInitialized = false;
            this.isCapturing = false;
            
            console.log('[ListenCapture] ✅ Cleanup complete');
            
        } catch (error) {
            console.error('[ListenCapture] ❌ Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new ListenCapture();