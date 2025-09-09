// Using window.electronAPI from preload script since contextIsolation is enabled

class SettingsWindow {
    constructor() {
        console.log('[Settings] Settings window constructor called');
        this.settings = {};
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
    }

    initializeElements() {
        console.log('[Settings] Initializing elements...');

        this.closeBtn = document.getElementById('closeBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.quitBtn = document.getElementById('quitBtn');

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

        console.log('[Settings] Elements initialized:', {
            closeBtn: !!this.closeBtn,
            saveBtn: !!this.saveBtn,
            resetBtn: !!this.resetBtn,
            quitBtn: !!this.quitBtn,
            openaiKey: !!this.openaiKey,
            anthropicKey: !!this.anthropicKey,
            googleKey: !!this.googleKey,
            deepgramKey: !!this.deepgramKey
        });
    }

    setupEventListeners() {
        console.log('[Settings] Setting up event listeners...');

        this.closeBtn.addEventListener('click', () => {
            console.log('[Settings] Close button clicked');
            this.closeWindow();
        });

        this.saveBtn.addEventListener('click', () => {
            console.log('[Settings] Save button clicked');
            this.saveSettings();
        });

        this.resetBtn.addEventListener('click', () => {
            console.log('[Settings] Reset button clicked');
            this.resetSettings();
        });

        this.quitBtn.addEventListener('click', () => {
            console.log('[Settings] Quit button clicked');
            this.quitApplication();
        });

        // Toggle visibility for password fields
        this.toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Auto-save on input change
        const inputs = document.querySelectorAll('.setting-input, .setting-select, .setting-checkbox');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.markAsChanged());
        });

        console.log('[Settings] Event listeners setup complete');
    }

    setupIPCListeners() {
        console.log('[Settings] Setting up IPC listeners...');

        // Listen for settings updates from main process
        window.electronAPI.onSettingsUpdate((event, data) => {
            console.log('[Settings] Received settings update:', data);
            if (data && typeof data === 'object') {
                this.settings = { ...this.settings, ...data };
                this.populateSettings();
                this.showSuccess('Settings updated!');
            }
        });

        // Listen for API key updates
        window.electronAPI.onApiKeyUpdate((event, data) => {
            console.log('[Settings] Received API key update:', data);
            if (data && data.provider && data.key !== undefined) {
                this.settings[`${data.provider}Key`] = data.key;
                this.populateSettings();
            }
        });

        console.log('[Settings] IPC listeners setup complete');
    }

    async loadSettings() {
        try {
            console.log('[Settings] Loading settings...');
            const result = await window.electronAPI.getSettings();
            console.log('[Settings] Got settings result:', result);

            if (result && typeof result === 'object') {
                // Handle direct settings object or wrapped response
                this.settings = result.settings || result;
                this.populateSettings();
                console.log('[Settings] Settings loaded successfully');
            } else {
                console.error('[Settings] Failed to load settings: Invalid response format');
                this.showError('Failed to load settings: Invalid response format');
            }
        } catch (error) {
            console.error('[Settings] Error loading settings:', error);
            this.showError('Failed to load settings: ' + error.message);
        }
    }

    populateSettings() {
        console.log('[Settings] Populating settings form...');

        // API Keys
        this.openaiKey.value = this.settings.openaiApiKey || this.settings.openaiKey || '';
        this.anthropicKey.value = this.settings.anthropicApiKey || this.settings.anthropicKey || '';
        this.googleKey.value = this.settings.googleApiKey || this.settings.googleKey || '';
        this.deepgramKey.value = this.settings.deepgramApiKey || this.settings.deepgramKey || '';

        // Preferences
        this.defaultModel.value = this.settings.defaultModel || 'gpt-4';
        this.transcriptionLanguage.value = this.settings.transcriptionLanguage || 'en-US';
        this.autoStartListening.checked = this.settings.autoStartListening || false;
        this.showNotifications.checked = this.settings.showNotifications !== false; // Default true

        // Advanced
        this.apiTimeout.value = this.settings.apiTimeout || 30;
        this.maxRetries.value = this.settings.maxRetries || 3;
        this.enableLogging.checked = this.settings.enableLogging || false;

        console.log('[Settings] Settings populated successfully');
    }

    async saveSettings() {
        try {
            console.log('[Settings] Saving settings...');
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = 'Saving...';

            const settings = {
                // API Keys
                openaiApiKey: this.openaiKey.value.trim(),
                anthropicApiKey: this.anthropicKey.value.trim(),
                googleApiKey: this.googleKey.value.trim(),
                deepgramApiKey: this.deepgramKey.value.trim(),

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

            console.log('[Settings] Saving settings object:', Object.keys(settings));
            const result = await window.electronAPI.updateSettings(settings);
            console.log('[Settings] Save result:', result);

            if (result && result.success !== false) {
                this.showSuccess('Settings saved successfully!');
                this.settings = settings;
            } else {
                const errorMsg = result?.error || 'Unknown error';
                console.error('[Settings] Save failed:', errorMsg);
                this.showError('Failed to save settings: ' + errorMsg);
            }
        } catch (error) {
            console.error('[Settings] Error saving settings:', error);
            this.showError('Failed to save settings: ' + error.message);
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save Settings';
        }
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            try {
                console.log('[Settings] Resetting settings to defaults...');
                // Send empty object to reset settings
                const result = await window.electronAPI.updateSettings({});
                console.log('[Settings] Reset result:', result);

                if (result && result.success !== false) {
                    this.settings = {};
                    this.populateSettings();
                    this.showSuccess('Settings reset to defaults!');
                } else {
                    const errorMsg = result?.error || 'Unknown error';
                    console.error('[Settings] Reset failed:', errorMsg);
                    this.showError('Failed to reset settings: ' + errorMsg);
                }
            } catch (error) {
                console.error('[Settings] Error resetting settings:', error);
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
        console.log('[Settings] Closing settings window...');
        // Use the same pattern as other windows - send IPC message
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('window:requestVisibility', { name: 'settings', visible: false });
    }

    showSuccess(message) {
        console.log('[Settings] Showing success message:', message);
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
        console.error('[Settings] Showing error message:', message);
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

    async quitApplication() {
        console.log('[Settings] Quit application requested');
        try {
            // Ask for confirmation
            const confirmed = confirm('Are you sure you want to quit the application?');
            if (confirmed) {
                console.log('[Settings] Quitting application...');
                // Send quit request to main process
                const result = await window.electronAPI.quitApplication();
                console.log('[Settings] Quit result:', result);

                // Check if result indicates success or if it's just a response
                if (result && result.success === false) {
                    this.showError('Failed to quit application: ' + (result.error || 'Unknown error'));
                } else {
                    console.log('[Settings] Application quit initiated');
                }
            }
        } catch (error) {
            console.error('[Settings] Error quitting application:', error);
            this.showError('Error: ' + error.message);
        }
    }

    // Handle window events
    handleWindowFocus() {
        console.log('[Settings] Window focused');
        // Window gained focus
    }

    handleWindowBlur() {
        console.log('[Settings] Window blurred');
        // Window lost focus
    }

    handleWindowClose() {
        console.log('[Settings] Window closing, cleaning up...');
        // Clean up resources
        window.electronAPI.removeAllListeners('settings:update');
        window.electronAPI.removeAllListeners('settings:apikey:update');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Settings] DOM loaded, initializing SettingsWindow...');
    window.settingsWindow = new SettingsWindow();
    console.log('[Settings] SettingsWindow initialized successfully');
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