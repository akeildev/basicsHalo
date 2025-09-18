# Phase 3: Renderer Implementation - Detailed Implementation

## 3.1 HTML Interface Structure

Create `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Overlay</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <!-- Header with status indicator -->
        <div class="header">
            <div class="header-left">
                <div class="status-indicator" id="statusIndicator">
                    <div class="status-dot"></div>
                    <div class="status-dot"></div>
                    <div class="status-dot"></div>
                </div>
                <span class="title">Voice Assistant</span>
            </div>
            <div class="header-right">
                <button class="btn-icon" id="clearBtn" title="Clear messages">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <button class="btn-icon" id="pinBtn" title="Toggle always on top">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Messages area -->
        <div class="messages-container" id="messagesContainer">
            <div class="messages" id="messages">
                <!-- Messages will be added dynamically -->
            </div>
        </div>

        <!-- Control area -->
        <div class="controls">
            <div class="button-group">
                <button class="voice-btn" id="voiceBtn">
                    <svg class="mic-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    <span class="btn-text">Start Voice</span>
                </button>
                <button class="mute-btn" id="muteBtn" title="Mute microphone">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="mic-icon">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="mic-off-icon" style="display: none;">
                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                    </svg>
                </button>
            </div>
            <div class="status-text" id="statusText">Ready</div>
        </div>
    </div>
    
    <script src="index.js"></script>
</body>
</html>
```

## 3.2 Main Renderer JavaScript

