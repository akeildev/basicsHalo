const { ipcRenderer } = require('electron');

class SettingsWindow {
    constructor() {
        this.settings = {};
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
    }

    initializeElements() {
        this.closeBtn = document.getElementById('closeBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // API Keys
        this.openaiKey = document.getElementById('openaiKey');
        this.anthropicKey = document.getElementById('anthropicKey');
        this.googleKey = document.getElementById('googleKey');
        this.deepgramKey = document.getElementById('deepgramKey');
        
        // Preferences
        this.defaultModel = document.getElementById('defaultModel');
        this.transcriptionLanguage = document.getElementById('transcriptionLanguage');
        this.autoStartListening = document.getElementById('autoStartListening');
        this.showNotifications = document.getElementById('showNotifications');
        
        // Advanced
        this.apiTimeout = document.getElementById('apiTimeout');
        this.maxRetries = document.getElementById('maxRetries');
        this.enableLogging = document.getElementById('enableLogging');
        
        // Toggle visibility buttons
        this.toggleButtons = document.querySelectorAll('.toggle-visibility');
    }

    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => this.closeWindow());
        this.saveBtn.addEventListener('click', () => this.saveSettings());
        this.resetBtn.addEventListener('click', () => this.resetSettings());
        
        // Toggle visibility for password fields
        this.toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });
        
        // Auto-save on input change
        const inputs = document.querySelectorAll('.setting-input, .setting-select, .setting-checkbox');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.markAsChanged());
        });
    }

    setupIPCListeners() {
        ipcRenderer.on('settings:loaded', (event, settings) => {
            this.settings = settings;
            this.populateSettings();
        });

        ipcRenderer.on('settings:saved', (event, success) => {
            if (success) {
                this.showSuccess('Settings saved successfully!');
            } else {
                this.showError('Failed to save settings');
            }
        });

        ipcRenderer.on('settings:error', (event, error) => {
            this.showError('Settings error: ' + error.message);
        });
    }

    async loadSettings() {
        try {
            const result = await ipcRenderer.invoke('settings:get');
            if (result.success) {
                this.settings = result.settings;
                this.populateSettings();
            } else {
                this.showError('Failed to load settings: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to load settings: ' + error.message);
        }
    }

    populateSettings() {
        // API Keys
        this.openaiKey.value = this.settings.openaiKey || '';
        this.anthropicKey.value = this.settings.anthropicKey || '';
        this.googleKey.value = this.settings.googleKey || '';
        this.deepgramKey.value = this.settings.deepgramKey || '';
        
        // Preferences
        this.defaultModel.value = this.settings.defaultModel || 'gpt-4';
        this.transcriptionLanguage.value = this.settings.transcriptionLanguage || 'en-US';
        this.autoStartListening.checked = this.settings.autoStartListening || false;
        this.showNotifications.checked = this.settings.showNotifications || true;
        
        // Advanced
        this.apiTimeout.value = this.settings.apiTimeout || 30;
        this.maxRetries.value = this.settings.maxRetries || 3;
        this.enableLogging.checked = this.settings.enableLogging || false;
    }

    async saveSettings() {
        try {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = 'Saving...';
            
            const settings = {
                // API Keys
                openaiKey: this.openaiKey.value.trim(),
                anthropicKey: this.anthropicKey.value.trim(),
                googleKey: this.googleKey.value.trim(),
                deepgramKey: this.deepgramKey.value.trim(),
                
                // Preferences
                defaultModel: this.defaultModel.value,
                transcriptionLanguage: this.transcriptionLanguage.value,
                autoStartListening: this.autoStartListening.checked,
                showNotifications: this.showNotifications.checked,
                
                // Advanced
                apiTimeout: parseInt(this.apiTimeout.value) || 30,
                maxRetries: parseInt(this.maxRetries.value) || 3,
                enableLogging: this.enableLogging.checked
            };
            
            const result = await ipcRenderer.invoke('settings:update', settings);
            if (result.success) {
                this.showSuccess('Settings saved successfully!');
                this.settings = settings;
            } else {
                this.showError('Failed to save settings: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to save settings: ' + error.message);
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save Settings';
        }
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            try {
                const result = await ipcRenderer.invoke('settings:reset');
                if (result.success) {
                    this.settings = {};
                    this.populateSettings();
                    this.showSuccess('Settings reset to defaults!');
                } else {
                    this.showError('Failed to reset settings: ' + result.error);
                }
            } catch (error) {
                this.showError('Failed to reset settings: ' + error.message);
            }
        }
    }

    togglePasswordVisibility(e) {
        const button = e.currentTarget;
        const targetId = button.getAttribute('data-target');
        const input = document.getElementById(targetId);
        
        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                </svg>
            `;
        } else {
            input.type = 'password';
            button.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
            `;
        }
    }

    markAsChanged() {
        this.saveBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    }

    closeWindow() {
        ipcRenderer.send('window:requestVisibility', { name: 'settings', visible: false });
    }

    showSuccess(message) {
        // Create temporary success message
        const successEl = document.createElement('div');
        successEl.className = 'success-message';
        successEl.textContent = message;
        successEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4ade80, #22c55e);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(successEl);
        
        setTimeout(() => {
            successEl.remove();
        }, 3000);
    }

    showError(message) {
        // Create temporary error message
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        errorEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(errorEl);
        
        setTimeout(() => {
            errorEl.remove();
        }, 5000);
    }

    // Handle window events
    handleWindowFocus() {
        // Window gained focus
    }

    handleWindowBlur() {
        // Window lost focus
    }

    handleWindowClose() {
        // Clean up resources
        ipcRenderer.removeAllListeners('settings:loaded');
        ipcRenderer.removeAllListeners('settings:saved');
        ipcRenderer.removeAllListeners('settings:error');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.settingsWindow = new SettingsWindow();
});

// Handle window events
window.addEventListener('focus', () => {
    if (window.settingsWindow) {
        window.settingsWindow.handleWindowFocus();
    }
});

window.addEventListener('blur', () => {
    if (window.settingsWindow) {
        window.settingsWindow.handleWindowBlur();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.settingsWindow) {
        window.settingsWindow.handleWindowClose();
    }
});
