const Store = require('electron-store');
const encryptionService = require('./EncryptionService');

/**
 * SettingsService - Manages user preferences and API keys using Electron Store
 * Provides persistent storage with optional encryption for sensitive data
 */
class SettingsService {
    constructor() {
        this.store = null;
        this.userId = null;
        this.encryptionReady = false;
    }

    /**
     * Initialize the settings service for a user
     * @param {string} userId - The user ID
     */
    async initialize(userId = 'default') {
        this.userId = userId;
        
        // Initialize encryption service
        try {
            await encryptionService.initialize(userId);
            this.encryptionReady = true;
            console.log('[SettingsService] Encryption initialized');
        } catch (error) {
            console.error('[SettingsService] Failed to initialize encryption:', error);
            this.encryptionReady = false;
        }
        
        // Create store with user-specific name
        this.store = new Store({
            name: `settings-${userId}`,
            defaults: this.getDefaults(),
            schema: this.getSchema(),
            watch: true // Enable file watching for external changes
        });
        
        console.log('[SettingsService] Initialized for user:', userId);
    }

    /**
     * Get default settings
     */
    getDefaults() {
        return {
            // User Preferences
            theme: 'system',
            language: 'en',
            
            // Window Preferences
            alwaysOnTop: false,
            startWithSystem: false,
            minimizeToTray: true,
            
            // Audio Settings
            inputDevice: 'default',
            outputDevice: 'default',
            pushToTalk: false,
            pushToTalkKey: 'Space',
            
            // Transcription Settings
            transcriptionLanguage: 'en',
            transcriptionProvider: 'deepgram',
            showTranscriptionPreview: true,
            
            // AI Settings
            defaultModel: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000,
            streamResponses: true,
            
            // API Keys (encrypted)
            apiKeys: {
                openai: '',
                anthropic: '',
                deepgram: '',
                assemblyai: '',
                custom: ''
            },
            
            // Shortcuts
            shortcuts: {
                toggleListen: 'CommandOrControl+Shift+L',
                toggleAsk: 'CommandOrControl+Shift+A',
                toggleSettings: 'CommandOrControl+,',
                quit: 'CommandOrControl+Q'
            },
            
            // Privacy
            telemetryEnabled: false,
            crashReportsEnabled: true,
            
            // Advanced
            debugMode: false,
            experimentalFeatures: false
        };
    }

    /**
     * Get settings schema for validation
     */
    getSchema() {
        return {
            theme: {
                type: 'string',
                enum: ['light', 'dark', 'system']
            },
            language: {
                type: 'string',
                pattern: '^[a-z]{2}(-[A-Z]{2})?$'
            },
            alwaysOnTop: {
                type: 'boolean'
            },
            startWithSystem: {
                type: 'boolean'
            },
            minimizeToTray: {
                type: 'boolean'
            },
            defaultModel: {
                type: 'string'
            },
            temperature: {
                type: 'number',
                minimum: 0,
                maximum: 2
            },
            maxTokens: {
                type: 'integer',
                minimum: 1,
                maximum: 32000
            },
            debugMode: {
                type: 'boolean'
            }
        };
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key (supports dot notation)
     * @param {*} defaultValue - Default value if key doesn't exist
     */
    get(key, defaultValue = undefined) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return defaultValue;
        }

        const value = this.store.get(key, defaultValue);
        
        // Decrypt if it's an API key
        if (key.startsWith('apiKeys.') && value && this.encryptionReady) {
            try {
                if (encryptionService.looksEncrypted(value)) {
                    return encryptionService.decrypt(value);
                }
            } catch (error) {
                console.error('[SettingsService] Failed to decrypt value:', error);
            }
        }
        
