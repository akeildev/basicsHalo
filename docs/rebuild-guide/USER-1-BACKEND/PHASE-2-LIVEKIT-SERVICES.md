# User 1 - Phase 2: LiveKit Services & Python Setup

## Overview
In this phase, you'll implement the LiveKit backend service with real token generation, set up the Python environment, and create the foundation for the voice agent.

## Day 1: Window Service Implementation

### Step 1.1: Create WindowService
Create `src/main/services/WindowService.js`:
```javascript
const { BrowserWindow, screen } = require('electron');
const path = require('path');

/**
 * WindowService - Manages application windows
 */
class WindowService {
    constructor() {
        this.windows = new Map();
        this.mainWindowId = null;
    }

    /**
     * Create the main application window
     */
    createMainWindow(options = {}) {
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
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../../renderer/preload.js'),
                webSecurity: true,
                backgroundThrottling: false
            }
        };
        
        const windowOptions = { ...defaultOptions, ...options };
        
        // Position window in top-right corner
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
        this.mainWindowId = id;
        
        // Track window state changes
        this.setupWindowEventHandlers(window);
        
        // Clean up on close
        window.on('closed', () => {
            this.windows.delete(id);
            if (this.mainWindowId === id) {
                this.mainWindowId = null;
            }
        });
        
        console.log(`[WindowService] Created main window with ID: ${id}`);
        return window;
    }

    /**
     * Setup window event handlers
     */
    setupWindowEventHandlers(window) {
        // Track position changes
        let saveTimer = null;
        
        window.on('moved', () => {
            // Debounce position saving
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                this.saveWindowState(window);
            }, 500);
        });
        
        window.on('resized', () => {
            // Debounce size saving
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                this.saveWindowState(window);
            }, 500);
        });
        
        // Prevent window from being hidden completely
        window.on('minimize', (event) => {
            if (process.platform === 'darwin') {
                // On macOS, hide to dock instead of minimize
                window.hide();
                event.preventDefault();
            }
        });
        
        // Handle window focus
        window.on('focus', () => {
            console.log('[WindowService] Window focused');
        });
        
        window.on('blur', () => {
            console.log('[WindowService] Window blurred');
        });
    }

    /**
     * Save window state to settings
     */
    saveWindowState(window) {
        if (!window || window.isDestroyed()) return;
        
        try {
            const bounds = window.getBounds();
            const SettingsService = require('./SettingsService');
            
            SettingsService.saveWindowState({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height
            });
            
            console.log('[WindowService] Window state saved');
        } catch (error) {
            console.error('[WindowService] Failed to save window state:', error);
        }
    }

    /**
     * Restore window position and size from settings
     */
    restoreWindowState(window) {
        try {
            const SettingsService = require('./SettingsService');
            const windowSettings = SettingsService.getWindowSettings();
            
            if (windowSettings.position && windowSettings.size) {
                // Verify position is still valid (monitor might have changed)
                const displays = screen.getAllDisplays();
                const inBounds = displays.some(display => {
                    const { x, y, width, height } = display.bounds;
                    return windowSettings.position.x >= x &&
                           windowSettings.position.x < x + width &&
                           windowSettings.position.y >= y &&
                           windowSettings.position.y < y + height;
                });
                
                if (inBounds) {
                    window.setBounds({
                        x: windowSettings.position.x,
                        y: windowSettings.position.y,
                        width: windowSettings.size.width,
                        height: windowSettings.size.height
                    });
                    console.log('[WindowService] Window state restored');
                } else {
                    console.log('[WindowService] Saved position out of bounds, using defaults');
                }
            }
        } catch (error) {
            console.error('[WindowService] Failed to restore window state:', error);
        }
    }

    /**
     * Get window by ID
     */
    getWindow(id) {
        return this.windows.get(id);
    }

    /**
     * Get main window
     */
    getMainWindow() {
        return this.mainWindowId ? this.windows.get(this.mainWindowId) : null;
    }

    /**
     * Get all windows
     */
    getAllWindows() {
        return Array.from(this.windows.values());
    }

    /**
     * Close all windows
     */
    closeAllWindows() {
        this.windows.forEach(window => {
            if (!window.isDestroyed()) {
                window.close();
            }
        });
        this.windows.clear();
    }

    /**
     * Send message to renderer
     */
    sendToRenderer(channel, data, windowId = null) {
        const window = windowId ? this.getWindow(windowId) : this.getMainWindow();
        
        if (window && !window.isDestroyed()) {
            window.webContents.send(channel, data);
            return true;
        }
        
        return false;
    }

    /**
     * Toggle always on top
     */
    toggleAlwaysOnTop(windowId = null) {
        const window = windowId ? this.getWindow(windowId) : this.getMainWindow();
        
        if (window && !window.isDestroyed()) {
            const current = window.isAlwaysOnTop();
            window.setAlwaysOnTop(!current);
            return !current;
        }
        
        return false;
    }
}

// Export singleton instance
module.exports = new WindowService();
```

