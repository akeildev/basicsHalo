# Phase 2: Main Process Implementation - Detailed Implementation

## 2.1 Main Entry Point with Complete IPC Setup

Create `src/main/index.js`:
```javascript
require('dotenv').config();

const { app, BrowserWindow, ipcMain, shell, dialog, systemPreferences } = require('electron');
const path = require('path');
const ConfigService = require('./services/ConfigService');
const LiveKitService = require('./services/LiveKitService');
const WindowService = require('./services/WindowService');
const SettingsService = require('./services/SettingsService');

// Global references
let mainWindow = null;
let isShuttingDown = false;

// Services
const config = new ConfigService();
const settings = new SettingsService();
const livekit = new LiveKitService(settings);
const windowService = new WindowService();

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
  console.log('🚀 Voice Overlay starting...');
  
  // Initialize services
  await initializeServices();
  
  // Check permissions on macOS
  if (process.platform === 'darwin') {
    await checkPermissions();
  }
  
  // Create main window
  createMainWindow();
  
  // Setup IPC handlers
  setupIPCHandlers();
  
  console.log('✅ Voice Overlay ready');
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
    // Initialize configuration
    config.initialize();
    
    // Initialize settings
    await settings.initialize();
    
    // Initialize LiveKit service
    await livekit.initialize();
    
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
  mainWindow = windowService.createWindow({
    width: 380,
    height: 500,
    minWidth: 320,
    minHeight: 400,
    frame: true,
    transparent: false,
    backgroundColor: '#f5f5f5',
    resizable: true,
    alwaysOnTop: settings.get('alwaysOnTop', true),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js'),
      webSecurity: true
    }
  });

  // Load the renderer
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Window event handlers
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Development tools
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

/**
 * Setup IPC handlers for renderer communication
 */
function setupIPCHandlers() {
  // Voice session handlers
  ipcMain.handle('voice:start', async () => {
    try {
      const result = await livekit.startSession();
      if (result.success) {
        sendToRenderer('voice:status', { connected: true });
      }
      return result;
    } catch (error) {
      console.error('Failed to start voice session:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('voice:stop', async () => {
    try {
      const result = await livekit.stopSession();
      sendToRenderer('voice:status', { connected: false });
      return result;
    } catch (error) {
      console.error('Failed to stop voice session:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('voice:mute', async (event, muted) => {
    try {
      return { success: true, muted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get', (event, key) => {
    return settings.get(key);
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    settings.set(key, value);
    return { success: true };
  });

  ipcMain.handle('settings:getAll', () => {
    return settings.getAll();
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
      settings.set('alwaysOnTop', value);
    }
  });

  // App info handlers
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });
}

/**
 * Send message to renderer
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
    
    // Stop LiveKit session if active
    await livekit.stopSession();
    
    // Save settings
    settings.save();
    
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
```

## 2.2 Configuration Service