Create `src/renderer/index.js`:
```javascript
/**
 * Voice Overlay Renderer
 * Main UI controller for the voice assistant
 */

class VoiceOverlay {
    constructor() {
        // State
        this.isActive = false;
        this.isMuted = false;
        this.isConnecting = false;
        this.livekitClient = null;
        this.isPinned = true;
        
        // Message history
        this.messageHistory = [];
        this.maxMessages = 100;
        
        // Initialize
        this.initElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        
        // Add welcome message
        this.addMessage('system', 'Welcome! Click "Start Voice" to begin.');
    }
    
    initElements() {
        // Header elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.clearBtn = document.getElementById('clearBtn');
        this.pinBtn = document.getElementById('pinBtn');
        
        // Message elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messages = document.getElementById('messages');
        
        // Control elements
        this.voiceBtn = document.getElementById('voiceBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.statusText = document.getElementById('statusText');
        
        // Mute button icons
        this.micIcon = this.muteBtn.querySelector('.mic-icon');
        this.micOffIcon = this.muteBtn.querySelector('.mic-off-icon');
    }
    
    setupEventListeners() {
        // Voice button
        this.voiceBtn.addEventListener('click', () => this.toggleVoice());
        
        // Mute button
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        // Clear button
        this.clearBtn.addEventListener('click', () => this.clearMessages());
        
        // Pin button
        this.pinBtn.addEventListener('click', () => this.togglePin());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + M to toggle mute
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                this.toggleMute();
            }
            
            // Spacebar to start/stop (when not typing)
            if (e.key === ' ' && document.activeElement === document.body) {
                e.preventDefault();
                this.toggleVoice();
            }
        });
    }
    
    setupIPCListeners() {
        // Voice status updates
        window.api.on('voice:status', (data) => {
            console.log('[Renderer] Voice status:', data);
            if (data.connected !== undefined) {
                this.isActive = data.connected;
                this.updateUI();
            }
        });
        
        // Transcript updates
        window.api.on('voice:transcript', (data) => {
            this.addMessage('user', data.text);
        });
        
        // Agent responses
        window.api.on('agent:response', (data) => {
            this.addMessage('assistant', data.text);
        });
        
        // Agent thinking state
        window.api.on('agent:thinking', (data) => {
            if (data.thinking) {
                this.showThinking();
            } else {
                this.hideThinking();
            }
        });
        
        // Errors
        window.api.on('voice:error', (data) => {
            this.addMessage('error', data.message || 'An error occurred');
            this.setStatus('Error - check connection');
        });
        
        // MCP tool results
        window.api.on('mcp:result', (data) => {
            this.addMessage('system', `Tool: ${data.tool}\nResult: ${data.result}`);
        });
    }
    
    async loadSettings() {
        try {
            // Load always on top setting
            const alwaysOnTop = await window.api.getSetting('alwaysOnTop');
            this.isPinned = alwaysOnTop !== false;
            this.updatePinUI();
            
            // Load other settings as needed
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    
    async toggleVoice() {
        if (this.isConnecting) {
            console.log('Already connecting/disconnecting');
            return;
        }
        
        try {
            if (this.isActive) {
                await this.stopVoice();
            } else {
                await this.startVoice();
            }
        } catch (error) {
            console.error('Toggle voice error:', error);
            this.addMessage('error', error.message);
        }
    }
    
    async startVoice() {
        console.log('[Renderer] Starting voice...');
        
        this.isConnecting = true;
        this.voiceBtn.disabled = true;
        this.setStatus('Connecting...');
        
        try {
            const result = await window.api.startVoice();
            
            if (result.success) {
                console.log('[Renderer] Voice started successfully');
                
                // Connect LiveKit client
                await this.connectLiveKit(result);
                
                this.isActive = true;
                this.isConnecting = false;
                this.updateUI();
                this.setStatus('Connected');
                this.addMessage('system', '✅ Voice chat connected');
            } else {
                throw new Error(result.error || 'Failed to start voice');
            }
        } catch (error) {
            console.error('[Renderer] Failed to start voice:', error);
            this.isConnecting = false;
            this.voiceBtn.disabled = false;
            this.setStatus('Failed to connect');
            this.addMessage('error', `Failed to connect: ${error.message}`);
        }
    }
    
    async connectLiveKit(config) {
        console.log('[Renderer] Connecting LiveKit client...');
        
        try {
            // Dynamically import LiveKit client
            const module = await import('./livekit-client.js');
            const LiveKitClient = module.default;
            
            this.livekitClient = new LiveKitClient();
            
            // Set up LiveKit event handlers
            this.setupLiveKitHandlers();
            
            // Connect to room
            const result = await this.livekitClient.connect(config.url, config.token);
            
            if (!result.success) {
                throw new Error('Failed to connect to LiveKit');
            }
            
            console.log('[Renderer] LiveKit connected successfully');
        } catch (error) {
            console.error('[Renderer] LiveKit connection failed:', error);
            throw error;
        }
    }
    
    setupLiveKitHandlers() {
        if (!window.electronAPI) {
            console.error('electronAPI not available');
            return;
        }
        
        // Send LiveKit events to main process
        window.electronAPI = {
            ...window.electronAPI,
            sendLiveKitEvent: (event, data) => {
                console.log('[Renderer] LiveKit event:', event, data);
                
                switch (event) {
                    case 'connected':
                        this.addMessage('system', '🎤 Microphone connected');
                        break;
                    case 'agentConnected':
                        this.addMessage('system', '🤖 AI Assistant joined');
                        break;
                    case 'agentSpeaking':
                        if (data.speaking) {
                            this.showThinking();
                        } else {
                            this.hideThinking();
                        }
                        break;
                    case 'error':
                        this.addMessage('error', data.error || 'Connection error');
                        break;
                }
            }
        };
    }
    
    async stopVoice() {
        console.log('[Renderer] Stopping voice...');
        
        this.isConnecting = true;
        this.voiceBtn.disabled = true;
        this.setStatus('Disconnecting...');
        
        try {
            // Disconnect LiveKit first
            if (this.livekitClient) {
                await this.livekitClient.disconnect();
                this.livekitClient = null;
            }
            
            // Stop backend session
            const result = await window.api.stopVoice();
            
            if (result.success) {
                this.isActive = false;
                this.isConnecting = false;
                this.updateUI();
                this.setStatus('Disconnected');
                this.addMessage('system', '⏹️ Voice chat disconnected');
            } else {
                throw new Error(result.error || 'Failed to stop voice');
            }
        } catch (error) {
            console.error('[Renderer] Failed to stop voice:', error);
            this.isConnecting = false;
            this.voiceBtn.disabled = false;
            this.setStatus('Error disconnecting');
        }
    }
    
    async toggleMute() {
        if (!this.isActive || !this.livekitClient) {
            console.log('Not connected');
            return;
        }
        
        // Debounce
        if (this.muteBtn.disabled) return;
        this.muteBtn.disabled = true;
        
        try {
            this.isMuted = !this.isMuted;
            
            // Update UI immediately
            this.updateMuteUI();
            
            // Mute via LiveKit
            const result = await this.livekitClient.setMicrophoneMuted(this.isMuted);
            
            if (result.success) {
                this.addMessage('system', this.isMuted ? '🔇 Microphone muted' : '🎤 Microphone unmuted');
            } else {
                // Revert on failure
                this.isMuted = !this.isMuted;
                this.updateMuteUI();
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to toggle mute:', error);
            this.addMessage('error', 'Failed to toggle mute');
        } finally {
            setTimeout(() => {
                this.muteBtn.disabled = false;
            }, 500);
        }
    }
    
    async togglePin() {
        this.isPinned = !this.isPinned;
        await window.api.setAlwaysOnTop(this.isPinned);
        this.updatePinUI();
        
        const message = this.isPinned ? 'Window pinned on top' : 'Window unpinned';
        this.addMessage('system', message);
    }
    
    clearMessages() {
        this.messages.innerHTML = '';
        this.messageHistory = [];
        this.addMessage('system', 'Messages cleared');
    }
    
    addMessage(type, text) {
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;
        contentDiv.appendChild(textDiv);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        contentDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        
        // Add to history
        this.messageHistory.push({ type, text, time: new Date() });
        
        // Limit history
        if (this.messageHistory.length > this.maxMessages) {
            this.messageHistory.shift();
            this.messages.removeChild(this.messages.firstChild);
        }
        
        // Auto-scroll
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        // Animate in
        requestAnimationFrame(() => {
            messageDiv.classList.add('animate-in');
        });
    }
    
    showThinking() {
        // Remove existing thinking indicator
        this.hideThinking();
        
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message assistant thinking';
        thinkingDiv.id = 'thinkingIndicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'typing-dot';
            indicatorDiv.appendChild(dot);
        }
        
        contentDiv.appendChild(indicatorDiv);
        thinkingDiv.appendChild(contentDiv);
        this.messages.appendChild(thinkingDiv);
        
        // Auto-scroll
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    hideThinking() {
        const indicator = document.getElementById('thinkingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    setStatus(text) {
        this.statusText.textContent = text;
    }
    
    updateUI() {
        // Update voice button
        if (this.isActive) {
            this.voiceBtn.classList.add('active');
            this.voiceBtn.querySelector('.btn-text').textContent = 'Stop Voice';
            this.statusIndicator.classList.add('active');
        } else {
            this.voiceBtn.classList.remove('active');
            this.voiceBtn.querySelector('.btn-text').textContent = 'Start Voice';
            this.statusIndicator.classList.remove('active');
        }
        
        // Enable/disable mute button
        this.muteBtn.disabled = !this.isActive;
        
        // Enable voice button if not connecting
        this.voiceBtn.disabled = this.isConnecting;
    }
    
    updateMuteUI() {
        if (this.isMuted) {
            this.muteBtn.classList.add('muted');
            this.micIcon.style.display = 'none';
            this.micOffIcon.style.display = 'block';
        } else {
            this.muteBtn.classList.remove('muted');
            this.micIcon.style.display = 'block';
            this.micOffIcon.style.display = 'none';
        }
    }
    
    updatePinUI() {
        if (this.isPinned) {
            this.pinBtn.classList.add('active');
        } else {
            this.pinBtn.classList.remove('active');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Renderer] Initializing Voice Overlay...');
    window.voiceOverlay = new VoiceOverlay();
});
```

