const { AccessToken } = require('livekit-server-sdk');
const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * LiveKit Main Process Service for Halo
 * Manages token generation and Python agent process
 */
class LiveKitMainService extends EventEmitter {
    constructor() {
        super();
        
        // LiveKit configuration
        this.config = {
            url: process.env.LIVEKIT_URL || 'wss://halo-ecujaon7.livekit.cloud',
            apiKey: process.env.LIVEKIT_API_KEY || 'APIudWnyrLubj9x',
            apiSecret: process.env.LIVEKIT_API_SECRET || 'vgedviCrLgHGL2lNbLs9xcj5M5LRR5hFfXKrhKykjDE',
        };
        
        // Agent process
        this.agentProcess = null;
        this.currentRoomName = null;
        
        console.log('\n========================================');
        console.log('[LiveKitMainService] 🚀 Service Initialized');
        console.log('========================================');
        console.log('[LiveKitMainService] Configuration:');
        console.log('  - URL:', this.config.url);
        console.log('  - API Key:', this.config.apiKey ? `${this.config.apiKey.substring(0, 10)}...` : 'NOT SET');
        console.log('  - API Secret:', this.config.apiSecret ? 'SET (hidden)' : 'NOT SET');
        console.log('========================================\n');
    }
    
    /**
     * Generate access token for room connection
     */
    async generateToken(roomName, participantName = 'halo-user') {
        console.log('[LiveKitMainService] 🔑 Generating access token...');
        console.log('[LiveKitMainService] Room:', roomName);
        console.log('[LiveKitMainService] Participant:', participantName);
        console.log('[LiveKitMainService] API Key:', this.config.apiKey);
        console.log('[LiveKitMainService] Has API Secret:', !!this.config.apiSecret);
        
        const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
            identity: participantName,
            ttl: '10h',
        });
        
        token.addGrant({ 
            roomJoin: true, 
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canUpdateOwnMetadata: true,
            hidden: false,
        });
        
        const jwt = await token.toJwt();
        console.log('[LiveKitMainService] ✅ Token generated successfully');
        console.log('[LiveKitMainService] Token (first 50 chars):', jwt.substring(0, 50) + '...');
        return jwt;
    }
    
    /**
     * Start a LiveKit session with agent
     */
    async startSession(options = {}) {
        try {
            console.log('\n========================================');
            console.log('[LiveKitMainService] 🔌 STARTING LIVEKIT SESSION');
            console.log('========================================');
            
            // Generate room name
            this.currentRoomName = `halo-room-${uuidv4()}`;
            console.log('[LiveKitMainService] Room Name:', this.currentRoomName);
            
            // Generate token for user
            const token = await this.generateToken(this.currentRoomName);
            
            // Start Python agent if requested
            if (options.startAgent) {
                await this.startPythonAgent(this.currentRoomName);
            }
            
            // Return connection details for renderer
            return {
                success: true,
                livekit: {
                    url: this.config.url,
                    token: token,
                    roomName: this.currentRoomName
                }
            };
        } catch (error) {
            console.error('[LiveKitMainService] ❌ Failed to start session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Start the Python voice agent
     */
    async startPythonAgent(roomName) {
        return new Promise((resolve, reject) => {
            try {
                console.log('\n========================================');
                console.log('[LiveKitMainService] 🤖 STARTING PYTHON AGENT');
                console.log('========================================');
                
                const agentPath = path.join(__dirname, '..', '..', '..', 'agent', 'voice_agent.py');
                console.log('[LiveKitMainService] Agent path:', agentPath);
                
                // Get OpenAI API key from settings
                const Store = require('electron-store');
                const store = new Store({
                    name: 'pickle-clueless-settings'  // Use the same store name as SettingsService
                });
                
                // Get settings from the correct user key
                const userSettings = store.get('users.default', {});
                console.log('[LiveKitMainService] User settings keys:', Object.keys(userSettings));
                
                const openaiKey = userSettings.openaiApiKey || userSettings.openaiKey; // Support both key names
                
                if (!openaiKey) {
                    console.error('[LiveKitMainService] ❌ OpenAI API key not found in settings');
                    console.error('[LiveKitMainService] Available settings:', Object.keys(userSettings));
                    reject(new Error('OpenAI API key not configured. Please set it in Settings.'));
                    return;
                }
                
                console.log('[LiveKitMainService] ✅ OpenAI API key found in settings');
                
                // Prepare environment variables
                const env = {
                    ...process.env,
                    LIVEKIT_URL: this.config.url,
                    LIVEKIT_API_KEY: this.config.apiKey,
                    LIVEKIT_API_SECRET: this.config.apiSecret,
                    OPENAI_API_KEY: openaiKey,
                    ELEVEN_API_KEY: 'sk_a0a2444bdfa08d1dabfa394b6cf36634d99d7c5de8ef72b7',  // Your ElevenLabs API key
                    ROOM_NAME: roomName,
                    PYTHONUNBUFFERED: '1'
                };
                
                // Check if we're in a virtual environment
                const venvPath = path.join(__dirname, '..', '..', '..', 'agent', 'venv');
                const pythonPath = path.join(venvPath, 'bin', 'python');
                const fs = require('fs');
                
                let pythonCommand = 'python3';
                if (fs.existsSync(pythonPath)) {
                    pythonCommand = pythonPath;
                    console.log('[LiveKitMainService] Using virtual environment Python:', pythonCommand);
                } else {
                    console.log('[LiveKitMainService] Using system Python');
                }
                
                // Spawn the Python agent process with the correct LiveKit CLI command
                // The agent uses 'connect' command with --room parameter
                this.agentProcess = spawn(pythonCommand, [
                    agentPath, 
                    'connect',
                    '--room', roomName,
                    '--url', this.config.url,
                    '--api-key', this.config.apiKey,
                    '--api-secret', this.config.apiSecret
                ], {
                    env: env,
                    cwd: path.dirname(agentPath)
                });
                
                console.log('[LiveKitMainService] 🚀 Agent process spawned with PID:', this.agentProcess.pid);
                
                // Handle agent output
                this.agentProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.log('[Agent]', output);
                        
                        // Parse agent status messages
                        if (output.includes('Connected to room')) {
                            this.emit('agentConnected', { roomName });
                        } else if (output.includes('Speaking:')) {
                            const speaking = output.includes('Speaking: True');
                            this.emit('agentSpeaking', { speaking });
                        }
                    }
                });
                
                this.agentProcess.stderr.on('data', (data) => {
                    const error = data.toString().trim();
                    if (error && !error.includes('INFO') && !error.includes('DEBUG')) {
                        console.error('[Agent Error]', error);
                    }
                });
                
                this.agentProcess.on('error', (error) => {
                    console.error('[LiveKitMainService] ❌ Agent process error:', error);
                    this.emit('error', { type: 'agentProcess', error });
                    reject(error);
                });
                
                this.agentProcess.on('exit', (code, signal) => {
                    console.log('[LiveKitMainService] Agent process exited. Code:', code, 'Signal:', signal);
                    this.agentProcess = null;
                    this.emit('agentDisconnected', { code, signal });
                });
                
                // Give the agent time to start
                setTimeout(() => {
                    if (this.agentProcess && !this.agentProcess.killed) {
                        console.log('[LiveKitMainService] ✅ Agent started successfully');
                        resolve();
                    } else {
                        reject(new Error('Agent process failed to start'));
                    }
                }, 2000);
                
            } catch (error) {
                console.error('[LiveKitMainService] ❌ Failed to start agent:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Stop the current session
     */
    async stopSession() {
        console.log('\n========================================');
        console.log('[LiveKitMainService] 🛑 STOPPING LIVEKIT SESSION');
        console.log('========================================');
        
        // Stop Python agent
        if (this.agentProcess) {
            console.log('[LiveKitMainService] Stopping Python agent...');
            this.agentProcess.kill('SIGTERM');
            this.agentProcess = null;
        }
        
        this.currentRoomName = null;
        
        console.log('[LiveKitMainService] ✅ Session stopped');
        
        return { success: true };
    }
    
    /**
     * Get current session status
     */
    getStatus() {
        return {
            hasActiveSession: !!this.currentRoomName,
            roomName: this.currentRoomName,
            agentRunning: !!this.agentProcess,
            agentPid: this.agentProcess?.pid
        };
    }
}

module.exports = LiveKitMainService;