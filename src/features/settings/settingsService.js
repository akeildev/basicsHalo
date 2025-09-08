class SettingsService {
    constructor() {
        this.settings = {
            apiKeys: {
                openai: '',
                anthropic: '',
                google: '',
                deepgram: ''
            },
            preferences: {
                theme: 'dark',
                language: 'en',
                autoStart: false
            },
            advanced: {
                debugMode: false,
                logLevel: 'info'
            }
        };
    }

    async getSettings() {
        return this.settings;
    }

    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('Settings updated');
    }

    async getApiKey(provider) {
        return this.settings.apiKeys[provider] || '';
    }

    async setApiKey(provider, key) {
        this.settings.apiKeys[provider] = key;
        console.log(`API key set for ${provider}`);
    }

    async getPreference(key) {
        return this.settings.preferences[key];
    }

    async setPreference(key, value) {
        this.settings.preferences[key] = value;
        console.log(`Preference ${key} set to ${value}`);
    }
}

module.exports = new SettingsService();