## Day 2: LiveKit Service Implementation

### Step 2.1: Create LiveKitService
Create `src/main/services/LiveKitService.js`:
```javascript
const { AccessToken } = require('livekit-server-sdk');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const EventEmitter = require('events');

/**
 * LiveKitService - Manages LiveKit connections and Python agent
 */
class LiveKitService extends EventEmitter {
    constructor(settingsService) {
        super();
        this.settings = settingsService;
        this.agentProcess = null;
        this.currentRoom = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            // Verify configuration
            const config = this.settings.getLiveKitConfig();
            
            if (!config.url || !config.apiKey || !config.apiSecret) {
                console.warn('[LiveKitService] Missing LiveKit configuration');
                console.log('  URL:', config.url ? 'Set' : 'Missing');
                console.log('  API Key:', config.apiKey ? 'Set' : 'Missing');
                console.log('  API Secret:', config.apiSecret ? 'Set' : 'Missing');
                return false;
            }
            
            console.log('[LiveKitService] Service initialized');
            console.log('  LiveKit URL:', config.url);
            return true;
        } catch (error) {
            console.error('[LiveKitService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Generate access token for room connection
     */
    async generateToken(roomName, participantName = 'user', metadata = {}) {
        const config = this.settings.getLiveKitConfig();
        
        if (!config.apiKey || !config.apiSecret) {
            throw new Error('LiveKit API credentials not configured');
        }
        
        console.log('[LiveKitService] Generating token for room:', roomName);
        
        try {
            const token = new AccessToken(
                config.apiKey,
                config.apiSecret,
                {
                    identity: participantName,
                    ttl: '10h',
                    metadata: JSON.stringify(metadata)
                }
            );
            
            token.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
                canUpdateOwnMetadata: true,
                hidden: false
            });
            
            const jwt = await token.toJwt();
            console.log('[LiveKitService] Token generated successfully');
            return jwt;
        } catch (error) {
            console.error('[LiveKitService] Token generation failed:', error);
            throw error;
        }
    }

    /**
     * Start a LiveKit session with agent
     */
    async startSession(options = {}) {
        try {
            if (this.isConnected) {
                console.warn('[LiveKitService] Already connected');
                return { 
                    success: false, 
                    error: 'Already connected to a session' 
                };
            }
            
            console.log('[LiveKitService] Starting session...');
            this.connectionAttempts++;
            
            // Generate unique room name
            this.currentRoom = `voice-${uuidv4().slice(0, 8)}`;
            console.log('[LiveKitService] Room name:', this.currentRoom);
            
            // Get configuration
            const config = this.settings.getLiveKitConfig();
            
            if (!config.url) {
                throw new Error('LiveKit URL not configured');
            }
            
            // Generate token for user
            const token = await this.generateToken(
                this.currentRoom,
                'user',
                { role: 'user', timestamp: Date.now() }
            );
            
            // Start Python agent if requested (default: true)
            if (options.startAgent !== false) {
                const agentStarted = await this.startPythonAgent();
                
                if (!agentStarted) {
                    // Continue without agent but warn
                    console.warn('[LiveKitService] Agent failed to start, continuing without agent');
                    this.emit('agent-error', 'Agent failed to start');
                }
            }
            
            this.isConnected = true;
            this.connectionAttempts = 0;
            this.emit('connected', { room: this.currentRoom });
            
            // Return connection details for renderer
            return {
                success: true,
                url: config.url,
                token: token,
                roomName: this.currentRoom
            };
            
        } catch (error) {
            console.error('[LiveKitService] Failed to start session:', error);
            
            // Retry logic
            if (this.connectionAttempts < this.maxConnectionAttempts) {
                console.log(`[LiveKitService] Retrying... (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.startSession(options);
            }
            
            this.connectionAttempts = 0;
            return {
                success: false,
                error: error.message,
                code: error.code || 'UNKNOWN'
            };
        }
    }

    /**
     * Start the Python voice agent
     */
    async startPythonAgent() {
        return new Promise((resolve) => {
            try {
                console.log('[LiveKitService] Starting Python agent...');
                
                // Agent path - adjust based on your structure
                const agentPath = path.join(__dirname, '../../../agent/voice_agent.py');
                console.log('[LiveKitService] Agent path:', agentPath);
                
                // Check if agent file exists
                const fs = require('fs');
                if (!fs.existsSync(agentPath)) {
                    console.error('[LiveKitService] Agent file not found:', agentPath);
                    resolve(false);
                    return;
                }
                
                // Get configuration
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
                    PYTHONUNBUFFERED: '1',
                    PYTHONPATH: path.join(__dirname, '../../../agent')
                };
                
                // Determine Python command
                const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
                
                // Check for venv
                const venvPath = path.join(__dirname, '../../../agent/venv');
                const venvPython = path.join(venvPath, 
                    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');
                
                const usePython = fs.existsSync(venvPython) ? venvPython : pythonCommand;
                
                console.log('[LiveKitService] Using Python:', usePython);
                console.log('[LiveKitService] Room name in env:', env.ROOM_NAME);
                
                // Spawn Python process
                this.agentProcess = spawn(usePython, [agentPath], { 
                    env,
                    cwd: path.join(__dirname, '../../../agent')
                });
                
                // Handle stdout
                this.agentProcess.stdout.on('data', (data) => {
                    const message = data.toString();
                    console.log('[Agent]:', message.trim());
                    
                    // Check for successful connection
                    if (message.includes('Agent started') || 
                        message.includes('Connected to room') ||
                        message.includes('Voice session started')) {
                        console.log('[LiveKitService] ✅ Agent connected successfully');
                        resolve(true);
                    }
                    
                    this.emit('agent-log', message);
                });
                
                // Handle stderr
                this.agentProcess.stderr.on('data', (data) => {
                    const error = data.toString();
                    console.error('[Agent Error]:', error.trim());
                    
                    // Check for import errors
                    if (error.includes('ModuleNotFoundError')) {
                        console.error('[LiveKitService] Python dependencies missing');
                        this.emit('agent-error', 'Python dependencies not installed');
                    }
                    
                    this.emit('agent-error', error);
                });
                
                // Handle process errors
                this.agentProcess.on('error', (error) => {
                    console.error('[LiveKitService] Failed to start agent:', error);
                    this.emit('agent-error', error.message);
                    resolve(false);
                });
                
                // Handle process exit
                this.agentProcess.on('exit', (code, signal) => {
                    console.log(`[LiveKitService] Agent exited with code ${code} (signal: ${signal})`);
                    this.agentProcess = null;
                    this.emit('agent-exit', { code, signal });
                    
                    // If we haven't resolved yet, it failed to start
                    resolve(false);
                });
                
                // Set timeout for agent startup
                setTimeout(() => {
                    resolve(false); // Timeout, but don't kill process
                }, 10000); // 10 second timeout
                
            } catch (error) {
                console.error('[LiveKitService] Error starting agent:', error);
                this.emit('agent-error', error.message);
                resolve(false);
            }
        });
    }

    /**
     * Stop the current session
     */
    async stopSession() {
        try {
            console.log('[LiveKitService] Stopping session...');
            
            // Kill Python agent
            if (this.agentProcess) {
                console.log('[LiveKitService] Terminating Python agent...');
                
                // Try graceful shutdown first
                this.agentProcess.kill('SIGTERM');
                
                // Force kill after 5 seconds if still running
                setTimeout(() => {
                    if (this.agentProcess) {
                        console.log('[LiveKitService] Force killing Python agent...');
                        this.agentProcess.kill('SIGKILL');
                    }
                }, 5000);
                
                this.agentProcess = null;
            }
            
            // Clear state
            this.isConnected = false;
            this.currentRoom = null;
            this.connectionAttempts = 0;
            
            this.emit('disconnected');
            
            return { success: true };
            
        } catch (error) {
            console.error('[LiveKitService] Failed to stop session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if session is active
     */
    isActive() {
        return this.isConnected && this.currentRoom !== null;
    }

    /**
     * Get current room name
     */
    getRoomName() {
        return this.currentRoom;
    }

    /**
     * Get session info
     */
    getSessionInfo() {
        return {
            isConnected: this.isConnected,
            roomName: this.currentRoom,
            hasAgent: this.agentProcess !== null,
            connectionAttempts: this.connectionAttempts
        };
    }

    /**
     * Handle mute/unmute (pass-through for UI)
     */
    async setMute(muted) {
        // The actual muting happens in the renderer's LiveKit client
        // This is just for tracking state if needed
        this.emit('mute-changed', { muted });
        return { success: true, muted };
    }
}

module.exports = LiveKitService;
```

## Day 3: Update Main Process

### Step 3.1: Integrate New Services
Update `src/main/index.js`:
```javascript
// Add imports at the top
const WindowService = require('./services/WindowService');
const LiveKitService = require('./services/LiveKitService');

// Update services initialization
async function initializeServices() {
    try {
        // Initialize configuration
        ConfigService.initialize();
        
        // Initialize settings
        await SettingsService.initialize();
        
        // Initialize LiveKit service
        const livekit = new LiveKitService(SettingsService);
        await livekit.initialize();
        
        // Store references
        services = {
            config: ConfigService,
            settings: SettingsService,
            window: WindowService,
            livekit: livekit
        };
        
        // Setup LiveKit event handlers
        setupLiveKitHandlers(livekit);
        
        console.log('✅ Services initialized');
    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        dialog.showErrorBox('Initialization Error', 
            'Failed to initialize services. Please check your configuration.');
        app.quit();
    }
}

// Add LiveKit event handlers
function setupLiveKitHandlers(livekit) {
    livekit.on('connected', (data) => {
        console.log('[Main] LiveKit connected:', data);
        WindowService.sendToRenderer('voice:status', { 
            connected: true, 
            room: data.room 
        });
    });
    
    livekit.on('disconnected', () => {
        console.log('[Main] LiveKit disconnected');
        WindowService.sendToRenderer('voice:status', { 
            connected: false 
        });
    });
    
    livekit.on('agent-log', (message) => {
        // Could forward to renderer if needed
        console.log('[Agent Log]:', message);
    });
    
    livekit.on('agent-error', (error) => {
        console.error('[Agent Error]:', error);
        WindowService.sendToRenderer('voice:error', { 
            message: error 
        });
    });
}

// Update window creation to use WindowService
function createMainWindow() {
    const settings = SettingsService.getWindowSettings();
    
    mainWindow = WindowService.createMainWindow({
        alwaysOnTop: settings.alwaysOnTop,
        width: settings.size?.width || 380,
        height: settings.size?.height || 500
    });
    
    // Restore window position if available
    WindowService.restoreWindowState(mainWindow);
    
    // Load renderer or test page
    if (process.env.TEST_MODE === 'true') {
        // Test mode - show backend status
        mainWindow.loadURL(`data:text/html,...`); // existing test HTML
    } else {
        // Normal mode - load renderer
        const rendererPath = path.join(__dirname, '../renderer/index.html');
        if (require('fs').existsSync(rendererPath)) {
            mainWindow.loadFile(rendererPath);
        } else {
            // Fallback if renderer not ready
            mainWindow.loadURL(`data:text/html,
                <h1>Waiting for Frontend...</h1>
                <p>Renderer not found at: ${rendererPath}</p>
            `);
        }
    }
    
    // Rest of window setup...
}

// Update IPC handlers to use real LiveKit service
function setupIPCHandlers() {
    // Voice session handlers - now using real LiveKit
    ipcMain.handle('voice:start', async () => {
        console.log('[Backend] Voice start requested');
        return await services.livekit.startSession({ startAgent: true });
    });

    ipcMain.handle('voice:stop', async () => {
        console.log('[Backend] Voice stop requested');
        return await services.livekit.stopSession();
    });

    ipcMain.handle('voice:mute', async (event, muted) => {
        console.log('[Backend] Mute requested:', muted);
        return await services.livekit.setMute(muted);
    });
    
    // Rest of handlers remain the same...
}
```

## Day 4: Python Environment Setup

### Step 4.1: Create Python Setup Script
Create `src/agent/setup.py`:
```python
#!/usr/bin/env python3
"""
Setup script for Voice Agent dependencies
"""
import subprocess
import sys
import os

def check_python_version():
    """Check if Python version is 3.8+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python 3.8+ required. Current: {sys.version}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def create_venv():
    """Create virtual environment"""
    if os.path.exists('venv'):
        print("✅ Virtual environment exists")
        return True
    
    print("📦 Creating virtual environment...")
    try:
        subprocess.run([sys.executable, '-m', 'venv', 'venv'], check=True)
        print("✅ Virtual environment created")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create venv: {e}")
        return False

def install_requirements():
    """Install requirements"""
    venv_python = 'venv/Scripts/python.exe' if sys.platform == 'win32' else 'venv/bin/python3'
    
    if not os.path.exists(venv_python):
        print(f"❌ Venv Python not found: {venv_python}")
        return False
    
    print("📦 Installing requirements...")
    requirements = [
        'livekit==0.2.25',
        'livekit-agents==0.10.4',
        'livekit-plugins-openai==0.9.1',
        'livekit-plugins-elevenlabs==0.7.5',
        'livekit-plugins-silero==0.6.5',
        'python-dotenv==1.0.0',
        'aiohttp==3.11.10'
    ]
    
    try:
        # Upgrade pip first
        subprocess.run([venv_python, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True)
        
        # Install each requirement
        for req in requirements:
            print(f"  Installing {req}...")
            subprocess.run([venv_python, '-m', 'pip', 'install', req], check=True)
        
        print("✅ All requirements installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def main():
    print("🐍 Setting up Python environment for Voice Agent\n")
    
    if not check_python_version():
        sys.exit(1)
    
    if not create_venv():
        sys.exit(1)
    
    if not install_requirements():
        sys.exit(1)
    
    print("\n✨ Setup complete!")
    print("\nTo activate the environment:")
    if sys.platform == 'win32':
        print("  venv\\Scripts\\activate")
    else:
        print("  source venv/bin/activate")

if __name__ == '__main__':
    main()
```

### Step 4.2: Create Basic Voice Agent
Create `src/agent/voice_agent.py`:
```python
#!/usr/bin/env python3
"""
Basic Voice Agent for Voice Overlay
This is a simplified version for Phase 2 testing
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("voice-agent")

# Check for required environment variables
required_env = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'ROOM_NAME']
missing = [var for var in required_env if not os.getenv(var)]
if missing:
    logger.error(f"Missing required environment variables: {missing}")
    sys.exit(1)

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import AgentSession
from livekit.plugins import openai, elevenlabs, silero

class VoiceAgent:
    """Basic voice agent implementation"""
    
    def __init__(self):
        self.session = None
        self.room_name = os.getenv('ROOM_NAME')
        logger.info(f"Voice Agent initialized for room: {self.room_name}")
    
    async def entrypoint(self, ctx: JobContext):
        """Main entry point for the agent"""
        try:
            logger.info(f"Starting agent for room: {ctx.room.name}")
            
            # Connect to room
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            logger.info(f"Connected to room: {ctx.room.name}")
            
            # Wait for participant
            participant = await self._wait_for_participant(ctx)
            if not participant:
                logger.error("No participant joined within timeout")
                return
            
            logger.info(f"Participant joined: {participant.identity}")
            
            # Create agent
            from livekit.agents import Agent
            
            agent = Agent(
                instructions="""You are a helpful voice assistant. 
                Keep your responses brief and conversational.
                You're having a voice conversation, so be natural and friendly.""",
                tools=[]  # No tools for basic version
            )
            
            # Create voice session
            self.session = AgentSession(
                llm=openai.realtime.RealtimeModel(
                    model="gpt-4o-realtime-preview",
                    modalities=["text"],
                    temperature=0.7,
                ),
                tts=elevenlabs.TTS(
                    voice_id=os.getenv("ELEVEN_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
                    model_id=os.getenv("ELEVEN_MODEL_ID", "eleven_turbo_v2_5"),
                    api_key=os.getenv("ELEVEN_API_KEY"),
                ),
                vad=silero.VAD.load(
                    min_silence_duration=0.5,
                    min_speech_duration=0.3,
                ),
                agent=agent,
                chat_ctx=llm.ChatContext(),
            )
            
            # Start the session
            self.session.start(ctx.room, participant)
            logger.info("Voice session started")
            
            # Wait for completion
            await self.session.wait_for_completion()
            
        except Exception as e:
            logger.error(f"Agent error: {e}", exc_info=True)
        finally:
            logger.info("Agent shutting down")
    
    async def _wait_for_participant(self, ctx, timeout=30):
        """Wait for a participant to join"""
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            if ctx.room.remote_participants:
                return next(iter(ctx.room.remote_participants.values()))
            await asyncio.sleep(0.5)
        
        return None

async def main():
    """Main function to run the agent"""
    logger.info("Starting Voice Agent...")
    
    # Get configuration from environment
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    logger.info(f"LiveKit URL: {url}")
    logger.info(f"Room: {os.getenv('ROOM_NAME')}")
    
    # Create agent
    agent = VoiceAgent()
    
    # Run with LiveKit CLI
    await cli.run_app(
        WorkerOptions(
            entrypoint_fnc=agent.entrypoint,
            api_key=api_key,
            api_secret=api_secret,
            ws_url=url,
        )
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
    except Exception as e:
        logger.error(f"Agent crashed: {e}", exc_info=True)
        sys.exit(1)
```

### Step 4.3: Setup Python Environment
```bash
# Navigate to agent directory
cd src/agent

# Run setup script
python3 setup.py

# Or manually:
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `src/agent/requirements.txt`:
```
livekit==0.2.25
livekit-agents==0.10.4
livekit-plugins-openai==0.9.1
livekit-plugins-elevenlabs==0.7.5
livekit-plugins-silero==0.6.5
python-dotenv==1.0.0
aiohttp==3.11.10
```

## Day 5: Integration Testing

### Step 5.1: Create Integration Test
Create `test-livekit.js`:
```javascript
/**
 * LiveKit Integration Test
 */
const SettingsService = require('./src/main/services/SettingsService');
const LiveKitService = require('./src/main/services/LiveKitService');

async function testLiveKit() {
    console.log('🧪 Testing LiveKit Integration...\n');
    
    try {
        // Initialize settings
        await SettingsService.initialize();
        console.log('✅ Settings initialized');
        
        // Initialize LiveKit
        const livekit = new LiveKitService(SettingsService);
        const initialized = await livekit.initialize();
        
        if (!initialized) {
            console.error('❌ LiveKit not configured properly');
            console.log('\nPlease check your .env file has:');
            console.log('  LIVEKIT_URL=...');
            console.log('  LIVEKIT_API_KEY=...');
            console.log('  LIVEKIT_API_SECRET=...');
            return;
        }
        
        console.log('✅ LiveKit initialized');
        
        // Test token generation
        console.log('\n📝 Testing token generation...');
        const token = await livekit.generateToken('test-room', 'test-user');
        console.log('✅ Token generated:', token.substring(0, 50) + '...');
        
        // Test session start (without agent)
        console.log('\n🚀 Testing session start...');
        const result = await livekit.startSession({ startAgent: false });
        
        if (result.success) {
            console.log('✅ Session started successfully');
            console.log('  Room:', result.roomName);
            console.log('  URL:', result.url);
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Stop session
            console.log('\n🛑 Stopping session...');
            const stopResult = await livekit.stopSession();
            console.log(stopResult.success ? '✅ Session stopped' : '❌ Failed to stop');
        } else {
            console.error('❌ Failed to start session:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testLiveKit().then(() => {
    console.log('\n✨ LiveKit test complete!');
    process.exit(0);
});
```

### Step 5.2: Test Python Agent
Create `src/agent/test_agent.py`:
```python
#!/usr/bin/env python3
"""Test Python agent setup"""
import sys
import os

print("🧪 Testing Python Agent Setup\n")

# Check Python version
print(f"Python version: {sys.version}")

# Check imports
try:
    import livekit
    print("✅ livekit imported")
except ImportError:
    print("❌ livekit not installed")

try:
    import livekit.agents
    print("✅ livekit.agents imported")
except ImportError:
    print("❌ livekit.agents not installed")

try:
    from livekit.plugins import openai, elevenlabs, silero
    print("✅ All plugins imported")
except ImportError as e:
    print(f"❌ Plugin import failed: {e}")

# Check environment
print("\nEnvironment variables:")
for var in ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'OPENAI_API_KEY']:
    value = os.getenv(var)
    if value:
        print(f"  ✅ {var}: {'Set' if var.endswith('KEY') else value}")
    else:
        print(f"  ❌ {var}: Not set")

print("\n✨ Test complete!")
```

## Phase 2 Checkpoint Deliverables

### ✅ Your deliverables for User 2:

1. **LiveKit Service** working and generating real tokens
2. **Window Service** managing window state
3. **Python Agent** basic version running
4. **Real IPC responses**:
   - `voice:start` returns real LiveKit connection details
   - `voice:stop` properly stops session
   - Window state persists

5. **Test results**:
   ```bash
   npm run test:livekit  # Should pass
   cd src/agent && python3 test_agent.py  # Should pass
   ```

### 📦 Files to commit:
```bash
git add src/main/services/WindowService.js
git add src/main/services/LiveKitService.js
git add src/agent/
git commit -m "Backend Phase 2: LiveKit service and Python agent foundation"
git push origin backend-dev
```

### 📝 Communication to User 2:
```
Backend Phase 2 Complete! ✅

LiveKit Integration Ready:
- Real token generation working
- Python agent starts with session
- Window state management active

IPC Updates:
- voice:start now returns REAL LiveKit credentials
- Format: {success: true, url: "wss://...", token: "...", roomName: "voice-xxxxx"}
- voice:stop properly terminates agent

New events sent to renderer:
- voice:status → {connected: boolean, room?: string}
- voice:error → {message: string}

Ready for LiveKit client connection!
Backend branch: backend-dev
```

## Troubleshooting

### Common Issues:

1. **LiveKit token generation fails**
```bash
# Check API credentials
cat .env | grep LIVEKIT

# Test with curl
curl -X POST https://your-server.livekit.cloud/twirp/livekit.RoomService/CreateRoom \
  -H "Authorization: Bearer YOUR_API_KEY:YOUR_API_SECRET"
```

2. **Python agent won't start**
```bash
# Check Python installation
which python3
python3 --version

# Test agent directly
cd src/agent
source venv/bin/activate
LIVEKIT_URL=test python3 voice_agent.py
```

3. **Window state not saving**
```bash
# Check settings file
cat ~/Library/Application\ Support/voice-overlay/config.json
```

## Next Phase Preview
In Phase 3, you will:
- Complete MCP implementation
- Add all MCP tools
- Enhance error handling
- Add monitoring and logging
- Finalize production readiness

Phase 2 is complete! LiveKit backend is ready for User 2's client connection.