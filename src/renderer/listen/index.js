// Listen window renderer with chat-style UI matching Ask window

class ListenWindow {
    constructor() {
        this.isListening = false;
        this.livekitClient = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
    }

    initializeElements() {
        // Header elements
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Messages area
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messages = document.getElementById('messages');
        
        // Control elements
        this.voiceBtn = document.getElementById('voiceBtn');
        this.statusText = document.getElementById('statusText');
    }

    setupEventListeners() {
        // Voice button - click to toggle
        this.voiceBtn.addEventListener('click', () => this.toggleListening());
        
        // Clear button
        this.clearBtn.addEventListener('click', () => this.clearMessages());
    }

    setupIPCListeners() {
        // Listen for status updates
        window.electronAPI.onListenStatus((data) => {
            this.updateListeningStatus(data.isListening);
        });

        // Listen for transcript updates
        window.electronAPI.onListenTranscript((data) => {
            this.addMessage('user', data.text);
        });

        // Listen for errors
        window.electronAPI.onListenError((error) => {
            this.addMessage('error', error.message);
        });

        // LiveKit events
        window.electronAPI.onLiveKitEvent((eventType, data) => {
            console.log('[Listen] LiveKit event:', eventType, data);
            
            switch(eventType) {
                case 'connected':
                    this.addMessage('system', 'Connected to voice channel');
                    this.updateStatus('Connected - Ready to talk');
                    break;
                case 'disconnected':
                    this.addMessage('system', 'Disconnected from voice channel');
                    this.updateStatus('Disconnected');
                    break;
                case 'agentConnected':
                    this.addMessage('system', 'AI Assistant joined');
                    break;
                case 'agentSpeaking':
                    this.setAgentSpeaking(data.speaking);
                    break;
                case 'agentResponse':
                    this.addMessage('assistant', data.text);
                    break;
                case 'error':
                    this.addMessage('error', data.error || 'Connection error');
                    break;
            }
        });
    }

    async toggleListening() {
        try {
            if (this.isListening) {
                await this.stopListening();
            } else {
                await this.startListening();
            }
        } catch (error) {
            console.error('[Listen] Toggle error:', error);
            this.addMessage('error', error.message);
        }
    }

    async startListening() {
        console.log('[Listen] Starting voice chat...');
        
        this.voiceBtn.disabled = true;
        this.updateStatus('Connecting...');
        
        // Always use agent mode with LiveKit
        const result = await window.electronAPI.startListening({ 
            agentMode: true,
            startAgent: true 
        });
        
        if (result.success) {
            this.isListening = true;
            this.updateUI(true);
            
            // Initialize LiveKit client if we have connection details
            if (result.livekit) {
                await this.connectLiveKit(result.livekit);
            }
            
            this.voiceBtn.disabled = false;
        } else {
            this.addMessage('error', result.error || 'Failed to start voice chat');
            this.voiceBtn.disabled = false;
            this.updateStatus('Failed to connect');
        }
    }

    async stopListening() {
        console.log('[Listen] Stopping voice chat...');
        
        this.voiceBtn.disabled = true;
        this.updateStatus('Disconnecting...');
        
        // Disconnect LiveKit first
        if (this.livekitClient) {
            await this.livekitClient.disconnect();
            this.livekitClient = null;
        }
        
        const result = await window.electronAPI.stopListening();
        
        if (result.success) {
            this.isListening = false;
            this.updateUI(false);
            this.updateStatus('Ready to listen');
        } else {
            this.addMessage('error', result.error || 'Failed to stop');
        }
        
        this.voiceBtn.disabled = false;
    }

    async connectLiveKit(config) {
        console.log('[Listen] Connecting to LiveKit...');
        
        try {
            // Dynamically import LiveKit client
            await this.ensureLiveKitClient();
            
            // Connect to LiveKit room
            const result = await this.livekitClient.connect(config.url, config.token);
            
            if (result.success) {
                console.log('[Listen] ✅ Connected to LiveKit');
            } else {
                throw new Error('Failed to connect to LiveKit');
            }
        } catch (error) {
            console.error('[Listen] LiveKit connection error:', error);
            this.addMessage('error', 'Failed to connect to voice server');
        }
    }

    async ensureLiveKitClient() {
        if (this.livekitClient) return;
        
        try {
            const module = await import('./livekitClient.js');
            const LiveKitClient = module.default;
            this.livekitClient = new LiveKitClient();
            console.log('[Listen] LiveKit client initialized');
        } catch (error) {
            console.error('[Listen] Failed to load LiveKit client:', error);
            throw error;
        }
    }

    updateUI(listening) {
        if (listening) {
            this.voiceIndicator.classList.add('active');
            this.voiceBtn.classList.add('active');
            this.voiceBtn.querySelector('.btn-text').textContent = 'Stop';
        } else {
            this.voiceIndicator.classList.remove('active');
            this.voiceBtn.classList.remove('active');
            this.voiceBtn.querySelector('.btn-text').textContent = 'Start Voice Chat';
        }
    }

    setAgentSpeaking(speaking) {
        if (speaking) {
            // Show agent is speaking with a typing indicator
            this.showTypingIndicator();
        } else {
            this.hideTypingIndicator();
        }
    }

    addMessage(type, text) {
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
        
        // Auto-scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        // Remove any existing typing indicator
        this.hideTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant thinking';
        typingDiv.id = 'typingIndicator';
        
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
        typingDiv.appendChild(contentDiv);
        this.messages.appendChild(typingDiv);
        
        // Auto-scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    clearMessages() {
        this.messages.innerHTML = '';
        this.addMessage('system', 'Chat cleared');
    }

    updateStatus(text) {
        this.statusText.textContent = text;
    }

    updateListeningStatus(isListening) {
        this.isListening = isListening;
        this.updateUI(isListening);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Listen] Initializing voice chat window...');
    window.listenWindow = new ListenWindow();
    
    // Add welcome message
    window.listenWindow.addMessage('system', 'Welcome to Voice Chat! Click "Start Voice Chat" to begin.');
});