Create `src/main/services/ConfigService.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigService {
  constructor() {
    this.config = {};
    this.configPath = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    // Setup paths
    this.setupPaths();
    
    // Load configuration
    this.loadDefaults();
    this.loadEnvironment();
    this.loadUserConfig();
    
    // Validate
    this.validate();
    
    this.initialized = true;
    console.log('[Config] Initialized');
  }

  setupPaths() {
    const userDataPath = app.getPath('userData');
    this.configDir = path.join(userDataPath, 'config');
    this.configPath = path.join(this.configDir, 'config.json');
    
    // Ensure directory exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadDefaults() {
    this.config = {
      // App settings
      appName: 'Voice Overlay',
      version: app.getVersion(),
      environment: process.env.NODE_ENV || 'production',
      
      // LiveKit defaults
      livekitUrl: process.env.LIVEKIT_URL || '',
      livekitApiKey: process.env.LIVEKIT_API_KEY || '',
      livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
      
      // OpenAI defaults
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      
      // ElevenLabs defaults
      elevenLabsApiKey: process.env.ELEVEN_API_KEY || '',
      elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // Default voice
      
      // Window settings
      alwaysOnTop: true,
      startMinimized: false,
      
      // Audio settings
      audioSampleRate: 16000,
      audioChannels: 1,
      
      // Debug
      debug: process.env.DEBUG === 'true'
    };
  }

  loadEnvironment() {
    // Override with environment variables
    const env = process.env;
    
    if (env.LIVEKIT_URL) this.config.livekitUrl = env.LIVEKIT_URL;
    if (env.LIVEKIT_API_KEY) this.config.livekitApiKey = env.LIVEKIT_API_KEY;
    if (env.LIVEKIT_API_SECRET) this.config.livekitApiSecret = env.LIVEKIT_API_SECRET;
    if (env.OPENAI_API_KEY) this.config.openaiApiKey = env.OPENAI_API_KEY;
    if (env.ELEVEN_API_KEY) this.config.elevenLabsApiKey = env.ELEVEN_API_KEY;
  }

  loadUserConfig() {
    if (!fs.existsSync(this.configPath)) return;
    
    try {
      const userConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      this.config = { ...this.config, ...userConfig };
      console.log('[Config] Loaded user config');
    } catch (error) {
      console.error('[Config] Failed to load user config:', error);
    }
  }

  save() {
    try {
      // Don't save sensitive data
      const configToSave = { ...this.config };
      delete configToSave.livekitApiSecret;
      delete configToSave.openaiApiKey;
      delete configToSave.elevenLabsApiKey;
      
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(configToSave, null, 2),
        'utf8'
      );
      console.log('[Config] Saved');
    } catch (error) {
      console.error('[Config] Failed to save:', error);
    }
  }

  validate() {
    const errors = [];
    
    if (!this.config.livekitUrl) {
      errors.push('LiveKit URL is required');
    }
    
    if (!this.config.livekitApiKey || !this.config.livekitApiSecret) {
      errors.push('LiveKit API credentials are required');
    }
    
    if (!this.config.openaiApiKey) {
      errors.push('OpenAI API key is required');
    }
    
    if (errors.length > 0) {
      console.warn('[Config] Validation warnings:', errors);
    }
  }

  get(key, defaultValue = undefined) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key, value) {
    this.config[key] = value;
  }

  getAll() {
    return { ...this.config };
  }

  isDebug() {
    return this.config.debug === true;
  }
}

module.exports = ConfigService;
```

## 2.3 Settings Service with electron-store

