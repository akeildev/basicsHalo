const { ipcMain } = require('electron');
const permissionService = require('./services/permissionService');
const listenCapture = require('./services/listenCapture');
const platformAudioCapture = require('./services/platformAudioCapture');
const audioProcessor = require('./services/audioProcessor');
const LiveKitMainService = require('./services/livekitMainService');
const { v4: uuidv4 } = require('uuid');

class ListenService {
    constructor() {
        this.isListening = false;
        this.isTranscribing = false;
        this.isInitialized = false;
        this.agentMode = false;
        this.livekitRoom = null;
        
        // Capture and processing services
        this.capture = listenCapture;
        this.platformCapture = platformAudioCapture;
        this.processor = audioProcessor;
        this.permissions = permissionService;
        this.livekit = new LiveKitMainService();
        
        // Session state
        this.sessionId = null;
        this.startTime = null;
        this.audioChunks = [];
        
        // Callbacks
        this.callbacks = {
            onTranscriptionComplete: null,
            onStatusUpdate: null,
            onError: null,
            onLiveKitEvent: null
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
            
            // Set up LiveKit event handlers
            this.setupLiveKitHandlers();
            
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
            console.log('[ListenService] Starting listening session...', options);
            
            // Set agent mode
            this.agentMode = options.agentMode === true;
            
            if (this.agentMode) {
                // Agent mode - use LiveKit (NO capture controller needed)
                console.log('[ListenService] Agent mode - LiveKit handles all audio capture');
                return await this.startAgentSession(options);
            } else {
                // Traditional transcript mode
                return await this.startTranscriptSession(options);
            }
            
        } catch (error) {
            console.error('[ListenService] Failed to start listening:', error);
            this.notifyError(error);
            return false;
        }
    }
    
