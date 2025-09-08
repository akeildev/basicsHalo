// Use the electronAPI exposed by the preload script
console.log('[Header] Starting script execution...');
console.log('[Header] Available APIs:', typeof window.electronAPI);

class HeaderWindow {
    constructor() {
        console.log('[HeaderWindow] Constructor called');
        this.isListening = false;
        this.isAsking = false;
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        console.log('[HeaderWindow] Constructor completed');
    }

    initializeElements() {
        console.log('[Header] Initializing elements...');
        this.listenBtn = document.getElementById('listenBtn');
        this.askBtn = document.getElementById('askBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusDot = this.statusIndicator?.querySelector('.status-dot');
        this.statusText = this.statusIndicator?.querySelector('.status-text');
        this.transcriptPreview = document.getElementById('transcriptPreview');
        this.transcriptText = document.getElementById('transcriptText');
        
        console.log('[Header] Elements found:', {
            listenBtn: !!this.listenBtn,
            askBtn: !!this.askBtn,
            settingsBtn: !!this.settingsBtn,
            statusIndicator: !!this.statusIndicator,
            statusDot: !!this.statusDot,
            statusText: !!this.statusText
        });
    }

    setupEventListeners() {
        console.log('[Header] Setting up event listeners...');
        
        if (this.listenBtn) {
            this.listenBtn.addEventListener('click', () => {
                console.log('[Header] Listen button clicked!');
                this.openListenWindow();
            });
            console.log('[Header] Listen button event listener added');
        } else {
            console.error('[Header] Listen button not found!');
        }
        
        if (this.askBtn) {
            this.askBtn.addEventListener('click', () => {
                console.log('[Header] Ask button clicked!');
                this.openAskWindow();
            });
            console.log('[Header] Ask button event listener added');
        } else {
            console.error('[Header] Ask button not found!');
        }
        
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                console.log('[Header] Settings button clicked!');
                this.openSettingsWindow();
            });
            console.log('[Header] Settings button event listener added');
        } else {
            console.error('[Header] Settings button not found!');
        }
    }

    setupIPCListeners() {
        console.log('[Header] Setting up IPC listeners...');
        
        if (!window.electronAPI) {
            console.error('[Header] electronAPI not available! Cannot set up IPC listeners.');
            return;
        }
        
        // Listen for status updates from main process
        window.electronAPI.on('listen:status', (event, data) => {
            console.log('[Header] Received listen:status:', data);
            this.updateListeningStatus(data.isListening);
        });

        window.electronAPI.on('listen:transcript', (event, data) => {
            console.log('[Header] Received listen:transcript:', data);
            this.updateTranscript(data.text);
        });

        window.electronAPI.on('listen:error', (event, error) => {
            console.log('[Header] Received listen:error:', error);
            this.showError(error.message);
        });

        window.electronAPI.on('ask:status', (event, data) => {
            console.log('[Header] Received ask:status:', data);
            this.updateAskingStatus(data.isAsking);
        });

        window.electronAPI.on('app:ready', () => {
            console.log('[Header] Received app:ready');
            this.setStatus('ready', 'Ready');
        });
        
        console.log('[Header] IPC listeners set up successfully');
    }

    async toggleListening() {
        console.log('[Header] Toggling listening state from:', this.isListening);
        try {
            if (this.isListening) {
                await this.stopListening();
            } else {
                await this.startListening();
            }
        } catch (error) {
            console.error('[Header] Error toggling listening:', error);
            this.showError('Failed to toggle listening: ' + error.message);
        }
    }

    async startListening() {
        console.log('[Header] Starting listening...');
        try {
            if (!window.electronAPI) {
                throw new Error('electronAPI not available');
            }
            const result = await window.electronAPI.startListening();
            console.log('[Header] Start listening result:', result);
            if (result?.success) {
                this.updateListeningStatus(true);
            } else {
                this.showError(result?.error || 'Failed to start listening');
            }
        } catch (error) {
            console.error('[Header] Error starting listening:', error);
            this.showError('Failed to start listening: ' + error.message);
        }
    }

    async stopListening() {
        console.log('[Header] Stopping listening...');
        try {
            if (!window.electronAPI) {
                throw new Error('electronAPI not available');
            }
            const result = await window.electronAPI.stopListening();
            console.log('[Header] Stop listening result:', result);
            if (result?.success) {
                this.updateListeningStatus(false);
            } else {
                this.showError(result?.error || 'Failed to stop listening');
            }
        } catch (error) {
            console.error('[Header] Error stopping listening:', error);
            this.showError('Failed to stop listening: ' + error.message);
        }
    }

    async openListenWindow() {
        console.log('[Header] Opening Listen window...');
        try {
            if (!window.electronAPI) {
                throw new Error('electronAPI not available');
            }
            const result = await window.electronAPI.requestWindowVisibility({ name: 'listen', visible: true });
            console.log('[Header] Listen window result:', result);
            if (!result?.success) {
                this.showError('Failed to open Listen window: ' + (result?.error || 'Unknown error'));
            } else {
                console.log('[Header] Listen window opened successfully');
            }
        } catch (error) {
            console.error('[Header] Error opening Listen window:', error);
            this.showError('Failed to open Listen window: ' + error.message);
        }
    }

    async openAskWindow() {
        console.log('[Header] Opening Ask window...');
        try {
            if (!window.electronAPI) {
                throw new Error('electronAPI not available');
            }
            const result = await window.electronAPI.requestWindowVisibility({ name: 'ask', visible: true });
            console.log('[Header] Ask window result:', result);
            if (!result?.success) {
                this.showError('Failed to open Ask window: ' + (result?.error || 'Unknown error'));
            } else {
                console.log('[Header] Ask window opened successfully');
            }
        } catch (error) {
            console.error('[Header] Error opening Ask window:', error);
            this.showError('Failed to open Ask window: ' + error.message);
        }
    }

    async openSettingsWindow() {
        console.log('[Header] Opening Settings window...');
        try {
            if (!window.electronAPI) {
                throw new Error('electronAPI not available');
            }
            const result = await window.electronAPI.requestWindowVisibility({ name: 'settings', visible: true });
            console.log('[Header] Settings window result:', result);
            if (!result?.success) {
                this.showError('Failed to open Settings window: ' + (result?.error || 'Unknown error'));
            } else {
                console.log('[Header] Settings window opened successfully');
            }
        } catch (error) {
            console.error('[Header] Error opening Settings window:', error);
            this.showError('Failed to open Settings window: ' + error.message);
        }
    }

    updateListeningStatus(isListening) {
        console.log('[Header] Updating listening status to:', isListening);
        this.isListening = isListening;
        
        if (this.listenBtn) {
            if (isListening) {
                this.listenBtn.classList.add('active');
                this.setStatus('listening', 'Listening...');
            } else {
                this.listenBtn.classList.remove('active');
                this.setStatus('ready', 'Ready');
            }
        }
    }

    updateAskingStatus(isAsking) {
        console.log('[Header] Updating asking status to:', isAsking);
        this.isAsking = isAsking;
        
        if (this.askBtn) {
            if (isAsking) {
                this.askBtn.classList.add('active');
            } else {
                this.askBtn.classList.remove('active');
            }
        }
    }

    updateTranscript(text) {
        console.log('[Header] Updating transcript:', text);
        if (text && this.transcriptText) {
            this.transcriptText.textContent = text;
            if (this.transcriptPreview) {
                this.transcriptPreview.scrollTop = this.transcriptPreview.scrollHeight;
            }
        }
    }

    setStatus(type, text) {
        console.log('[Header] Setting status:', type, text);
        if (this.statusDot) {
            this.statusDot.className = `status-dot ${type}`;
        }
        if (this.statusText) {
            this.statusText.textContent = text;
        }
    }

    showError(message) {
        console.error('[Header] Showing error:', message);
        this.setStatus('error', 'Error');
        
        // Show error in transcript preview
        if (this.transcriptText) {
            this.transcriptText.textContent = `Error: ${message}`;
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
            this.setStatus('ready', 'Ready');
        }, 3000);
    }

    // Handle window events
    handleWindowFocus() {
        console.log('[Header] Window focused');
    }

    handleWindowBlur() {
        console.log('[Header] Window blurred');
    }

    handleWindowClose() {
        console.log('[Header] Window closing, cleaning up...');
        // Clean up resources
        if (window.electronAPI) {
            window.electronAPI.removeAllListeners('listen:status');
            window.electronAPI.removeAllListeners('listen:transcript');
            window.electronAPI.removeAllListeners('listen:error');
            window.electronAPI.removeAllListeners('ask:status');
            window.electronAPI.removeAllListeners('app:ready');
        }
    }
}