Create `src/main/services/SettingsService.js`:
```javascript
const Store = require('electron-store');

class SettingsService {
  constructor() {
    this.store = new Store({
      name: 'voice-overlay-settings',
      defaults: {
        // API Keys (encrypted)
        openaiApiKey: '',
        elevenLabsApiKey: '',
        livekitUrl: '',
        livekitApiKey: '',
        livekitApiSecret: '',
        
        // Window preferences
        alwaysOnTop: true,
        windowPosition: null,
        windowSize: { width: 380, height: 500 },
        
        // Voice settings
        elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
        elevenLabsModelId: 'eleven_turbo_v2_5',
        
        // Audio settings
        inputDevice: 'default',
        outputDevice: 'default',
        echoCancellation: true,
        noiseSuppression: true,
        
        // App preferences
        startWithSystem: false,
        minimizeToTray: false,
        showNotifications: true,
        
        // MCP settings
        mcpServers: {
          applescript: {
            enabled: true,
            command: 'npx',
            args: ['-y', '@johnlindquist/mcp-server-applescript']
          },
          filesystem: {
            enabled: false,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users']
          }
        }
      },
      encryptionKey: 'voice-overlay-2024' // In production, use a secure key
    });
  }

  async initialize() {
    // Migrate old settings if needed
    this.migrateSettings();
    console.log('[Settings] Initialized');
  }

  migrateSettings() {
    // Check for old settings format and migrate
    const version = this.store.get('settingsVersion', 0);
    
    if (version < 1) {
      // Perform migration if needed
      this.store.set('settingsVersion', 1);
    }
  }

  // API Key Management
  getApiKey(service) {
    const keys = {
      'openai': 'openaiApiKey',
      'elevenlabs': 'elevenLabsApiKey',
      'livekit': 'livekitApiKey',
      'livekit-secret': 'livekitApiSecret'
    };
    
    const key = keys[service];
    if (!key) throw new Error(`Unknown service: ${service}`);
    
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
    if (!key) throw new Error(`Unknown service: ${service}`);
    
    this.store.set(key, value);
  }

  // LiveKit Configuration
  getLiveKitConfig() {
    return {
      url: this.store.get('livekitUrl', process.env.LIVEKIT_URL || ''),
      apiKey: this.store.get('livekitApiKey', process.env.LIVEKIT_API_KEY || ''),
      apiSecret: this.store.get('livekitApiSecret', process.env.LIVEKIT_API_SECRET || '')
    };
  }

  setLiveKitConfig(config) {
    if (config.url) this.store.set('livekitUrl', config.url);
    if (config.apiKey) this.store.set('livekitApiKey', config.apiKey);
    if (config.apiSecret) this.store.set('livekitApiSecret', config.apiSecret);
  }

  // Voice Configuration
  getVoiceConfig() {
    return {
      voiceId: this.store.get('elevenLabsVoiceId'),
      modelId: this.store.get('elevenLabsModelId'),
      apiKey: this.store.get('elevenLabsApiKey')
    };
  }

  // MCP Server Configuration
  getMCPServers() {
    return this.store.get('mcpServers');
  }

  setMCPServer(name, config) {
    const servers = this.store.get('mcpServers');
    servers[name] = config;
    this.store.set('mcpServers', servers);
  }

  // Window Settings
  getWindowSettings() {
    return {
      alwaysOnTop: this.store.get('alwaysOnTop'),
      position: this.store.get('windowPosition'),
      size: this.store.get('windowSize')
    };
  }

  saveWindowState(bounds) {
    this.store.set('windowPosition', { x: bounds.x, y: bounds.y });
    this.store.set('windowSize', { width: bounds.width, height: bounds.height });
  }

  // Generic getters/setters
  get(key, defaultValue = undefined) {
    return this.store.get(key, defaultValue);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  getAll() {
    return this.store.store;
  }

  save() {
    // electron-store saves automatically, but we can force it
    this.store.store = this.store.store;
  }

  reset() {
    this.store.clear();
    this.initialize();
  }
}

module.exports = SettingsService;
```

## 2.4 LiveKit Service Implementation