    /**
     * Start traditional transcript session
     */
    async startTranscriptSession(options) {
        console.log('[ListenService] Starting transcript session');
        
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
            startTime: this.startTime,
            mode: 'transcript'
        });
        
        console.log('[ListenService] Transcript session started');
        return true;
    }
    
    /**
     * Start LiveKit agent session
     */
    async startAgentSession(options) {
        console.log('[ListenService] Starting agent session');
        console.log('[ListenService] 🎯 IMPORTANT: LiveKit handles ALL audio capture internally');
        console.log('[ListenService] 🎯 No capture controller needed for agent mode');
        
        // Check microphone permission (LiveKit will use it directly)
        const hasMicPermission = await this.permissions.hasPermission('microphone');
        if (!hasMicPermission) {
            const granted = await this.permissions.requestPermission('microphone');
            if (!granted) {
                throw new Error('Microphone permission required for agent mode');
            }
        }
        
        // Start LiveKit session - it handles ALL audio capture internally
        const result = await this.livekit.startSession({
            startAgent: true,
            // LiveKit manages its own audio capture pipeline
            bypassCaptureController: true
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to start LiveKit session');
        }

        // Store room name
        this.livekitRoom = result.livekit.roomName;

        // Update state
        this.isListening = true;
        this.sessionId = result.livekit.roomName;
        this.startTime = Date.now();

        // Notify status change
        this.notifyStatusUpdate({
            isListening: true,
            sessionId: this.sessionId,
            startTime: this.startTime,
            mode: 'agent',
            roomName: result.livekit.roomName
        });

        console.log('[ListenService] Agent session started in room:', result.livekit.roomName);

        // Return connection details for the renderer process (ensure ONLY serializable data)
        const serializableResult = {
            success: true,
            livekit: {
                url: result.livekit.url,
                token: result.livekit.token,
                roomName: result.livekit.roomName
            }
        };

        // Double-check that the result is actually serializable
        try {
            JSON.stringify(serializableResult);
            console.log('[ListenService] ✅ Return result is serializable');
        } catch (serializeError) {
            console.error('[ListenService] ❌ Return result contains non-serializable data:', serializeError);
            // Return a safe fallback
            return {
                success: true,
                livekit: {
                    url: 'wss://livekit.example.com',
                    token: 'fallback-token',
                    roomName: result.livekit.roomName
                }
            };
        }

        return serializableResult;
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
            
            if (this.agentMode) {
                // Stop LiveKit session
                await this.livekit.stopSession();
                this.livekitRoom = null;
            } else {
                // Stop traditional capture
                this.processor.stopProcessing();
                await this.capture.stopCapture();
            }
            
            // Update state
            this.isListening = false;
            this.agentMode = false;
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
        try {
            // Only set up IPC handlers if ipcMain is available (main process)
            if (typeof ipcMain !== 'undefined') {
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

                console.log('[ListenService] Capture IPC handlers set up');
            } else {
                console.log('[ListenService] IPC not available, skipping capture handlers');
            }
        } catch (error) {
            console.warn('[ListenService] Could not set up capture IPC handlers:', error.message);
        }
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
     * Set up LiveKit event handlers
     */
    setupLiveKitHandlers() {
        // LiveKit connection events
        this.livekit.on('connected', (data) => {
            console.log('[ListenService] LiveKit connected:', data);
            this.notifyLiveKitEvent('connected', data);
        });
        
        this.livekit.on('disconnected', (data) => {
            console.log('[ListenService] LiveKit disconnected:', data);
            this.notifyLiveKitEvent('disconnected', data);
            if (this.agentMode && this.isListening) {
                this.stopListening();
            }
        });
        
        // Agent events
        this.livekit.on('agentStarted', () => {
            console.log('[ListenService] Agent started');
            this.notifyLiveKitEvent('agentStatus', { status: 'Agent connected' });
        });
        
        this.livekit.on('agentStopped', (data) => {
            console.log('[ListenService] Agent stopped:', data);
            this.notifyLiveKitEvent('agentStatus', { status: 'Agent disconnected' });
        });
        
        // Audio events
        this.livekit.on('agentAudioStarted', (data) => {
            console.log('[ListenService] Agent audio started');
            this.notifyLiveKitEvent('agentSpeaking', { speaking: true });
        });
        
        this.livekit.on('microphoneMuted', (data) => {
            console.log('[ListenService] Microphone muted:', data.muted);
            this.notifyStatusUpdate({ microphoneMuted: data.muted });
        });
        
        // Error events
        this.livekit.on('error', (error) => {
            console.error('[ListenService] LiveKit error:', error);
            this.notifyError(error);
        });
    }
    
    /**
     * Notify LiveKit event
     */
    notifyLiveKitEvent(event, data) {
        if (this.callbacks.onLiveKitEvent) {
            this.callbacks.onLiveKitEvent(event, data);
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const status = {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            isTranscribing: this.isTranscribing,
            agentMode: this.agentMode,
            sessionId: this.sessionId,
            startTime: this.startTime,
            audioChunks: this.audioChunks.length
        };

        // Safely get capture status - only primitive data
        try {
            const captureStatus = this.capture.getStatus();
            status.capture = {
                screen: captureStatus.screen ? {
                    active: captureStatus.screen.active,
                    hasStream: !!captureStatus.screen.stream
                } : { active: false, hasStream: false },
                microphone: captureStatus.microphone ? {
                    active: captureStatus.microphone.active,
                    hasStream: !!captureStatus.microphone.stream
                } : { active: false, hasStream: false },
                systemAudio: captureStatus.systemAudio ? {
                    active: captureStatus.systemAudio.active,
                    hasStream: !!captureStatus.systemAudio.stream
                } : { active: false, hasStream: false }
            };
        } catch (error) {
            console.warn('[ListenService] Error getting capture status:', error.message);
            status.capture = {
                screen: { active: false, hasStream: false },
                microphone: { active: false, hasStream: false },
                systemAudio: { active: false, hasStream: false }
            };
        }

        // Safely get processor status - only primitive data
        try {
            const processorStatus = this.processor.getStatus();
            status.processor = {
                isInitialized: processorStatus.isInitialized,
                isProcessing: processorStatus.isProcessing,
                vad: processorStatus.vad ? {
                    isVoiceActive: processorStatus.vad.isVoiceActive,
                    voiceFrames: processorStatus.vad.voiceFrames,
                    silenceFrames: processorStatus.vad.silenceFrames
                } : null
            };
        } catch (error) {
            console.warn('[ListenService] Error getting processor status:', error.message);
            status.processor = {
                isInitialized: false,
                isProcessing: false,
                vad: null
            };
        }

        // Safely get permissions - only primitive data
        try {
            const permissions = this.permissions.getAllPermissions();
            status.permissions = {
                microphone: permissions.microphone || 'unknown',
                screen: permissions.screen || 'unknown',
                systemAudio: permissions.systemAudio || 'unknown'
            };
        } catch (error) {
            console.warn('[ListenService] Error getting permissions:', error.message);
            status.permissions = {
                microphone: 'unknown',
                screen: 'unknown',
                systemAudio: 'unknown'
            };
        }

        if (this.agentMode && this.livekit) {
            try {
                const livekitStatus = this.livekit.getStatus();
                status.livekit = {
                    isConnected: livekitStatus.isConnected || false,
                    roomName: livekitStatus.roomName || null,
                    participants: livekitStatus.participants || 0
                };
            } catch (error) {
                console.warn('[ListenService] Error getting livekit status:', error.message);
                status.livekit = {
                    isConnected: false,
                    roomName: null,
                    participants: 0
                };
            }
        }

        // Double-check that the status is serializable
        try {
            JSON.stringify(status);
            console.log('[ListenService] ✅ Status result is serializable');
        } catch (serializeError) {
            console.error('[ListenService] ❌ Status result contains non-serializable data:', serializeError);
            // Return a safe fallback
            return {
                isInitialized: this.isInitialized,
                isListening: this.isListening,
                isTranscribing: this.isTranscribing,
                agentMode: this.agentMode,
                sessionId: this.sessionId,
                startTime: this.startTime,
                audioChunks: this.audioChunks.length
            };
        }

        return status;
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