## 3.3 LiveKit Client Implementation

Create `src/renderer/livekit-client.js` (exact copy from current project):
```javascript
/**
 * LiveKit Client for Voice Overlay
 * Handles WebRTC connection and audio streaming
 */

class LiveKitClient {
    constructor() {
        this.room = null;
        this.localTracks = [];
        this.remoteTracks = new Map();
        this.isConnected = false;
        this.livekitAPI = null;
        this.isMuted = false;
        
        console.log('[LiveKitClient] Initialized');
    }
    
    async loadLiveKitSDK() {
        if (this.livekitAPI) {
            return this.livekitAPI;
        }
        
        try {
            console.log('[LiveKitClient] Loading LiveKit SDK...');
            
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (window.LivekitClient) {
                    this.livekitAPI = window.LivekitClient;
                    console.log('[LiveKitClient] SDK already loaded');
                    resolve(this.livekitAPI);
                    return;
                }
                
                // Load from CDN
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2.1.2/dist/livekit-client.umd.min.js';
                script.onload = () => {
                    this.livekitAPI = window.LivekitClient || window.LiveKit;
                    
                    if (!this.livekitAPI) {
                        reject(new Error('LiveKit SDK not found after loading'));
                        return;
                    }
                    
                    console.log('[LiveKitClient] SDK loaded successfully');
                    resolve(this.livekitAPI);
                };
                script.onerror = (error) => {
                    console.error('[LiveKitClient] Failed to load SDK:', error);
                    reject(new Error('Failed to load LiveKit SDK'));
                };
                document.head.appendChild(script);
            });
        } catch (error) {
            console.error('[LiveKitClient] Failed to load SDK:', error);
            throw error;
        }
    }
    
    async connect(url, token) {
        try {
            console.log('[LiveKitClient] Connecting to room...');
            
            if (!url || !token) {
                throw new Error('Missing URL or token');
            }
            
            // Load SDK
            const livekit = await this.loadLiveKitSDK();
            
            // Create room
            this.room = new livekit.Room({
                adaptiveStream: true,
                dynacast: true,
                stopLocalTrackOnUnpublish: true,
                reconnectPolicy: {
                    nextRetryDelayInMs: (context) => {
                        return Math.min(5000, Math.random() * 300 * Math.pow(2, context.retryCount));
                    },
                    maxRetries: 10,
                },
                logLevel: 'debug',
            });
            
            // Setup handlers
            this.setupEventHandlers();
            
            // Connect
            await this.room.connect(url, token);
            
            this.isConnected = true;
            console.log('[LiveKitClient] Connected to room:', this.room.name);
            
            // Publish microphone if not muted
            if (!this.isMuted) {
                await this.publishMicrophone();
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Connection failed:', error);
            this.isConnected = false;
            
            // Notify renderer
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('error', {
                    type: 'connection',
                    error: error.message
                });
            }
            
            throw error;
        }
    }
    
    setupEventHandlers() {
        if (!this.room || !this.livekitAPI) return;
        
        const { RoomEvent, Track } = this.livekitAPI;
        
        // Room connected
        this.room.on(RoomEvent.Connected, () => {
            console.log('[LiveKitClient] Room connected');
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('connected', { 
                    roomName: this.room.name
                });
            }
        });
        
        // Room disconnected
        this.room.on(RoomEvent.Disconnected, (reason) => {
            console.log('[LiveKitClient] Room disconnected:', reason);
            this.isConnected = false;
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('disconnected', { reason });
            }
        });
        
        // Participant connected
        this.room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log('[LiveKitClient] Participant connected:', participant.identity);
            
            // Check if agent
            if (participant.identity && participant.identity.includes('agent')) {
                if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                    window.electronAPI.sendLiveKitEvent('agentConnected', {
                        identity: participant.identity
                    });
                }
            }
        });
        
        // Track subscribed (agent audio)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('[LiveKitClient] Track subscribed:', track.kind, 'from', participant.identity);
            
            if (participant.identity && participant.identity.includes('agent') && 
                track.kind === Track.Kind.Audio) {
                this.handleAgentAudioTrack(track);
            }
        });
        
        // Track unsubscribed
        this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
            const audioElement = this.remoteTracks.get(track.sid);
            if (audioElement) {
                track.detach(audioElement);
                audioElement.remove();
                this.remoteTracks.delete(track.sid);
            }
        });
        
        // Active speakers (for agent speaking indicator)
        this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const agentSpeaking = speakers.some(speaker => 
                speaker.identity && speaker.identity.includes('agent')
            );
            
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('agentSpeaking', { 
                    speaking: agentSpeaking 
                });
            }
        });
        
        // Connection quality
        this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            console.log('[LiveKitClient] Connection quality:', quality);
        });
        
        // Media device errors
        this.room.on(RoomEvent.MediaDevicesError, (error) => {
            console.error('[LiveKitClient] Media device error:', error);
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('error', { 
                    type: 'mediaDevices',
                    error: error.message 
                });
            }
        });
    }
    
    async publishMicrophone() {
        try {
            console.log('[LiveKitClient] Publishing microphone...');
            
            const { createLocalTracks, Track } = this.livekitAPI;
            
            // Create audio track
            const tracks = await createLocalTracks({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            
            this.localTracks = tracks;
            
            // Publish to room
            for (const track of tracks) {
                if (track.kind === Track.Kind.Audio) {
                    await this.room.localParticipant.publishTrack(track);
                    console.log('[LiveKitClient] Microphone published');
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Failed to publish microphone:', error);
            if (window.electronAPI && window.electronAPI.sendLiveKitEvent) {
                window.electronAPI.sendLiveKitEvent('error', { 
                    type: 'microphone',
                    error: error.message 
                });
            }
            throw error;
        }
    }
    
    handleAgentAudioTrack(track) {
        console.log('[LiveKitClient] Handling agent audio');
        
        // Create audio element
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        
        // Attach track
        track.attach(audioElement);
        
        // Store reference
        this.remoteTracks.set(track.sid, audioElement);
        
        // Add to DOM (hidden)
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
        
        console.log('[LiveKitClient] Agent audio playing');
    }
    
    async setMicrophoneMuted(muted) {
        try {
            this.isMuted = muted;
            
            if (!this.room || !this.room.localParticipant) {
                return { success: false, error: 'Not connected' };
            }
            
            const { Track } = this.livekitAPI;
            
            if (muted) {
                // Unpublish audio tracks
                const audioPublications = Array.from(
                    this.room.localParticipant.trackPublications.values()
                ).filter(pub => pub.track && pub.track.kind === Track.Kind.Audio);
                
                for (const pub of audioPublications) {
                    await this.room.localParticipant.unpublishTrack(pub.track);
                    if (pub.track.stop) pub.track.stop();
                    this.localTracks = this.localTracks.filter(t => t !== pub.track);
                }
                
                console.log('[LiveKitClient] Microphone muted');
            } else {
                // Check if already publishing
                const hasAudio = Array.from(
                    this.room.localParticipant.trackPublications.values()
                ).some(pub => pub.track && pub.track.kind === Track.Kind.Audio);
                
                if (!hasAudio) {
                    // Create and publish new audio track
                    const tracks = await this.livekitAPI.createLocalTracks({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    
                    for (const track of tracks) {
                        if (track.kind === Track.Kind.Audio) {
                            await this.room.localParticipant.publishTrack(track);
                            this.localTracks.push(track);
                        }
                    }
                    
                    console.log('[LiveKitClient] Microphone unmuted');
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Mute error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async disconnect() {
        try {
            console.log('[LiveKitClient] Disconnecting...');
            
            // Stop local tracks
            for (const track of this.localTracks) {
                track.stop();
                if (this.room && this.room.localParticipant) {
                    await this.room.localParticipant.unpublishTrack(track);
                }
            }
            this.localTracks = [];
            
            // Clean up remote audio
            for (const [sid, audioElement] of this.remoteTracks) {
                audioElement.remove();
            }
            this.remoteTracks.clear();
            
            // Disconnect room
            if (this.room) {
                await this.room.disconnect();
                this.room = null;
            }
            
            this.isConnected = false;
            console.log('[LiveKitClient] Disconnected');
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Disconnect error:', error);
            return { success: false, error: error.message };
        }
    }
    
    getStatus() {
        return {
            isConnected: this.isConnected,
            roomName: this.room?.name,
            isMuted: this.isMuted,
            connectionState: this.room?.state
        };
    }
}

export default LiveKitClient;
```