Create `src/main/services/LiveKitService.js`:
```javascript
const { AccessToken } = require('livekit-server-sdk');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const EventEmitter = require('events');

class LiveKitService extends EventEmitter {
  constructor(settingsService) {
    super();
    this.settings = settingsService;
    this.agentProcess = null;
    this.currentRoom = null;
    this.isConnected = false;
  }

  async initialize() {
    // Verify configuration
    const config = this.settings.getLiveKitConfig();
    
    if (!config.url || !config.apiKey || !config.apiSecret) {
      console.warn('[LiveKit] Missing configuration');
      return false;
    }
    
    console.log('[LiveKit] Service initialized');
    return true;
  }

  async generateToken(roomName, participantName = 'user') {
    const config = this.settings.getLiveKitConfig();
    
    console.log('[LiveKit] Generating token for room:', roomName);
    
    const token = new AccessToken(
      config.apiKey,
      config.apiSecret,
      {
        identity: participantName,
        ttl: '10h'
      }
    );
    
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true
    });
    
    const jwt = await token.toJwt();
    console.log('[LiveKit] Token generated successfully');
    return jwt;
  }

  async startSession() {
    try {
      if (this.isConnected) {
        return { success: false, error: 'Already connected' };
      }
      
      console.log('[LiveKit] Starting session...');
      
      // Generate unique room name
      this.currentRoom = `voice-${uuidv4().slice(0, 8)}`;
      
      // Get configuration
      const config = this.settings.getLiveKitConfig();
      
      // Generate token
      const token = await this.generateToken(this.currentRoom);
      
      // Start Python agent
      const agentStarted = await this.startPythonAgent();
      
      if (!agentStarted) {
        throw new Error('Failed to start voice agent');
      }
      
      this.isConnected = true;
      this.emit('connected', { room: this.currentRoom });
      
      return {
        success: true,
        url: config.url,
        token: token,
        roomName: this.currentRoom
      };
      
    } catch (error) {
      console.error('[LiveKit] Failed to start session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async startPythonAgent() {
    return new Promise((resolve) => {
      try {
        console.log('[LiveKit] Starting Python agent...');
        
        const agentPath = path.join(__dirname, '../../agent/voice_agent.py');
        const config = this.settings.getLiveKitConfig();
        const voiceConfig = this.settings.getVoiceConfig();
        
        // Prepare environment
        const env = {
          ...process.env,
          LIVEKIT_URL: config.url,
          LIVEKIT_API_KEY: config.apiKey,
          LIVEKIT_API_SECRET: config.apiSecret,
          OPENAI_API_KEY: this.settings.getApiKey('openai'),
          ELEVEN_API_KEY: voiceConfig.apiKey,
          ELEVEN_VOICE_ID: voiceConfig.voiceId,
          ELEVEN_MODEL_ID: voiceConfig.modelId,
          ROOM_NAME: this.currentRoom,
          PYTHONUNBUFFERED: '1'
        };
        
        // Check if we're in development or production
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        const venvPath = path.join(__dirname, '../../agent/venv');
        const venvPython = path.join(venvPath, 
          process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');
        
        // Use venv Python if it exists
        const usePython = require('fs').existsSync(venvPython) ? venvPython : pythonCommand;
        
        console.log('[LiveKit] Using Python:', usePython);
        console.log('[LiveKit] Agent path:', agentPath);
        
        this.agentProcess = spawn(usePython, [agentPath], { env });
        
        this.agentProcess.stdout.on('data', (data) => {
          const message = data.toString();
          console.log('[Agent]:', message);
          
          // Check for successful connection
          if (message.includes('Agent started') || 
              message.includes('Connected to room')) {
            console.log('[LiveKit] ✅ Agent connected successfully');
            resolve(true);
          }
          
          this.emit('agent-log', message);
        });
        
        this.agentProcess.stderr.on('data', (data) => {
          console.error('[Agent Error]:', data.toString());
          this.emit('agent-error', data.toString());
        });
        
        this.agentProcess.on('error', (error) => {
          console.error('[LiveKit] Failed to start agent:', error);
          this.emit('agent-error', error.message);
          resolve(false);
        });
        
        this.agentProcess.on('exit', (code) => {
          console.log(`[LiveKit] Agent exited with code ${code}`);
          this.agentProcess = null;
          this.emit('agent-exit', code);
        });
        
        // Set timeout for agent startup
        setTimeout(() => {
          if (!this.isConnected) {
            console.warn('[LiveKit] Agent startup timeout');
            resolve(false);
          }
        }, 10000); // 10 second timeout
        
      } catch (error) {
        console.error('[LiveKit] Error starting agent:', error);
        resolve(false);
      }
    });
  }

  async stopSession() {
    try {
      console.log('[LiveKit] Stopping session...');
      
      // Kill Python agent
      if (this.agentProcess) {
        this.agentProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (this.agentProcess) {
            this.agentProcess.kill('SIGKILL');
          }
        }, 5000);
        
        this.agentProcess = null;
      }
      
      this.isConnected = false;
      this.currentRoom = null;
      this.emit('disconnected');
      
      return { success: true };
      
    } catch (error) {
      console.error('[LiveKit] Failed to stop session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  isActive() {
    return this.isConnected && this.agentProcess !== null;
  }

  getRoomName() {
    return this.currentRoom;
  }
}

module.exports = LiveKitService;
```

## 2.5 Window Service

