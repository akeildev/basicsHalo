const { ipcRenderer } = require('electron');

class AskWindow {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.selectedModel = 'gpt-4';
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.characterCount = document.getElementById('characterCount');
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.messageInput.addEventListener('input', () => this.handleInput());
        this.modelSelect.addEventListener('change', (e) => this.handleModelChange(e));
    }

    setupIPCListeners() {
        ipcRenderer.on('ask:response', (event, data) => {
            this.handleResponse(data);
        });

        ipcRenderer.on('ask:error', (event, error) => {
            this.handleError(error.message);
        });

        ipcRenderer.on('ask:stream', (event, data) => {
            this.handleStreamResponse(data);
        });
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleInput() {
        const text = this.messageInput.value;
        const length = text.length;
        
        // Update character count
        this.characterCount.textContent = `${length} / 4000`;
        
        // Update character count styling
        this.characterCount.className = 'character-count';
        if (length > 3500) {
            this.characterCount.classList.add('warning');
        }
        if (length > 4000) {
            this.characterCount.classList.add('error');
        }
        
        // Auto-resize textarea
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        
        // Enable/disable send button
        this.sendBtn.disabled = length === 0 || length > 4000 || this.isProcessing;
    }

    handleModelChange(e) {
        this.selectedModel = e.target.value;
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || this.isProcessing) return;

        // Add user message to chat
        this.addMessage('user', text);
        
        // Clear input
        this.messageInput.value = '';
        this.handleInput();
        
        // Show thinking indicator
        this.showThinkingIndicator();
        
        // Send to main process
        try {
            this.isProcessing = true;
            this.sendBtn.disabled = true;
            
            const result = await ipcRenderer.invoke('ask:prompt', {
                prompt: text,
                model: this.selectedModel
            });
            
            if (!result.success) {
                this.handleError(result.error);
            }
        } catch (error) {
            this.handleError('Failed to send message: ' + error.message);
        }
    }

    addMessage(type, text, timestamp = null) {
        const message = {
            type,
            text,
            timestamp: timestamp || new Date().toISOString()
        };
        
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    renderMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        this.messagesContainer.appendChild(messageEl);
    }

    showThinkingIndicator() {
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'message assistant thinking';
        thinkingEl.id = 'thinking-indicator';
        
        thinkingEl.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(thinkingEl);
        this.scrollToBottom();
    }

    removeThinkingIndicator() {
        const thinkingEl = document.getElementById('thinking-indicator');
        if (thinkingEl) {
            thinkingEl.remove();
        }
    }

    handleResponse(data) {
        this.removeThinkingIndicator();
        this.isProcessing = false;
        this.sendBtn.disabled = false;
        
        if (data.response) {
            this.addMessage('assistant', data.response, data.timestamp);
        }
    }

    handleStreamResponse(data) {
        this.removeThinkingIndicator();
        
        // Find or create the streaming message
        let streamEl = document.getElementById('streaming-message');
        if (!streamEl) {
            streamEl = document.createElement('div');
            streamEl.className = 'message assistant';
            streamEl.id = 'streaming-message';
            
            const time = new Date().toLocaleTimeString();
            streamEl.innerHTML = `
                <div class="message-content">
                    <div class="message-text"></div>
                    <div class="message-time">${time}</div>
                </div>
            `;
            
            this.messagesContainer.appendChild(streamEl);
        }
        
        // Update the streaming text
        const textEl = streamEl.querySelector('.message-text');
        textEl.textContent = data.text;
        
        this.scrollToBottom();
        
        // If streaming is complete, finalize the message
        if (data.complete) {
            streamEl.id = '';
            this.messages.push({
                type: 'assistant',
                text: data.text,
                timestamp: data.timestamp || new Date().toISOString()
            });
            this.isProcessing = false;
            this.sendBtn.disabled = false;
        }
    }

    handleError(message) {
        this.removeThinkingIndicator();
        this.isProcessing = false;
        this.sendBtn.disabled = false;
        
        this.addMessage('assistant', `Sorry, I encountered an error: ${message}`);
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Handle window events
    handleWindowFocus() {
        this.messageInput.focus();
    }

    handleWindowBlur() {
        // Window lost focus
    }

    handleWindowClose() {
        // Clean up resources
        ipcRenderer.removeAllListeners('ask:response');
        ipcRenderer.removeAllListeners('ask:error');
        ipcRenderer.removeAllListeners('ask:stream');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.askWindow = new AskWindow();
});

// Handle window events
window.addEventListener('focus', () => {
    if (window.askWindow) {
        window.askWindow.handleWindowFocus();
    }
});

window.addEventListener('blur', () => {
    if (window.askWindow) {
        window.askWindow.handleWindowBlur();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.askWindow) {
        window.askWindow.handleWindowClose();
    }
});