        return value;
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key (supports dot notation)
     * @param {*} value - Value to set
     */
    set(key, value) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return;
        }

        // Encrypt if it's an API key
        if (key.startsWith('apiKeys.') && value && this.encryptionReady) {
            try {
                if (!encryptionService.looksEncrypted(value)) {
                    value = encryptionService.encrypt(value);
                }
            } catch (error) {
                console.error('[SettingsService] Failed to encrypt value:', error);
            }
        }
        
        this.store.set(key, value);
    }

    /**
     * Get all settings
     */
    getAll() {
        if (!this.store) {
            return this.getDefaults();
        }
        
        const settings = this.store.store;
        
        // Decrypt API keys
        if (settings.apiKeys && this.encryptionReady) {
            const decryptedKeys = {};
            for (const [provider, key] of Object.entries(settings.apiKeys)) {
                if (key && encryptionService.looksEncrypted(key)) {
                    try {
                        decryptedKeys[provider] = encryptionService.decrypt(key);
                    } catch (error) {
                        decryptedKeys[provider] = '';
                    }
                } else {
                    decryptedKeys[provider] = key;
                }
            }
            settings.apiKeys = decryptedKeys;
        }
        
        return settings;
    }

    /**
     * Update multiple settings at once
     * @param {Object} updates - Object with setting updates
     */
    update(updates) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return;
        }

        // Handle API keys separately for encryption
        if (updates.apiKeys && this.encryptionReady) {
            const encryptedKeys = {};
            for (const [provider, key] of Object.entries(updates.apiKeys)) {
                if (key && !encryptionService.looksEncrypted(key)) {
                    try {
                        encryptedKeys[provider] = encryptionService.encrypt(key);
                    } catch (error) {
                        encryptedKeys[provider] = key;
                    }
                } else {
                    encryptedKeys[provider] = key;
                }
            }
            updates.apiKeys = encryptedKeys;
        }
        
        for (const [key, value] of Object.entries(updates)) {
            this.store.set(key, value);
        }
    }

    /**
     * Reset settings to defaults
     * @param {boolean} keepApiKeys - Whether to keep API keys
     */
    reset(keepApiKeys = true) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return;
        }

        const apiKeys = keepApiKeys ? this.store.get('apiKeys') : undefined;
        this.store.clear();
        
        if (apiKeys) {
            this.store.set('apiKeys', apiKeys);
        }
        
        console.log('[SettingsService] Reset to defaults');
    }

    /**
     * Check if a setting exists
     * @param {string} key - Setting key
     */
    has(key) {
        return this.store ? this.store.has(key) : false;
    }

    /**
     * Delete a setting
     * @param {string} key - Setting key
     */
    delete(key) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return;
        }
        
        this.store.delete(key);
    }

    /**
     * Get the store file path
     */
    getStorePath() {
        return this.store ? this.store.path : null;
    }

    /**
     * Watch for setting changes
     * @param {string} key - Setting key to watch
     * @param {Function} callback - Callback function
     */
    watch(key, callback) {
        if (!this.store) {
            console.warn('[SettingsService] Not initialized');
            return;
        }
        
        return this.store.onDidChange(key, callback);
    }

    /**
     * Export settings (for backup)
     */
    async exportSettings() {
        const settings = this.getAll();
        // Remove sensitive data from export
        delete settings.apiKeys;
        return settings;
    }

    /**
     * Import settings (from backup)
     * @param {Object} settings - Settings to import
     */
    async importSettings(settings) {
        // Don't import API keys for security
        delete settings.apiKeys;
        this.update(settings);
    }

    /**
     * Get API key for a provider
     * @param {string} provider - Provider name (openai, anthropic, etc.)
     */
    getApiKey(provider) {
        return this.get(`apiKeys.${provider}`, '');
    }

    /**
     * Set API key for a provider
     * @param {string} provider - Provider name
     * @param {string} key - API key
     */
    setApiKey(provider, key) {
        this.set(`apiKeys.${provider}`, key);
    }

    /**
     * Check if any API key is configured
     */
    hasAnyApiKey() {
        const apiKeys = this.get('apiKeys', {});
        return Object.values(apiKeys).some(key => key && key.length > 0);
    }

    /**
     * Get configured AI providers
     */
    getConfiguredProviders() {
        const apiKeys = this.get('apiKeys', {});
        return Object.entries(apiKeys)
            .filter(([_, key]) => key && key.length > 0)
            .map(([provider]) => provider);
    }
}

// Export singleton instance
module.exports = new SettingsService();