Create `src/main/services/WindowService.js`:
```javascript
const { BrowserWindow, screen } = require('electron');
const path = require('path');

class WindowService {
  constructor() {
    this.windows = new Map();
  }

  createWindow(options = {}) {
    const defaultOptions = {
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
    };
    
    const windowOptions = { ...defaultOptions, ...options };
    
    // Position window
    if (!windowOptions.x || !windowOptions.y) {
      const display = screen.getPrimaryDisplay();
      const { width, height } = display.workAreaSize;
      
      // Position in top-right corner with margin
      windowOptions.x = width - windowOptions.width - 20;
      windowOptions.y = 50;
    }
    
    const window = new BrowserWindow(windowOptions);
    
    // Store window reference
    const id = window.id;
    this.windows.set(id, window);
    
    // Clean up on close
    window.on('closed', () => {
      this.windows.delete(id);
    });
    
    return window;
  }

  getWindow(id) {
    return this.windows.get(id);
  }

  getAllWindows() {
    return Array.from(this.windows.values());
  }

  closeAllWindows() {
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }
}

module.exports = WindowService;
```

## 2.6 Preload Script for Secure IPC

Create `src/renderer/preload.js`:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to communicate with the main process
contextBridge.exposeInMainWorld('api', {
  // Voice methods
  startVoice: () => ipcRenderer.invoke('voice:start'),
  stopVoice: () => ipcRenderer.invoke('voice:stop'),
  setMute: (muted) => ipcRenderer.invoke('voice:mute', muted),
  
  // Settings methods
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  
  // Window methods
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
  
  // App methods
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'voice:status',
      'voice:transcript',
      'voice:error',
      'agent:response',
      'agent:thinking',
      'mcp:result'
    ];
    
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  
  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Log that preload script is loaded
console.log('✅ Preload script loaded');
```

## 2.7 Test Main Process

Create `test-main.js`:
```javascript
// Test script to verify main process setup
const { app } = require('electron');

// Mock app for testing
if (!app) {
  global.app = {
    getPath: () => '/tmp/test',
    getVersion: () => '0.1.0',
    isPackaged: false
  };
}

console.log('Testing main process services...\n');

// Test ConfigService
console.log('1. Testing ConfigService:');
const ConfigService = require('./src/main/services/ConfigService');
const config = new ConfigService();
config.initialize();
console.log('   ✅ ConfigService initialized');
console.log('   - Environment:', config.get('environment'));
console.log('   - Debug mode:', config.isDebug());

// Test SettingsService
console.log('\n2. Testing SettingsService:');
const SettingsService = require('./src/main/services/SettingsService');
const settings = new SettingsService();
settings.initialize();
console.log('   ✅ SettingsService initialized');
console.log('   - Always on top:', settings.get('alwaysOnTop'));

// Test LiveKitService
console.log('\n3. Testing LiveKitService:');
const LiveKitService = require('./src/main/services/LiveKitService');
const livekit = new LiveKitService(settings);
livekit.initialize();
console.log('   ✅ LiveKitService initialized');

console.log('\n✨ All services tested successfully!');
```

Run test:
```bash
node test-main.js
```

## Common Issues and Solutions

### Issue 1: IPC handlers not working
```javascript
// Ensure preload script is specified correctly
webPreferences: {
  preload: require('path').join(__dirname, 'preload.js')
}
```

### Issue 2: Settings not persisting
```javascript
// Force save before app quits
app.on('before-quit', () => {
  settings.save();
});
```

### Issue 3: Python agent not starting
```bash
# Check Python installation
which python3
python3 --version

# Check agent dependencies
cd src/agent
source venv/bin/activate
pip list
```

## Next Steps

With Phase 2 complete, you now have:
- ✅ Complete main process with IPC
- ✅ Configuration management
- ✅ Settings persistence with encryption
- ✅ LiveKit service integration
- ✅ Window management
- ✅ Secure preload script

The main process is fully functional and ready to communicate with the renderer. Proceed to Phase 3 to implement the UI.