# User 1 - Phase 1: Backend Foundation Setup

## Overview
In this phase, you'll set up the project structure, create the main Electron process, implement configuration services, and prepare stub IPC handlers for User 2 to connect to.

## Day 1: Project Initialization

### Step 1.1: Create Project Structure
```bash
# Create project directory
mkdir voice-overlay
cd voice-overlay

# Initialize git
git init
git checkout -b backend-dev

# Create directory structure
mkdir -p src/main/services
mkdir -p src/agent
mkdir -p build
mkdir -p assets/icons
```

### Step 1.2: Initialize package.json
```bash
npm init -y
```

Update `package.json` with exact dependencies:
```json
{
  "name": "voice-overlay",
  "productName": "Voice Overlay",
  "version": "0.1.0",
  "description": "Simplified voice-focused desktop overlay with MCP",
  "main": "src/main/index.js",
  "author": {
    "name": "Your Name"
  },
  "license": "GPL-3.0",
  "scripts": {
    "start": "electron .",
    "test:backend": "node test-backend.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.56.0",
    "dotenv": "^16.6.1",
    "electron": "^30.5.1",
    "electron-store": "^8.2.0",
    "express": "^4.18.2",
    "livekit-server-sdk": "^2.0.0",
    "openai": "^4.70.0",
    "uuid": "^9.0.1",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "electron-builder": "^26.0.12"
  }
}
```

### Step 1.3: Install Dependencies
```bash
npm install
```

### Step 1.4: Create Environment Configuration
Create `.env` file:
```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# ElevenLabs Configuration
ELEVEN_API_KEY=your_elevenlabs_key
ELEVEN_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVEN_MODEL_ID=eleven_turbo_v2_5

# App Configuration
NODE_ENV=development
DEBUG=true
```

Create `.gitignore`:
```gitignore
# Dependencies
node_modules/
src/agent/venv/
__pycache__/
*.pyc

# Environment
.env
.env.local

# Build outputs
dist/
build/

# IDE
.vscode/
.idea/
.DS_Store

# Logs
*.log
npm-debug.log*
```

## Day 2: Main Process Implementation

