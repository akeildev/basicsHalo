// Using window.electronAPI from preload script since contextIsolation is enabled

class ListenWindow {
    constructor() {
        this.isListening = false;
        this.transcriptHistory = [];
        this.audioVisualizer = null;
        this.mediaCapture = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        this.initializeAudioVisualizer();
        this.initializeMediaCapture();
    }

    initializeElements() {
        this.startStopBtn = document.getElementById('startStopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusDot = this.statusIndicator.querySelector('.status-dot');
        this.statusText = this.statusIndicator.querySelector('.status-text');
        this.transcriptText = document.getElementById('transcriptText');
        this.timestamp = document.getElementById('timestamp');
        this.confidence = document.getElementById('confidence');
        this.visualizerBars = document.querySelectorAll('.bar');
    }

    setupEventListeners() {
        this.startStopBtn.addEventListener('click', () => this.toggleListening());
        this.clearBtn.addEventListener('click', () => this.clearTranscript());
    }

    setupIPCListeners() {
        ipcRenderer.on('listen:status', (event, data) => {
            this.updateListeningStatus(data.isListening);
        });

        ipcRenderer.on('listen:transcript', (event, data) => {
            this.updateTranscript(data.text, data.confidence, data.timestamp);
        });

        ipcRenderer.on('listen:error', (event, error) => {
            this.showError(error.message);
        });

        ipcRenderer.on('listen:audioLevel', (event, level) => {
            this.updateAudioVisualizer(level);
        });
    }

    initializeAudioVisualizer() {
        // Initialize visualizer bars
        this.visualizerBars.forEach((bar, index) => {
            bar.style.height = '8px';
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
            this.showError('Failed to toggle listening: ' + error.message);
        }
    }

    async startListening() {
        try {
            console.log('[Listen] Starting listening...');
            
            // Start main process listening (system audio)
            const result = await window.electronAPI.startListening();
            console.log('[Listen] Start result:', result);
            
            if (result.success) {
                this.updateListeningStatus(true);
                
                // Also start media capture in renderer (microphone)
                await this.startMediaCapture();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('[Listen] Start error:', error);
            this.showError('Failed to start listening: ' + error.message);
        }
    }

    async stopListening() {
        try {
            console.log('[Listen] Stopping listening...');
            
            // Stop media capture in renderer
            await this.stopMediaCapture();
            
            // Stop main process listening
            const result = await window.electronAPI.stopListening();
            console.log('[Listen] Stop result:', result);
            
            if (result.success) {
                this.updateListeningStatus(false);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('[Listen] Stop error:', error);
            this.showError('Failed to stop listening: ' + error.message);
        }
    }

    clearTranscript() {
        this.transcriptText.textContent = '';
        this.transcriptHistory = [];
        this.updateTimestamp('');
        this.updateConfidence(0);
    }

    updateListeningStatus(isListening) {
        this.isListening = isListening;
        
        if (isListening) {
            this.startStopBtn.classList.add('active');
            this.startStopBtn.querySelector('.btn-text').textContent = 'Stop Listening';
            this.statusDot.classList.add('listening');
            this.statusText.textContent = 'Listening...';
        } else {
            this.startStopBtn.classList.remove('active');
            this.startStopBtn.querySelector('.btn-text').textContent = 'Start Listening';
            this.statusDot.classList.remove('listening');
            this.statusText.textContent = 'Ready';
        }
    }

    updateTranscript(text, confidence = 1, timestamp = null) {
        if (text) {
            this.transcriptText.textContent = text;
            this.transcriptHistory.push({
                text,
                confidence,
                timestamp: timestamp || new Date().toISOString()
            });
            
            this.updateTimestamp(timestamp);
            this.updateConfidence(confidence);
            
            // Auto-scroll to bottom
            const container = this.transcriptText.parentElement.parentElement;
            container.scrollTop = container.scrollHeight;
        }
    }

    updateTimestamp(timestamp) {
        if (timestamp) {
            const date = new Date(timestamp);
            this.timestamp.textContent = date.toLocaleTimeString();
        } else {
            this.timestamp.textContent = '';
        }
    }

    updateConfidence(confidence) {
        if (confidence > 0) {
            const percentage = Math.round(confidence * 100);
            this.confidence.innerHTML = `
                <span>Confidence: ${percentage}%</span>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${percentage}%"></div>
                </div>
            `;
        } else {
            this.confidence.innerHTML = '';
        }
    }

    updateAudioVisualizer(level) {
        if (!this.isListening) return;
        
        // Update visualizer bars based on audio level
        this.visualizerBars.forEach((bar, index) => {
            const threshold = (index + 1) / this.visualizerBars.length;
            if (level > threshold) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    showError(message) {
        this.statusDot.classList.add('error');
        this.statusText.textContent = 'Error';
        console.error('Listen Window Error:', message);
        
        // Show error in transcript
        this.transcriptText.textContent = `Error: ${message}`;
        
        // Reset status after 3 seconds
        setTimeout(() => {
            this.statusDot.classList.remove('error');
            this.statusText.textContent = 'Ready';
        }, 3000);
    }

    // Handle window events
    handleWindowFocus() {
        // Window gained focus
    }

    handleWindowBlur() {
        // Window lost focus
    }

    initializeMediaCapture() {
        // Dynamically import the media capture module
        import('./mediaCaptureRenderer.js').then(module => {
            const MediaCaptureRenderer = module.default || module;
            this.mediaCapture = new MediaCaptureRenderer();
            console.log('[Listen] Media capture initialized');
        }).catch(error => {
            console.error('[Listen] Failed to initialize media capture:', error);
        });
    }

    async startMediaCapture() {
        if (!this.mediaCapture) {
            console.warn('[Listen] Media capture not initialized');
            return;
        }

        try {
            // Start microphone capture in renderer
            const micResult = await this.mediaCapture.startMicrophoneCapture();
            if (micResult.success) {
                console.log('[Listen] Microphone capture started in renderer');
            }
            
            // Optionally start screen capture
            // const screenResult = await this.mediaCapture.startScreenCapture();
            
        } catch (error) {
            console.error('[Listen] Error starting media capture:', error);
        }
    }

    async stopMediaCapture() {
        if (!this.mediaCapture) return;

        try {
            this.mediaCapture.stopMicrophoneCapture();
            this.mediaCapture.stopScreenCapture();
            console.log('[Listen] Media capture stopped');
        } catch (error) {
            console.error('[Listen] Error stopping media capture:', error);
        }
    }

    handleWindowClose() {
        // Clean up resources
        if (this.mediaCapture) {
            this.mediaCapture.cleanup();
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.listenWindow = new ListenWindow();
});

// Handle window events
window.addEventListener('focus', () => {
    if (window.listenWindow) {
        window.listenWindow.handleWindowFocus();
    }
});

window.addEventListener('blur', () => {
    if (window.listenWindow) {
        window.listenWindow.handleWindowBlur();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.listenWindow) {
        window.listenWindow.handleWindowClose();
    }
});
