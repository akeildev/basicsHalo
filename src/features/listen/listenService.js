const { ipcMain } = require('electron');
const permissionService = require('./services/permissionService');
const listenCapture = require('./services/listenCapture');
const platformAudioCapture = require('./services/platformAudioCapture');
const audioProcessor = require('./services/audioProcessor');

class ListenService {
    constructor() {
        this.isListening = false;
        this.isTranscribing = false;
        this.isInitialized = false;
        
        // Capture and processing services
        this.capture = listenCapture;
        this.platformCapture = platformAudioCapture;
        this.processor = audioProcessor;
        this.permissions = permissionService;
        
        // Session state
        this.sessionId = null;
        this.startTime = null;
        this.audioChunks = [];
        
        // Callbacks
        this.callbacks = {
            onTranscriptionComplete: null,
            onStatusUpdate: null,
            onError: null
        };
    }

    /**
     * Initialize the listen service
     */
    async initialize() {
        try {
            console.log('[ListenService] Initializing...');
            
            // Initialize all services
            await this.permissions.initialize();
            await this.platformCapture.initialize();
            await this.processor.initialize();
            await this.capture.initialize();
            
            // Set up callbacks
            this.setupCallbacks();
            
            // Set up IPC handlers for capture window
            this.setupCaptureIPCHandlers();
            
            this.isInitialized = true;
            console.log('[ListenService] Initialization complete');
            return true;
            
        } catch (error) {
            console.error('[ListenService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Start listening session
     */
    async startListening(options = {}) {
        if (!this.isInitialized) {
            throw new Error('ListenService not initialized');
        }
        
        if (this.isListening) {
            console.warn('[ListenService] Already listening');
            return false;
        }

        try {
            console.log('[ListenService] Starting listening session...');
            
            // Check permissions
            const hasPermissions = await this.checkPermissions();
            if (!hasPermissions) {
                throw new Error('Required permissions not granted');
            }
            
            // Start capture
            const captureStarted = await this.capture.startCapture({
                captureScreen: options.captureScreen !== false,
                captureMicrophone: options.captureMicrophone !== false,
                captureSystemAudio: options.captureSystemAudio !== false
            });
            
            if (!captureStarted) {
                throw new Error('Failed to start capture');
            }
            
            // Start audio processing
            this.processor.startProcessing();
            
            // Update state
            this.isListening = true;
            this.sessionId = this.generateSessionId();
            this.startTime = Date.now();
            this.audioChunks = [];
            
            // Notify status change
            this.notifyStatusUpdate({
                isListening: true,
                sessionId: this.sessionId,
                startTime: this.startTime
            });
            
            console.log('[ListenService] Listening session started');
            return true;
            
        } catch (error) {
            console.error('[ListenService] Failed to start listening:', error);
            this.notifyError(error);
            return false;
        }
    }

    /**
     * Stop listening session
     */
    async stopListening() {
        if (!this.isListening) {
            return;
        }

        try {
            console.log('[ListenService] Stopping listening session...');
            
            // Stop processing
            this.processor.stopProcessing();
            
            // Stop capture
            await this.capture.stopCapture();
            
            // Update state
            this.isListening = false;
            const endTime = Date.now();
            const duration = endTime - this.startTime;
            
            // Notify status change
            this.notifyStatusUpdate({
                isListening: false,
                sessionId: this.sessionId,
                endTime: endTime,
                duration: duration,
                audioChunks: this.audioChunks.length
            });
            
            // Reset session data
            this.sessionId = null;
            this.startTime = null;
            this.audioChunks = [];
            
            console.log('[ListenService] Listening session stopped');
            
        } catch (error) {
            console.error('[ListenService] Error stopping listening:', error);
            this.notifyError(error);
        }
    }

    /**
     * Start transcription
     */
    async startTranscription() {
        if (!this.isListening) {
            throw new Error('Must be listening to start transcription');
        }
        
        this.isTranscribing = true;
        console.log('[ListenService] Transcription started');
        
        this.notifyStatusUpdate({
            isTranscribing: true
        });
    }

    /**
     * Stop transcription
     */
    async stopTranscription() {
        this.isTranscribing = false;
        console.log('[ListenService] Transcription stopped');
        
        this.notifyStatusUpdate({
            isTranscribing: false
        });
    }

    /**
     * Check required permissions
     */
    async checkPermissions() {
        const required = ['microphone', 'screen'];
        const systemAudioRequired = process.platform === 'darwin';
        
        for (const permission of required) {
            const hasPermission = await this.permissions.hasPermission(permission);
            if (!hasPermission) {
                console.warn(`[ListenService] Missing ${permission} permission`);
                return false;
            }
        }
        
        if (systemAudioRequired) {
            const hasSystemAudio = await this.permissions.hasPermission('systemAudio');
            if (!hasSystemAudio) {
                console.warn('[ListenService] Missing system audio permission');
                return false;
            }
        }
        
        return true;
    }

    /**
     * Request permissions
     */
    async requestPermissions() {
        try {
            console.log('[ListenService] Requesting permissions...');
            
            const permissions = ['microphone', 'screen'];
            if (process.platform === 'darwin') {
                permissions.push('systemAudio');
            }
            
            const results = {};
            for (const permission of permissions) {
                results[permission] = await this.permissions.requestPermission(permission);
            }
            
            return results;
            
        } catch (error) {
            console.error('[ListenService] Error requesting permissions:', error);
            throw error;
        }
    }

    /**
     * Set up service callbacks
     */
    setupCallbacks() {
        // Audio processor callbacks
        this.processor.setCallback('onAudioChunk', (chunkData) => {
            this.handleAudioChunk(chunkData);
        });
        
        this.processor.setCallback('onVoiceActivityChange', (activityData) => {
            this.handleVoiceActivityChange(activityData);
        });
        
        this.processor.setCallback('onError', (error) => {
            this.notifyError(error);
        });
        
        // Capture callbacks
        this.capture.setAudioCallback('onMicrophoneData', (data) => {
            this.processor.processMicrophoneAudio(data.samples);
        });
        
        this.capture.setAudioCallback('onSystemAudioData', (data) => {
            this.processor.processSystemAudio(data);
        });
        
        this.capture.setAudioCallback('onError', (error) => {
            this.notifyError(error);
        });
    }

    /**
     * Set up IPC handlers for capture window
     */
    setupCaptureIPCHandlers() {
        // Handle audio data from capture window
        ipcMain.on('capture:audio-data', (event, { type, data }) => {
            if (!this.isListening) return;
            
            try {
                const floatArray = new Float32Array(data);
                
                if (type === 'microphone') {
                    this.processor.processMicrophoneAudio(floatArray);
                } else if (type === 'screen') {
                    // Process screen audio if needed
                    console.log('[ListenService] Received screen audio data');
                }
            } catch (error) {
                console.error('[ListenService] Error processing capture audio:', error);
            }
        });
        
        // Handle capture status updates
        ipcMain.on('capture:status', (event, status) => {
            console.log('[ListenService] Capture status update:', status);
        });
        
        // Handle capture errors
        ipcMain.on('capture:error', (event, error) => {
            console.error('[ListenService] Capture error:', error);
            this.notifyError(error);
        });
    }

    /**
     * Handle audio chunk from processor
     */
    handleAudioChunk(chunkData) {
        try {
            // Store chunk for session
            this.audioChunks.push(chunkData);
            
            // If transcribing, send to transcription service
            if (this.isTranscribing && chunkData.voiceActivity) {
                this.sendToTranscription(chunkData);
            }
            
        } catch (error) {
            console.error('[ListenService] Error handling audio chunk:', error);
            this.notifyError(error);
        }
    }

    /**
     * Handle voice activity change
     */
    handleVoiceActivityChange(activityData) {
        this.notifyStatusUpdate({
            voiceActivity: activityData.isVoiceActive,
            energy: activityData.energy
        });
    }

    /**
     * Send audio chunk to transcription service
     */
    sendToTranscription(chunkData) {
        // This would integrate with the actual transcription service
        console.log('[ListenService] Sending audio chunk to transcription:', {
            timestamp: chunkData.timestamp,
            voiceActivity: chunkData.voiceActivity,
            chunkSize: chunkData.chunkSize
        });
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Set service callback
     */
    setCallback(type, callback) {
        if (this.callbacks.hasOwnProperty(type)) {
            this.callbacks[type] = callback;
        } else {
            console.warn(`[ListenService] Unknown callback type: ${type}`);
        }
    }

    /**
     * Notify status update
     */
    notifyStatusUpdate(status) {
        if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(status);
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
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            isTranscribing: this.isTranscribing,
            sessionId: this.sessionId,
            startTime: this.startTime,
            audioChunks: this.audioChunks.length,
            capture: this.capture.getStatus(),
            processor: this.processor.getStatus(),
            permissions: this.permissions.getAllPermissions()
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            processor: this.processor.getMetrics(),
            capture: this.capture.getStatus(),
            session: {
                duration: this.startTime ? Date.now() - this.startTime : 0,
                audioChunks: this.audioChunks.length
            }
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            if (this.isListening) {
                await this.stopListening();
            }
            
            await this.processor.cleanup();
            await this.platformCapture.cleanup();
            
            this.isInitialized = false;
            console.log('[ListenService] Cleanup complete');
            
        } catch (error) {
            console.error('[ListenService] Cleanup error:', error);
        }
    }
}

module.exports = new ListenService();