// Initialize when DOM is loaded
console.log('[Header] Script loaded, waiting for DOM...');

// Check if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Header] DOM loaded via event listener');
        initializeHeaderWindow();
    });
} else {
    console.log('[Header] DOM already loaded');
    initializeHeaderWindow();
}

function initializeHeaderWindow() {
    console.log('[Header] Initializing HeaderWindow...');
    console.log('[Header] electronAPI available:', !!window.electronAPI);
    
    if (!window.electronAPI) {
        console.error('[Header] CRITICAL: electronAPI not available! Preload script may have failed.');
        // Try again after a short delay
        setTimeout(() => {
            console.log('[Header] Retrying after delay...');
            console.log('[Header] electronAPI now available:', !!window.electronAPI);
            if (window.electronAPI) {
                createHeaderWindow();
            } else {
                console.error('[Header] electronAPI still not available after retry');
            }
        }, 100);
    } else {
        createHeaderWindow();
    }
}

function createHeaderWindow() {
    try {
        window.headerWindow = new HeaderWindow();
        console.log('[Header] HeaderWindow initialized successfully');
    } catch (error) {
        console.error('[Header] Error initializing HeaderWindow:', error);
    }
}

// Handle window events
window.addEventListener('focus', () => {
    if (window.headerWindow) {
        window.headerWindow.handleWindowFocus();
    }
});

window.addEventListener('blur', () => {
    if (window.headerWindow) {
        window.headerWindow.handleWindowBlur();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.headerWindow) {
        window.headerWindow.handleWindowClose();
    }
});

// Debug: Log when script finishes loading
console.log('[Header] Script execution completed');