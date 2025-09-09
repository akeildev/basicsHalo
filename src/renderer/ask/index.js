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
        this.responsePanel = document.getElementById('responsePanel');
        this.responseContent = document.getElementById('responseContent');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.characterCount = document.getElementById('characterCount');
        this.historyToggle = document.getElementById('historyToggle');
        this.resizeDebounce = null;
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.messageInput.addEventListener('input', () => this.handleInput());
        if (this.historyToggle) {
            this.historyToggle.addEventListener('click', () => this.toggleHistory());
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

    // Model selector removed; default handled in main

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || this.isProcessing) return;

        // Single-response UX: no chat list, just loading -> response

        // Clear input
        this.messageInput.value = '';
        this.handleInput();

        // Show thinking indicator
        this.showThinkingIndicator();

        // Send to main process
        try {
            this.isProcessing = true;
            this.sendBtn.disabled = true;

            // Always capture screenshot automatically
            console.log('[Ask] Auto-capturing screenshot for this message...');
            let screenshotData = null;

            try {
                const screenshotResult = await window.electronAPI.captureScreenshot({
                    quality: 80,
                    maxWidth: 1920,
                    maxHeight: 1080
                });

                if (screenshotResult && screenshotResult.success) {
                    screenshotData = screenshotResult.screenshot;
                    console.log('[Ask] Screenshot captured for message, length:', screenshotData.length);
                } else {
                    console.warn('[Ask] Screenshot capture failed:', screenshotResult?.error);
                }
            } catch (error) {
                console.warn('[Ask] Screenshot capture error:', error.message);
            }

            const result = await window.electronAPI.askQuestion(text, {
                model: this.selectedModel,
                includeScreenshot: true, // Always include screenshot
                screenshot: screenshotData,
                screenshotQuality: 80,
                screenshotWidth: 1920,
                screenshotHeight: 1080
            });

            console.log('[Ask] Got response from main process:', result);

            // Handle the response
            if (result && result.success && result.result && result.result.answer) {
                // Hide thinking indicator
                this.removeThinkingIndicator();

                // Render markdown in single response panel
                this.renderMarkdownResponse(result.result.answer);

                // Reset processing state
                this.isProcessing = false;
                this.sendBtn.disabled = false;
            } else if (result && result.success === false) {
                this.handleError(result.error);
            } else {
                console.error('[Ask] Invalid response structure:', result);
                this.handleError('Invalid response from AI service');
            }

        } catch (error) {
            console.error('[Ask] Error sending message:', error);
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
        // Create a lightweight loader under the input
        let loader = document.getElementById('thinking-indicator');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'thinking-indicator';
            loader.className = 'thinking-inline';
            loader.innerHTML = `
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
            this.responsePanel.style.display = 'none';
            this.messageInput.parentElement.parentElement.insertAdjacentElement('afterend', loader);
        }
        this.scheduleResize();
    }

    removeThinkingIndicator() {
        const thinkingEl = document.getElementById('thinking-indicator');
        if (thinkingEl) thinkingEl.remove();
        this.scheduleResize();
    }

    renderMarkdownResponse(text) {
        if (!this.responsePanel || !this.responseContent) return;

        // Escape
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Fenced code blocks
        html = html.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1.replace(/\n$/,'')}</code></pre>`);
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Headers
        html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
                   .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
                   .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
        // Bold/italics
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
        // Lists
        html = html.replace(/^(\-\s.+(?:\n\-\s.+)*)/gm, (m) => {
            const items = m.split(/\n/).map(i => i.replace(/^\-\s+/, '')).map(i => `<li>${i}</li>`).join('');
            return `<ul>${items}</ul>`;
        });
        // Paragraphs
        html = html.split(/\n\n+/).map(p => {
            if (/^\s*<h[1-3]>/.test(p) || /^\s*<ul>/.test(p) || /^\s*<pre>/.test(p)) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        this.responseContent.innerHTML = html;
        this.responsePanel.style.display = 'block';

        // Widen ask window slightly for readability
        try {
            if (window.electronAPI && window.electronAPI.getBounds && window.electronAPI.setBounds) {
                window.electronAPI.getBounds('ask').then(({ bounds }) => {
                    if (!bounds) return;
                    const targetWidth = Math.min(Math.max(360, bounds.width), 820);
                    if (targetWidth !== bounds.width) {
                        window.electronAPI.setBounds('ask', { x: bounds.x, y: bounds.y, width: targetWidth, height: bounds.height });
                    }
                }).catch(() => {});
            }
        } catch {}

        this.scheduleResize();
    }

    scheduleResize() {
        if (this.resizeDebounce) cancelAnimationFrame(this.resizeDebounce);
        this.resizeDebounce = requestAnimationFrame(() => this.resizeToContent());
    }

    resizeToContent() {
        try {
            if (!window.electronAPI || !window.electronAPI.getBounds || !window.electronAPI.setBounds) return;
            window.electronAPI.getBounds('ask').then(({ bounds }) => {
                if (!bounds) return;

                // Calculate needed height: input container + loader + responsePanel
                const inputContainer = this.messageInput.parentElement.parentElement;
                const loader = document.getElementById('thinking-indicator');
                let desiredHeight = 0;
                const margin = 10 + 10; // ask-container vertical padding

                desiredHeight += inputContainer.getBoundingClientRect().height;
                if (loader) desiredHeight += loader.getBoundingClientRect().height + 8;
                if (this.responsePanel && this.responsePanel.style.display !== 'none') {
                    desiredHeight += Math.min(this.responsePanel.scrollHeight, window.innerHeight * 0.6) + 10;
                }
                desiredHeight += margin;

                // Initial collapsed height should be just input
                const minHeight = Math.max(120, Math.ceil(inputContainer.getBoundingClientRect().height + margin));
                const maxHeight = Math.min(820, Math.max(minHeight, Math.ceil(desiredHeight)));

                const targetHeight = Math.max(minHeight, Math.min(maxHeight, desiredHeight));

                if (Math.abs(targetHeight - bounds.height) > 6) {
                    // Smooth-ish step
                    const step = Math.round(bounds.height + (targetHeight - bounds.height) * 0.35);
                    window.electronAPI.setBounds('ask', { x: bounds.x, y: bounds.y, width: bounds.width, height: step });
                }
            }).catch(() => {});
        } catch {}
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
        // Render streaming text into response panel
        this.renderMarkdownResponse(data.text || '');
        this.isProcessing = !data.complete;
        if (data.complete) this.sendBtn.disabled = false;
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

    async showScreenshotPreview() {
        console.log('[Ask] showScreenshotPreview() called');

        try {
            // Add visual feedback
            if (this.screenshotBtn) {
                this.screenshotBtn.classList.add('previewing');
                this.screenshotBtn.disabled = true;
            }

            // Capture screenshot for preview
            const result = await window.electronAPI.captureScreenshot({
                quality: 60, // Lower quality for preview
                maxWidth: 800,
                maxHeight: 600
            });

            console.log('[Ask] Preview screenshot result:', result);

            if (result && result.success) {
                // Show preview in a modal or overlay
                this.showScreenshotModal(result.screenshot);
                this.addMessage('system', '📸 Preview: Screenshot will be automatically captured with your next message.');
            } else {
                console.error('[Ask] Failed to capture preview:', result.error);
                this.handleError(result.error || 'Failed to capture screenshot preview');
            }
        } catch (error) {
            console.error('[Ask] Error showing screenshot preview:', error);
            this.handleError('Failed to show screenshot preview: ' + error.message);
        } finally {
            // Remove visual feedback
            if (this.screenshotBtn) {
                this.screenshotBtn.classList.remove('previewing');
                this.screenshotBtn.disabled = false;
            }
        }
    }

    showScreenshotModal(screenshotData) {
        console.log('[Ask] showScreenshotModal() called');

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'screenshot-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Screenshot Preview</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <img src="data:image/png;base64,${screenshotData}" alt="Screenshot Preview" class="preview-image">
                    <p class="preview-note">This screenshot will be automatically included with your next message to the AI.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary modal-cancel">Cancel</button>
                    <button class="btn primary modal-confirm">OK, I understand</button>
                </div>
            </div>
        `;

        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        const confirmBtn = modal.querySelector('.modal-confirm');

        const closeModal = () => {
            modal.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', closeModal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Add to document
        document.body.appendChild(modal);
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