## 3.4 CSS Styling (Non-transparent version)

Create `src/renderer/styles.css`:
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #333;
    overflow: hidden;
    user-select: none;
    height: 100vh;
}

/* Container */
.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Header */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    margin-bottom: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.status-indicator {
    display: flex;
    gap: 3px;
}

.status-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #ccc;
    transition: all 0.3s;
}

.status-indicator.active .status-dot {
    background: #4ade80;
    animation: pulse 1.4s infinite ease-in-out;
}

.status-indicator.active .status-dot:nth-child(1) { animation-delay: -0.32s; }
.status-indicator.active .status-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulse {
    0%, 80%, 100% { 
        transform: scale(1);
        opacity: 0.5;
    }
    40% { 
        transform: scale(1.8);
        opacity: 1;
    }
}

.title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.header-right {
    display: flex;
    gap: 6px;
}

.btn-icon {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.05);
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.btn-icon:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
}

.btn-icon.active {
    background: #667eea;
    color: white;
}

/* Messages Container */
.messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    margin-bottom: 12px;
    background: white;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.messages {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* Message Styles */
.message {
    display: flex;
    max-width: 80%;
    animation: slideIn 0.3s ease;
}

.message.user {
    align-self: flex-end;
}

.message.assistant {
    align-self: flex-start;
}

.message.system {
    align-self: center;
    max-width: 90%;
}

.message.error {
    align-self: center;
    max-width: 90%;
}

.message-content {
    padding: 8px 12px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.message.user .message-content {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.message.assistant .message-content {
    background: #f3f4f6;
    color: #333;
}

.message.system .message-content {
    background: #dbeafe;
    color: #1e40af;
    text-align: center;
}

.message.error .message-content {
    background: #fee2e2;
    color: #dc2626;
}

.message-text {
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    margin-bottom: 4px;
}

.message-time {
    font-size: 10px;
    opacity: 0.6;
    text-align: right;
}

.message.assistant .message-time {
    text-align: left;
}

/* Thinking Indicator */
.message.thinking .message-content {
    background: #f9fafb;
    border: 1px dashed #d1d5db;
}

.typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 0;
}

.typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9ca3af;
    animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
    0%, 80%, 100% { 
        transform: scale(0.8); 
        opacity: 0.5; 
    }
    40% { 
        transform: scale(1); 
        opacity: 1; 
    }
}

/* Controls */
.controls {
    background: white;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.button-group {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
}

.voice-btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
}

.voice-btn:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.voice-btn:active:not(:disabled) {
    transform: scale(0.98);
}

.voice-btn.active {
    background: linear-gradient(135deg, #ef4444, #dc2626);
}

.voice-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.mute-btn {
    width: 48px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: #f3f4f6;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.mute-btn:hover:not(:disabled) {
    background: #e5e7eb;
}

.mute-btn.muted {
    background: #fee2e2;
    color: #dc2626;
}

.mute-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.status-text {
    font-size: 11px;
    color: #666;
    text-align: center;
}

/* Animations */
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.message.animate-in {
    animation: slideIn 0.3s ease;
}

/* Scrollbar */
.messages-container::-webkit-scrollbar {
    width: 6px;
}

.messages-container::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb {
    background: #9ca3af;
    border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
}

/* Responsive */
@media (max-height: 400px) {
    .header {
        padding: 8px 12px;
    }
    
    .controls {
        padding: 8px;
    }
    
    .container {
        padding: 8px;
    }
}

@media (max-width: 350px) {
    .message {
        max-width: 95%;
    }
    
    .message-content {
        padding: 6px 10px;
    }
    
    .message-text {
        font-size: 12px;
    }
}
```

## 3.5 Testing the Renderer

Create `test-renderer.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Renderer</title>
    <link rel="stylesheet" href="src/renderer/styles.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <div class="status-indicator active">
                    <div class="status-dot"></div>
                    <div class="status-dot"></div>
                    <div class="status-dot"></div>
                </div>
                <span class="title">Voice Assistant (Test)</span>
            </div>
        </div>
        
        <div class="messages-container">
            <div class="messages">
                <div class="message system">
                    <div class="message-content">
                        <div class="message-text">Test mode - UI preview</div>
                    </div>
                </div>
                <div class="message user">
                    <div class="message-content">
                        <div class="message-text">Hello, can you help me?</div>
                        <div class="message-time">10:30 AM</div>
                    </div>
                </div>
                <div class="message assistant">
                    <div class="message-content">
                        <div class="message-text">Of course! I'm here to help.</div>
                        <div class="message-time">10:31 AM</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="controls">
            <div class="button-group">
                <button class="voice-btn">
                    <span>Start Voice</span>
                </button>
                <button class="mute-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    </svg>
                </button>
            </div>
            <div class="status-text">Ready</div>
        </div>
    </div>
</body>
</html>
```

Open in browser to preview:
```bash
open test-renderer.html
```

## Common Issues and Solutions

### Issue 1: LiveKit SDK not loading
```javascript
// Fallback to local copy
if (!window.LivekitClient) {
    const { Room, createLocalTracks } = await import('livekit-client');
    this.livekitAPI = { Room, createLocalTracks };
}
```

### Issue 2: Microphone permissions
```javascript
// Request permissions explicitly
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => console.log('Mic permission granted'))
    .catch(err => console.error('Mic permission denied:', err));
```

### Issue 3: Messages not scrolling
```javascript
// Force scroll after adding message
requestAnimationFrame(() => {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
});
```

## Next Steps

With Phase 3 complete, you have:
- ✅ Full HTML interface
- ✅ Complete renderer JavaScript
- ✅ LiveKit client integration
- ✅ Professional styling
- ✅ Message management
- ✅ Voice controls
- ✅ Mute functionality
- ✅ Always-on-top toggle

The UI is fully functional and ready to connect to the backend. Proceed to Phase 4 for the Python voice agent implementation.