### Step 2.1: Create Main Entry Point
Create `src/main/index.js`:
```javascript
require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');

// Global references
let mainWindow = null;
let isShuttingDown = false;
let services = {};

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// App event handlers
app.whenReady().then(async () => {
    console.log('🚀 Voice Overlay Backend starting...');
    
    // Initialize services (we'll add these next)
    await initializeServices();
    
    // Check permissions on macOS
    if (process.platform === 'darwin') {
        await checkPermissions();
    }
    
    // Create main window
    createMainWindow();
    
    // Setup IPC handlers
    setupIPCHandlers();
    
    console.log('✅ Backend ready');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.on('before-quit', async (event) => {
    if (!isShuttingDown) {
        event.preventDefault();
        isShuttingDown = true;
        await cleanup();
        app.quit();
    }
});

/**
 * Initialize all services
 */
async function initializeServices() {
    try {
        // Services will be added in next steps
        console.log('✅ Services initialized');
    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        dialog.showErrorBox('Initialization Error', 
            'Failed to initialize services. Please check your configuration.');
        app.quit();
    }
}

/**
 * Check system permissions (macOS)
 */
async function checkPermissions() {
    const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone');
    
    if (microphoneStatus !== 'granted') {
        console.log('🎤 Requesting microphone permission...');
        const result = await systemPreferences.askForMediaAccess('microphone');
        if (!result) {
            dialog.showMessageBox({
                type: 'warning',
                title: 'Microphone Permission Required',
                message: 'Voice Overlay requires microphone access to function properly.',
                buttons: ['OK']
            });
        }
    }
}

/**
 * Create the main window
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 500,
        minWidth: 320,
        minHeight: 400,
        frame: true,
        transparent: false,
        backgroundColor: '#f5f5f5',
        resizable: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../renderer/preload.js'),
            webSecurity: true
        }
    });

    // For Phase 1, load a test page
    mainWindow.loadURL(`data:text/html,
        <!DOCTYPE html>
        <html>
        <head>
            <title>Backend Test</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                h1 { margin-bottom: 20px; }
                .status { 
                    background: rgba(255,255,255,0.2);
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <h1>✅ Backend Running</h1>
            <div class="status">Main Process: Active</div>
            <div class="status">IPC Handlers: Ready</div>
            <div class="status">Waiting for Frontend...</div>
        </body>
        </html>
    `);

    // Window event handlers
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Development tools
    if (!app.isPackaged && process.env.DEBUG === 'true') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

/**
 * Setup IPC handlers for renderer communication
 * These are stubs for User 2 to connect to
 */
function setupIPCHandlers() {
    // Voice session handlers
    ipcMain.handle('voice:start', async () => {
        console.log('[Backend] Voice start requested');
        // Return mock data for now
        return {
            success: true,
            url: process.env.LIVEKIT_URL || 'wss://dummy.livekit.cloud',
            token: 'dummy-token-for-testing',
            roomName: 'test-room-' + Date.now()
        };
    });

    ipcMain.handle('voice:stop', async () => {
        console.log('[Backend] Voice stop requested');
        return { success: true };
    });

    ipcMain.handle('voice:mute', async (event, muted) => {
        console.log('[Backend] Mute requested:', muted);
        return { success: true, muted };
    });

    // Settings handlers
    ipcMain.handle('settings:get', (event, key) => {
        console.log('[Backend] Settings get:', key);
        // Return mock settings
        return key === 'alwaysOnTop' ? true : null;
    });

    ipcMain.handle('settings:set', (event, key, value) => {
        console.log('[Backend] Settings set:', key, '=', value);
        return { success: true };
    });

    ipcMain.handle('settings:getAll', () => {
        console.log('[Backend] Get all settings');
        return {
            alwaysOnTop: true,
            openaiApiKey: '***',
            elevenLabsApiKey: '***'
        };
    });

    // Window control handlers
    ipcMain.handle('window:minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('window:close', () => {
        if (mainWindow) mainWindow.close();
    });

    ipcMain.handle('window:setAlwaysOnTop', (event, value) => {
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(value);
        }
        return { success: true };
    });

    // App info handlers
    ipcMain.handle('app:getVersion', () => {
        return app.getVersion();
    });

    ipcMain.handle('app:getPlatform', () => {
        return process.platform;
    });

    console.log('✅ IPC handlers registered');
}

/**
 * Send message to renderer (for later use)
 */
function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * Cleanup before quitting
 */
async function cleanup() {
    try {
        console.log('🧹 Cleaning up...');
        
        // Cleanup services (we'll add these later)
        
        console.log('✅ Cleanup complete');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Unexpected Error', 
        `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
module.exports = { sendToRenderer };
```

## Day 3: Configuration Service

### Step 3.1: Create ConfigService
Create `src/main/services/ConfigService.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * ConfigService - Centralized configuration management
 * Manages application configuration with environment variable support
 */
class ConfigService {
    constructor() {
        this.config = {};
        this.configPath = null;
        this.initialized = false;
    }

    /**
     * Initialize the configuration service
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        // Setup paths
        this.setupPaths();
        
        // Load configuration in order of precedence
        this.loadDefaults();
        this.loadEnvironment();
        this.loadUserConfig();
        
        // Validate configuration
        this.validate();
        
        this.initialized = true;
        console.log('[ConfigService] Initialized');
    }

    /**
     * Set up configuration file paths
     */
    setupPaths() {
        // User config directory
        const userDataPath = app.getPath('userData');
        this.configDir = path.join(userDataPath, 'config');
        this.configPath = path.join(this.configDir, 'config.json');
        
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
            // App settings
            appName: 'Voice Overlay',
            version: app.getVersion(),
            environment: process.env.NODE_ENV || 'production',
            
            // LiveKit defaults
            livekitUrl: '',
            livekitApiKey: '',
            livekitApiSecret: '',
            
            // OpenAI defaults
            openaiApiKey: '',
            
            // ElevenLabs defaults
            elevenLabsApiKey: '',
            elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
            elevenLabsModelId: 'eleven_turbo_v2_5',
            
            // Window settings
            alwaysOnTop: true,
            startMinimized: false,
            windowPosition: null,
            windowSize: { width: 380, height: 500 },
            
            // Audio settings
            audioSampleRate: 16000,
            audioChannels: 1,
            echoCancellation: true,
            noiseSuppression: true,
            
            // Debug
            debug: false,
            logLevel: 'info'
        };
    }

    /**
     * Load configuration from environment variables
     */
    loadEnvironment() {
        // Load .env file if it exists
        try {
            require('dotenv').config();
        } catch (error) {
            // dotenv not critical, continue without it
            console.log('[ConfigService] No .env file found, using system environment');
        }

        // Override with environment variables
        const env = process.env;
        
        // Map environment variables to config
        if (env.LIVEKIT_URL) this.config.livekitUrl = env.LIVEKIT_URL;
        if (env.LIVEKIT_API_KEY) this.config.livekitApiKey = env.LIVEKIT_API_KEY;
        if (env.LIVEKIT_API_SECRET) this.config.livekitApiSecret = env.LIVEKIT_API_SECRET;
        if (env.OPENAI_API_KEY) this.config.openaiApiKey = env.OPENAI_API_KEY;
        if (env.ELEVEN_API_KEY) this.config.elevenLabsApiKey = env.ELEVEN_API_KEY;
        if (env.ELEVEN_VOICE_ID) this.config.elevenLabsVoiceId = env.ELEVEN_VOICE_ID;
        if (env.ELEVEN_MODEL_ID) this.config.elevenLabsModelId = env.ELEVEN_MODEL_ID;
        if (env.DEBUG === 'true') this.config.debug = true;
        if (env.NODE_ENV) this.config.environment = env.NODE_ENV;
    }

    /**
     * Load user-specific configuration
     */
    loadUserConfig() {
        if (!fs.existsSync(this.configPath)) {
            console.log('[ConfigService] No user config file found');
            return;
        }

        try {
            const userConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            // Only override non-sensitive settings from user config
            const allowedKeys = [
                'alwaysOnTop', 'startMinimized', 'windowPosition', 
                'windowSize', 'audioSampleRate', 'audioChannels',
                'echoCancellation', 'noiseSuppression', 'logLevel'
            ];
            
            for (const key of allowedKeys) {
                if (userConfig[key] !== undefined) {
                    this.config[key] = userConfig[key];
                }
            }
            
            console.log('[ConfigService] Loaded user config from:', this.configPath);
        } catch (error) {
            console.error('[ConfigService] Failed to load user config:', error);
        }
    }

    /**
     * Save current configuration to user config file
     */
    save() {
        try {
            // Only save non-sensitive settings
            const configToSave = {
                alwaysOnTop: this.config.alwaysOnTop,
                startMinimized: this.config.startMinimized,
                windowPosition: this.config.windowPosition,
                windowSize: this.config.windowSize,
                audioSampleRate: this.config.audioSampleRate,
                audioChannels: this.config.audioChannels,
                echoCancellation: this.config.echoCancellation,
                noiseSuppression: this.config.noiseSuppression,
                logLevel: this.config.logLevel
            };
            
            fs.writeFileSync(
                this.configPath,
                JSON.stringify(configToSave, null, 2),
                'utf8'
            );
            
            console.log('[ConfigService] Saved user config to:', this.configPath);
        } catch (error) {
            console.error('[ConfigService] Failed to save user config:', error);
        }
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        const warnings = [];
        
        // Check required API keys
        if (!this.config.livekitUrl) {
            warnings.push('LiveKit URL not configured');
        }
        
        if (!this.config.livekitApiKey || !this.config.livekitApiSecret) {
            warnings.push('LiveKit API credentials not configured');
        }
        
        if (!this.config.openaiApiKey) {
            warnings.push('OpenAI API key not configured');
        }
        
        if (!this.config.elevenLabsApiKey) {
            warnings.push('ElevenLabs API key not configured');
        }
        
        // Log warnings
        if (warnings.length > 0) {
            console.warn('[ConfigService] Configuration warnings:', warnings);
        }
        
        // Fatal errors would throw
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     */
    get(key, defaultValue = undefined) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Value to set
     */
    set(key, value) {
        this.config[key] = value;
    }

    /**
     * Get all configuration
     */
    getAll() {
        // Return copy without sensitive data
        const publicConfig = { ...this.config };
        // Mask sensitive fields
        if (publicConfig.livekitApiSecret) publicConfig.livekitApiSecret = '***';
        if (publicConfig.openaiApiKey) publicConfig.openaiApiKey = '***';
        if (publicConfig.elevenLabsApiKey) publicConfig.elevenLabsApiKey = '***';
        return publicConfig;
    }

    /**
     * Check if running in development
     */
    isDevelopment() {
        return this.config.environment === 'development';
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled() {
        return this.config.debug === true;
    }
}

// Export singleton instance
module.exports = new ConfigService();
```

## Day 4: Settings Service

### Step 4.1: Create SettingsService
Create `src/main/services/SettingsService.js`:
```javascript
const Store = require('electron-store');

/**
 * SettingsService - Persistent settings management using electron-store
 */
class SettingsService {
    constructor() {
        this.store = new Store({
            name: 'voice-overlay-settings',
            defaults: this.getDefaults(),
            encryptionKey: 'voice-overlay-2024', // In production, use a secure key
            clearInvalidConfig: true
        });
        
        this.initialized = false;
    }

    /**
     * Get default settings
     */
    getDefaults() {
        return {
            // API Keys (encrypted)
            openaiApiKey: '',
            elevenLabsApiKey: '',
            livekitUrl: '',
            livekitApiKey: '',
            livekitApiSecret: '',
            
            // Voice Configuration
            elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
            elevenLabsModelId: 'eleven_turbo_v2_5',
            
            // Window preferences
            alwaysOnTop: true,
            windowPosition: null,
            windowSize: { width: 380, height: 500 },
            startWithSystem: false,
            minimizeToTray: false,
            
            // Audio settings
            inputDevice: 'default',
            outputDevice: 'default',
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            
            // App preferences
            theme: 'light',
            language: 'en',
            showNotifications: true,
            
            // MCP settings
            mcpServers: {
                applescript: {
                    enabled: true,
                    command: 'npx',
                    args: ['-y', '@johnlindquist/mcp-server-applescript']
                }
            },
            
            // Settings version for migration
            settingsVersion: 1
        };
    }

    /**
     * Initialize the settings service
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Migrate old settings if needed
            this.migrateSettings();
            
            // Validate settings
            this.validateSettings();
            
            this.initialized = true;
            console.log('[SettingsService] Initialized');
        } catch (error) {
            console.error('[SettingsService] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Migrate settings from older versions
     */
    migrateSettings() {
        const currentVersion = this.store.get('settingsVersion', 0);
        
        if (currentVersion < 1) {
            // Perform migration from version 0 to 1
            console.log('[SettingsService] Migrating settings from version', currentVersion, 'to 1');
            
            // Example: migrate old API key field names
            const oldOpenAIKey = this.store.get('openai_api_key');
            if (oldOpenAIKey && !this.store.get('openaiApiKey')) {
                this.store.set('openaiApiKey', oldOpenAIKey);
                this.store.delete('openai_api_key');
            }
            
            this.store.set('settingsVersion', 1);
        }
    }

    /**
     * Validate settings
     */
    validateSettings() {
        // Ensure critical settings have valid values
        const windowSize = this.store.get('windowSize');
        if (!windowSize || windowSize.width < 320 || windowSize.height < 400) {
            this.store.set('windowSize', { width: 380, height: 500 });
        }
        
        // Validate audio settings
        const validAudioSettings = ['echoCancellation', 'noiseSuppression', 'autoGainControl'];
        for (const setting of validAudioSettings) {
            const value = this.store.get(setting);
            if (typeof value !== 'boolean') {
                this.store.set(setting, true);
            }
        }
    }

    /**
     * API Key Management
     */
    getApiKey(service) {
        const keys = {
            'openai': 'openaiApiKey',
            'elevenlabs': 'elevenLabsApiKey',
            'livekit': 'livekitApiKey',
            'livekit-secret': 'livekitApiSecret'
        };
        
        const key = keys[service];
        if (!key) {
            console.error(`[SettingsService] Unknown service: ${service}`);
            return '';
        }
        
        return this.store.get(key, '');
    }

    setApiKey(service, value) {
        const keys = {
            'openai': 'openaiApiKey',
            'elevenlabs': 'elevenLabsApiKey',
            'livekit': 'livekitApiKey',
            'livekit-secret': 'livekitApiSecret'
        };
        
        const key = keys[service];
        if (!key) {
            console.error(`[SettingsService] Unknown service: ${service}`);
            return false;
        }
        
        this.store.set(key, value);
        return true;
    }

    /**
     * LiveKit Configuration
     */
    getLiveKitConfig() {
        return {
            url: this.store.get('livekitUrl', process.env.LIVEKIT_URL || ''),
            apiKey: this.store.get('livekitApiKey', process.env.LIVEKIT_API_KEY || ''),
            apiSecret: this.store.get('livekitApiSecret', process.env.LIVEKIT_API_SECRET || '')
        };
    }

    setLiveKitConfig(config) {
        if (config.url !== undefined) this.store.set('livekitUrl', config.url);
        if (config.apiKey !== undefined) this.store.set('livekitApiKey', config.apiKey);
        if (config.apiSecret !== undefined) this.store.set('livekitApiSecret', config.apiSecret);
    }

    /**
     * Voice Configuration
     */
    getVoiceConfig() {
        return {
            voiceId: this.store.get('elevenLabsVoiceId'),
            modelId: this.store.get('elevenLabsModelId'),
            apiKey: this.store.get('elevenLabsApiKey')
        };
    }

    setVoiceConfig(config) {
        if (config.voiceId) this.store.set('elevenLabsVoiceId', config.voiceId);
        if (config.modelId) this.store.set('elevenLabsModelId', config.modelId);
        if (config.apiKey) this.store.set('elevenLabsApiKey', config.apiKey);
    }

    /**
     * Window Settings
     */
    getWindowSettings() {
        return {
            alwaysOnTop: this.store.get('alwaysOnTop'),
            position: this.store.get('windowPosition'),
            size: this.store.get('windowSize'),
            startWithSystem: this.store.get('startWithSystem'),
            minimizeToTray: this.store.get('minimizeToTray')
        };
    }

    saveWindowState(bounds) {
        this.store.set('windowPosition', { x: bounds.x, y: bounds.y });
        this.store.set('windowSize', { width: bounds.width, height: bounds.height });
    }

    /**
     * MCP Server Configuration
     */
    getMCPServers() {
        return this.store.get('mcpServers', {});
    }

    setMCPServer(name, config) {
        const servers = this.store.get('mcpServers', {});
        servers[name] = config;
        this.store.set('mcpServers', servers);
    }

    /**
     * Generic getters/setters
     */
    get(key, defaultValue = undefined) {
        return this.store.get(key, defaultValue);
    }

    set(key, value) {
        this.store.set(key, value);
    }

    has(key) {
        return this.store.has(key);
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    /**
     * Get all settings
     */
    getAll() {
        const allSettings = this.store.store;
        // Mask sensitive data
        const masked = { ...allSettings };
        if (masked.openaiApiKey) masked.openaiApiKey = '***';
        if (masked.elevenLabsApiKey) masked.elevenLabsApiKey = '***';
        if (masked.livekitApiSecret) masked.livekitApiSecret = '***';
        return masked;
    }

    /**
     * Save settings to disk (electron-store does this automatically)
     */
    save() {
        // Force a save by triggering a set operation
        this.store.set('lastSaved', Date.now());
        console.log('[SettingsService] Settings saved');
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.store.clear();
        const defaults = this.getDefaults();
        for (const [key, value] of Object.entries(defaults)) {
            this.store.set(key, value);
        }
        console.log('[SettingsService] Settings reset to defaults');
    }

    /**
     * Export settings
     */
    exportSettings() {
        return JSON.stringify(this.store.store, null, 2);
    }

    /**
     * Import settings
     */
    importSettings(jsonString) {
        try {
            const settings = JSON.parse(jsonString);
            for (const [key, value] of Object.entries(settings)) {
                this.store.set(key, value);
            }
            return true;
        } catch (error) {
            console.error('[SettingsService] Failed to import settings:', error);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new SettingsService();
```

## Day 5: Integration and Testing

### Step 5.1: Update Main Process to Use Services
Update `src/main/index.js` to import and use services:
```javascript
// Add at the top after require statements
const ConfigService = require('./services/ConfigService');
const SettingsService = require('./services/SettingsService');

// Update initializeServices function
async function initializeServices() {
    try {
        // Initialize configuration
        ConfigService.initialize();
        
        // Initialize settings
        await SettingsService.initialize();
        
        // Store references
        services = {
            config: ConfigService,
            settings: SettingsService
        };
        
        console.log('✅ Services initialized');
        console.log('  Config:', ConfigService.getAll());
        console.log('  Settings:', SettingsService.getAll());
    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        dialog.showErrorBox('Initialization Error', 
            'Failed to initialize services. Please check your configuration.');
        app.quit();
    }
}

// Update IPC handlers to use real services
function setupIPCHandlers() {
    // Update settings handlers to use real SettingsService
    ipcMain.handle('settings:get', (event, key) => {
        return SettingsService.get(key);
    });

    ipcMain.handle('settings:set', (event, key, value) => {
        SettingsService.set(key, value);
        return { success: true };
    });

    ipcMain.handle('settings:getAll', () => {
        return SettingsService.getAll();
    });

    // Window control with settings persistence
    ipcMain.handle('window:setAlwaysOnTop', (event, value) => {
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(value);
            SettingsService.set('alwaysOnTop', value);
        }
        return { success: true };
    });
    
    // Keep other handlers as stubs for now
}

// Update cleanup function
async function cleanup() {
    try {
        console.log('🧹 Cleaning up...');
        
        // Save settings
        SettingsService.save();
        ConfigService.save();
        
        console.log('✅ Cleanup complete');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}
```

### Step 5.2: Create Backend Test Script
Create `test-backend.js`:
```javascript
/**
 * Backend Test Script
 * Run with: node test-backend.js
 */

console.log('🧪 Testing Backend Services...\n');

// Test ConfigService
console.log('1. Testing ConfigService:');
try {
    const ConfigService = require('./src/main/services/ConfigService');
    ConfigService.initialize();
    
    console.log('   ✅ ConfigService initialized');
    console.log('   - Environment:', ConfigService.get('environment'));
    console.log('   - Debug mode:', ConfigService.isDebugEnabled());
    console.log('   - LiveKit URL:', ConfigService.get('livekitUrl') ? 'Configured' : 'Not configured');
} catch (error) {
    console.error('   ❌ ConfigService failed:', error.message);
}

// Test SettingsService
console.log('\n2. Testing SettingsService:');
try {
    const SettingsService = require('./src/main/services/SettingsService');
    SettingsService.initialize();
    
    console.log('   ✅ SettingsService initialized');
    console.log('   - Always on top:', SettingsService.get('alwaysOnTop'));
    console.log('   - Window size:', SettingsService.get('windowSize'));
    
    // Test setting a value
    SettingsService.set('testKey', 'testValue');
    const testValue = SettingsService.get('testKey');
    console.log('   - Test set/get:', testValue === 'testValue' ? 'Working' : 'Failed');
    SettingsService.delete('testKey');
} catch (error) {
    console.error('   ❌ SettingsService failed:', error.message);
}

// Test Electron app launch
console.log('\n3. Testing Electron App:');
const { spawn } = require('child_process');
const electron = spawn('npx', ['electron', 'src/main/index.js'], {
    env: { ...process.env, TEST_MODE: 'true' }
});

let output = '';
electron.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(`   ${data}`);
});

electron.stderr.on('data', (data) => {
    process.stderr.write(`   Error: ${data}`);
});

// Kill after 3 seconds
setTimeout(() => {
    electron.kill();
    
    // Check if app started successfully
    if (output.includes('Backend ready')) {
        console.log('\n   ✅ Electron app started successfully');
    } else {
        console.log('\n   ❌ Electron app failed to start properly');
    }
    
    console.log('\n✨ Backend tests complete!');
    process.exit(0);
}, 3000);
```

### Step 5.3: Run Tests
```bash
# Test backend services
npm run test:backend

# Start Electron to verify
npm start
```

## Phase 1 Checkpoint Deliverables

### ✅ Your deliverables for User 2:

1. **Working Electron app** that launches and shows test page
2. **All IPC handlers** registered and returning mock/real data:
   - `voice:start` - Returns mock LiveKit connection info
   - `voice:stop` - Returns success
   - `voice:mute` - Returns success with mute state
   - `settings:get` - Returns real settings
   - `settings:set` - Saves real settings
   - `settings:getAll` - Returns all settings (masked)
   - `window:*` - Window control handlers

3. **Services initialized**:
   - ConfigService loading from .env
   - SettingsService with persistent storage

4. **Test results** showing everything works

### 📦 Files to commit:
```bash
git add .
git commit -m "Backend Phase 1: Foundation complete with services and IPC handlers"
git push origin backend-dev
```

### 📝 Communication to User 2:
Send this message to User 2:
```
Backend Phase 1 Complete! ✅

IPC Channels Available:
- voice:start → {success, url, token, roomName}
- voice:stop → {success}
- voice:mute → {success, muted}
- settings:get → value
- settings:set → {success}
- settings:getAll → {...settings}
- window:minimize → void
- window:close → void
- window:setAlwaysOnTop → {success}
- app:getVersion → string
- app:getPlatform → string

Preload script should be at: src/renderer/preload.js
Main process is looking for it there.

Backend running on branch: backend-dev
Ready for frontend integration!
```

## Troubleshooting

### Common Issues:

1. **Electron won't start**
```bash
# Check Node version (should be 18+)
node --version

# Reinstall Electron
npm uninstall electron
npm install electron@30.5.1
```

2. **Config not loading**
```bash
# Check .env file exists and has correct format
cat .env

# Check permissions
ls -la .env
```

3. **Settings not persisting**
```bash
# Check settings file location
ls ~/Library/Application\ Support/voice-overlay/

# Clear corrupted settings
rm -rf ~/Library/Application\ Support/voice-overlay/
```

## Next Phase Preview
In Phase 2, you will:
- Implement LiveKitService with real token generation
- Create WindowService for window management  
- Set up Python environment
- Begin Python agent implementation

Phase 1 is now complete! The backend foundation is ready for User 2 to connect their UI.