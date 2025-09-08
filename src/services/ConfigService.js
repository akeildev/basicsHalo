const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

/**
 * ConfigService - Centralized configuration management
 * Manages application configuration with environment variable support
 */
class ConfigService {
    constructor() {
        this.config = {};
        this.userConfigPath = null;
        this.envPrefix = 'pickleclueless_';
        this.initialized = false;
    }

    /**
     * Initialize the configuration service
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        // Set up paths
        this.setupPaths();
        
        // Load configuration in order of precedence
        this.loadDefaults();
        this.loadEnvironmentVariables();
        this.loadUserConfig();
        
        // Validate configuration
        this.validate();
        
        this.initialized = true;
        console.log('[ConfigService] Initialized with config:', this.getPublicConfig());
    }

    /**
     * Set up configuration file paths
     */
    setupPaths() {
        // User config directory
        const userDataPath = app.getPath('userData');
        this.configDir = path.join(userDataPath, 'config');
        this.userConfigPath = path.join(this.configDir, 'config.json');
        
        // Create config directory if it doesn't exist
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
            console.log('[ConfigService] Created config directory:', this.configDir);
        }
    }

    /**
     * Load default configuration values
     */
    loadDefaults() {
        this.config = {
            // API Configuration
            apiUrl: 'http://localhost:9001',
            apiTimeout: 10000,
            
            // Web Server Configuration
            webUrl: 'http://localhost:3001',
            webPort: 3001,
            
            // Application Settings
            appName: 'Halo',
            appVersion: app.getVersion(),
            environment: process.env.NODE_ENV || 'development',
            
            // Logging
            logLevel: 'info',
            debugMode: false,
            
            // Window Configuration
            windowAnimations: true,
            startMinimized: false,
            
            // Audio Configuration
            audioSampleRate: 16000,
            audioChannels: 1,
            
            // Transcription Configuration
            transcriptionLanguage: 'en',
            transcriptionProvider: 'deepgram',
            
            // AI Configuration
            defaultModel: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000,
            
            // Security
            encryptionEnabled: true,
            secureStorage: true,
            
            // Features
            featuresEnabled: {
                listen: true,
                ask: true,
                settings: true,
                shortcuts: true
            }
        };
    }

    /**
     * Load configuration from environment variables
     */
    loadEnvironmentVariables() {
        // Load .env file if it exists
        try {
            require('dotenv').config();
        } catch (error) {
            // dotenv not critical, continue without it
        }

        // Override with environment variables
        const env = process.env;
        
        // Map environment variables to config
        const envMappings = {
            [`${this.envPrefix}API_URL`]: 'apiUrl',
            [`${this.envPrefix}API_TIMEOUT`]: 'apiTimeout',
            [`${this.envPrefix}WEB_URL`]: 'webUrl',
            [`${this.envPrefix}WEB_PORT`]: 'webPort',
            [`${this.envPrefix}LOG_LEVEL`]: 'logLevel',
            [`${this.envPrefix}DEBUG`]: 'debugMode',
            [`${this.envPrefix}ENVIRONMENT`]: 'environment',
            'NODE_ENV': 'environment'
        };

        for (const [envKey, configKey] of Object.entries(envMappings)) {
            if (env[envKey]) {
                this.setNestedProperty(configKey, this.parseEnvValue(env[envKey]));
            }
        }
    }

    /**
     * Load user-specific configuration
     */
    loadUserConfig() {
        if (!fs.existsSync(this.userConfigPath)) {
            return;
        }

        try {
            const userConfig = JSON.parse(fs.readFileSync(this.userConfigPath, 'utf8'));
            this.config = this.deepMerge(this.config, userConfig);
            console.log('[ConfigService] Loaded user config from:', this.userConfigPath);
        } catch (error) {
            console.error('[ConfigService] Failed to load user config:', error);
        }
    }

    /**
     * Save current configuration to user config file
     */
    saveUserConfig() {
        try {
            // Filter out non-persistent values
            const persistentConfig = this.getPersistentConfig();
            
            fs.writeFileSync(
                this.userConfigPath,
                JSON.stringify(persistentConfig, null, 2),
                'utf8'
            );
            
            console.log('[ConfigService] Saved user config to:', this.userConfigPath);
        } catch (error) {
            console.error('[ConfigService] Failed to save user config:', error);
        }
    }

    /**
     * Get configuration values that should be persisted
     */
    getPersistentConfig() {
        const { appVersion, environment, ...persistent } = this.config;
        return persistent;
    }

    /**
     * Get public configuration (without sensitive data)
     */
    getPublicConfig() {
        const config = { ...this.config };
        // Remove any sensitive fields if they exist
        delete config.apiKeys;
        delete config.secrets;
        return config;
    }

    /**
     * Parse environment variable value
     */
    parseEnvValue(value) {
        // Try to parse as number
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        
        // Try to parse as boolean
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // Return as string
        return value;
    }

    /**
     * Set a nested property using dot notation
     */
    setNestedProperty(path, value) {
        const parts = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const output = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                output[key] = source[key];
            }
        }
        
        return output;
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        // Validate API URL
        if (!this.config.apiUrl || !this.config.apiUrl.startsWith('http')) {
            errors.push('Invalid API URL');
        }
        
        // Validate timeout
        if (this.config.apiTimeout < 1000) {
            errors.push('API timeout must be at least 1000ms');
        }
        
        // Validate log level
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLogLevels.includes(this.config.logLevel)) {
            errors.push(`Invalid log level. Must be one of: ${validLogLevels.join(', ')}`);
        }
        
        if (errors.length > 0) {
            console.error('[ConfigService] Configuration validation errors:', errors);
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} defaultValue - Default value if key doesn't exist
     */
    get(key, defaultValue = undefined) {
        const parts = key.split('.');
        let current = this.config;
        
        for (const part of parts) {
            if (current[part] === undefined) {
                return defaultValue;
            }
            current = current[part];
        }
        
        return current;
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} value - Value to set
     */
    set(key, value) {
        this.setNestedProperty(key, value);
    }

    /**
     * Update multiple configuration values
     * @param {Object} updates - Object with configuration updates
     */
    merge(updates) {
        this.config = this.deepMerge(this.config, updates);
    }

    /**
     * Get all configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Check if running in development
     */
    isDevelopment() {
        return this.config.environment === 'development';
    }

    /**
     * Check if running in production
     */
    isProduction() {
        return this.config.environment === 'production';
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled() {
        return this.config.debugMode === true;
    }

    /**
     * Get application paths
     */
    getPaths() {
        return {
            userData: app.getPath('userData'),
            config: this.configDir,
            logs: app.getPath('logs'),
            temp: app.getPath('temp'),
            desktop: app.getPath('desktop'),
            documents: app.getPath('documents'),
            downloads: app.getPath('downloads'),
            home: app.getPath('home')
        };
    }
}

// Export singleton instance
module.exports = new ConfigService();