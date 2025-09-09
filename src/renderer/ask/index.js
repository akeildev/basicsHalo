// Using window.electronAPI from preload script since contextIsolation is enabled

class AskWindow {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.selectedModel = 'gpt-4';
        this.currentScreenshot = null;
        this.initializeElements();
        this.setupEventListeners();
        // Note: IPC listeners are not needed with the preload API
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.characterCount = document.getElementById('characterCount');
        
        // Screenshot elements
        this.screenshotBtn = document.getElementById('screenshotBtn');
        this.screenshotPreview = document.getElementById('screenshotPreview');
        this.screenshotImage = document.getElementById('screenshotImage');
        this.removeScreenshotBtn = document.getElementById('removeScreenshot');
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.messageInput.addEventListener('input', () => this.handleInput());
        this.modelSelect.addEventListener('change', (e) => this.handleModelChange(e));
        
        // Screenshot button
        if (this.screenshotBtn) {
            console.log('[Ask] Screenshot button found, adding click listener');
            this.screenshotBtn.addEventListener('click', () => {
                console.log('[Ask] Screenshot button clicked!');
                this.captureScreenshot();
            });
        } else {
            console.error('[Ask] Screenshot button not found!');
        }
        
        // Remove screenshot button
        if (this.removeScreenshotBtn) {
            this.removeScreenshotBtn.addEventListener('click', () => this.removeScreenshot());
        }
    }

    // IPC listeners are not needed with the preload API
    // Responses are handled directly through the promise returned by askQuestion

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
            
            const result = await window.electronAPI.askQuestion(text, {
                model: this.selectedModel,
                includeScreenshot: !!this.currentScreenshot,
                screenshot: this.currentScreenshot
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

    async captureScreenshot() {
        console.log('[Ask] captureScreenshot() called');
        console.log('[Ask] Starting screenshot capture...');
        
        try {
            // Add visual feedback
            if (this.screenshotBtn) {
                this.screenshotBtn.classList.add('capturing');
                this.screenshotBtn.disabled = true;
            }
            
            // Capture screenshot using preload API
            const result = await window.electronAPI.captureScreenshot({
                quality: 80,
                maxWidth: 1920,
                maxHeight: 1080
            });
            
            console.log('[Ask] Screenshot result:', result);
            
            if (result && result.success) {
                console.log('[Ask] Screenshot captured successfully');
                console.log('[Ask] Screenshot data length:', result.screenshot ? result.screenshot.length : 0);
                this.displayScreenshot(result.screenshot);
                this.addMessage('system', '📸 Screenshot captured! You can now ask questions about what\'s on your screen.');
            } else {
                console.error('[Ask] Failed to capture screenshot:', result.error);
                this.handleError(result.error || 'Failed to capture screenshot');
            }
        } catch (error) {
            console.error('[Ask] Error capturing screenshot:', error);
            this.handleError('Failed to capture screenshot: ' + error.message);
        } finally {
            // Remove visual feedback
            if (this.screenshotBtn) {
                this.screenshotBtn.classList.remove('capturing');
                this.screenshotBtn.disabled = false;
            }
        }
    }

    displayScreenshot(screenshotData) {
        console.log('[Ask] displayScreenshot() called');
        console.log('[Ask] Screenshot data type:', typeof screenshotData);
        console.log('[Ask] Screenshot data length:', screenshotData ? screenshotData.length : 0);
        
        if (!screenshotData) {
            console.error('[Ask] No screenshot data to display');
            return;
        }
        
        this.currentScreenshot = screenshotData;
        
        // Show preview
        if (this.screenshotPreview && this.screenshotImage) {
            // Convert base64 to image URL if needed
            const imageUrl = screenshotData.startsWith('data:') 
                ? screenshotData 
                : `data:image/png;base64,${screenshotData}`;
            
            this.screenshotImage.src = imageUrl;
            this.screenshotPreview.style.display = 'block';
        }
    }

    removeScreenshot() {
        console.log('[Ask] Removing screenshot...');
        
        this.currentScreenshot = null;
        
        if (this.screenshotPreview) {
            this.screenshotPreview.style.display = 'none';
        }
        
        if (this.screenshotImage) {
            this.screenshotImage.src = '';
        }
    }

    handleWindowClose() {
        // Clean up resources
        // No listeners to clean up when using preload API
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
