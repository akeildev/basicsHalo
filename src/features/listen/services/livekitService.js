const { Room, RoomEvent, Track, createLocalTracks, VideoPresets } = require('livekit-client');
const { AccessToken } = require('livekit-server-sdk');
const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * LiveKit Integration Service for Halo
 * Manages LiveKit room connections and bridges with existing audio infrastructure
 */
class LiveKitService extends EventEmitter {
    constructor() {
        super();
        
        // LiveKit configuration
        this.config = {
            url: process.env.LIVEKIT_URL || 'wss://halo-ecujaon7.livekit.cloud',
            apiKey: process.env.LIVEKIT_API_KEY || 'APIudWnyrLubj9x',
            apiSecret: process.env.LIVEKIT_API_SECRET || 'vgedviCrLgHGL2lNbLs9xcj5M5LRR5hFfXKrhKykjDE',
        };
        
        // Room state
        this.room = null;
        this.localTracks = [];
        this.remoteTracks = new Map();
        this.isConnected = false;
        this.agentProcess = null;
        
        // Audio context for playback
        this.audioContext = null;
        this.audioElement = null;
        
        console.log('\n========================================');
        console.log('[LiveKitService] 🚀 Service Initialized');
        console.log('========================================');
        console.log('[LiveKitService] Configuration:');
        console.log('  - URL:', this.config.url);
        console.log('  - API Key:', this.config.apiKey ? `${this.config.apiKey.substring(0, 10)}...` : 'NOT SET');
        console.log('  - API Secret:', this.config.apiSecret ? 'SET (hidden)' : 'NOT SET');
        console.log('========================================\n');
    }
    
    /**
     * Generate access token for room connection
     */
    generateToken(roomName, participantName = 'halo-user') {
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
        });
        
        return token.toJwt();
    }
    
    /**
     * Connect to a LiveKit room
     */
    async connectToRoom(roomName, options = {}) {
        try {
            console.log('\n========================================');
            console.log('[LiveKitService] 🔌 CONNECTING TO LIVEKIT ROOM');
            console.log('========================================');
            console.log('[LiveKitService] Room Name:', roomName);
            console.log('[LiveKitService] Options:', JSON.stringify(options, null, 2));
            
            // Create room instance
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                ...options
            });
            console.log('[LiveKitService] ✅ Room instance created');
            
            // Set up room event handlers
            this.setupRoomEventHandlers();
            console.log('[LiveKitService] ✅ Event handlers configured');
            
            // Generate token
            console.log('[LiveKitService] 🔑 Generating access token...');
            const token = this.generateToken(roomName);
            console.log('[LiveKitService] ✅ Token generated successfully');
            
            // Connect to room
            console.log('[LiveKitService] 🌐 Connecting to LiveKit Cloud...');
            console.log('[LiveKitService] URL:', this.config.url);
            await this.room.connect(this.config.url, token);
            
            this.isConnected = true;
            console.log('[LiveKitService] ✅ SUCCESSFULLY CONNECTED TO ROOM!');
            console.log('[LiveKitService] Room SID:', this.room.sid || 'pending');
            console.log('[LiveKitService] Local Participant:', this.room.localParticipant?.identity || 'unknown');
            
            // Publish local audio if microphone access is available
            await this.publishLocalAudio();
            
            // Start the Python agent if in agent mode
            if (options.startAgent) {
                console.log('[LiveKitService] 🤖 Starting Python agent...');
                await this.startPythonAgent(roomName);
            }
            
            console.log('========================================\n');
            this.emit('connected', { roomName });
            return true;
            
        } catch (error) {
            console.error('\n========================================');
            console.error('[LiveKitService] ❌ CONNECTION FAILED!');
            console.error('[LiveKitService] Error:', error.message);
            console.error('[LiveKitService] Stack:', error.stack);
            console.error('========================================\n');
            this.emit('error', { type: 'connection', error });
            return false;
        }
    }
    
    /**
     * Disconnect from current room
     */
    async disconnect() {
        try {
            console.log('[LiveKitService] Disconnecting from room');
            
            // Stop agent if running
            if (this.agentProcess) {
                await this.stopPythonAgent();
            }
            
            // Unpublish local tracks
            for (const track of this.localTracks) {
                track.stop();
                await this.room?.localParticipant?.unpublishTrack(track);
            }
            this.localTracks = [];
            
            // Disconnect from room
            if (this.room) {
                await this.room.disconnect();
                this.room = null;
            }
            
            this.isConnected = false;
            this.remoteTracks.clear();
            
            console.log('[LiveKitService] Disconnected successfully');
            this.emit('disconnected');
            
        } catch (error) {
            console.error('[LiveKitService] Error during disconnect:', error);
            this.emit('error', { type: 'disconnect', error });
        }
    }
    
    /**
     * Publish local microphone audio to room
     */
    async publishLocalAudio() {
        try {
            console.log('[LiveKitService] Publishing local audio');
            
            // Create local audio track
            const tracks = await createLocalTracks({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            
            // Publish tracks to room
            for (const track of tracks) {
                if (track.kind === Track.Kind.Audio) {
                    await this.room.localParticipant.publishTrack(track);
                    this.localTracks.push(track);
                    console.log('[LiveKitService] Published audio track');
                }
            }
            
            this.emit('localAudioPublished');
            return true;
            
        } catch (error) {
            console.error('[LiveKitService] Failed to publish local audio:', error);
            this.emit('error', { type: 'publish', error });
            return false;
        }
    }
    
    /**
     * Setup room event handlers
     */
    setupRoomEventHandlers() {
        if (!this.room) return;
        
        // Handle participant connections
        this.room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log('[LiveKitService] Participant connected:', participant.identity);
            this.emit('participantConnected', { participant: participant.identity });
        });
        
        this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            console.log('[LiveKitService] Participant disconnected:', participant.identity);
            this.emit('participantDisconnected', { participant: participant.identity });
        });
        
        // Handle track subscriptions (agent audio)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('[LiveKitService] Track subscribed:', track.kind, 'from', participant.identity);
            
            if (track.kind === Track.Kind.Audio) {
                this.handleRemoteAudioTrack(track, participant);
            }
        });
        
        this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('[LiveKitService] Track unsubscribed:', track.kind, 'from', participant.identity);
            
            if (track.kind === Track.Kind.Audio) {
                this.remoteTracks.delete(participant.identity);
            }
        });
        
        // Handle data messages
        this.room.on(RoomEvent.DataReceived, (payload, participant) => {
            try {
                const data = JSON.parse(new TextDecoder().decode(payload));
                console.log('[LiveKitService] Data received:', data);
                this.emit('dataReceived', { data, participant: participant?.identity });
            } catch (error) {
                console.error('[LiveKitService] Error parsing data message:', error);
            }
        });
        
        // Handle connection quality
        this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            console.log('[LiveKitService] Connection quality:', quality, 'for', participant.identity);
            this.emit('connectionQuality', { quality, participant: participant.identity });
        });
        
        // Handle reconnection
        this.room.on(RoomEvent.Reconnecting, () => {
            console.log('[LiveKitService] Reconnecting to room...');
            this.emit('reconnecting');
        });
        
        this.room.on(RoomEvent.Reconnected, () => {
            console.log('[LiveKitService] Reconnected to room');
            this.emit('reconnected');
        });
        
        // Handle disconnection
        this.room.on(RoomEvent.Disconnected, (reason) => {
            console.log('[LiveKitService] Disconnected from room:', reason);
            this.isConnected = false;
            this.emit('disconnected', { reason });
        });
    }
    
    /**
     * Handle remote audio track (from agent)
     */
    handleRemoteAudioTrack(track, participant) {
        try {
            // Store track reference
            this.remoteTracks.set(participant.identity, track);
            
            // Attach to audio element for playback
            if (!this.audioElement) {
                this.audioElement = document.createElement('audio');
                this.audioElement.autoplay = true;
                document.body.appendChild(this.audioElement);
            }
            
            track.attach(this.audioElement);
            
            console.log('[LiveKitService] Remote audio track attached for playback');
            this.emit('agentAudioStarted', { participant: participant.identity });
            
        } catch (error) {
            console.error('[LiveKitService] Error handling remote audio track:', error);
            this.emit('error', { type: 'audio', error });
        }
    }
    
    /**
     * Start Python agent process
     */
    async startPythonAgent(roomName) {
        try {
            console.log('\n========================================');
            console.log('[LiveKitService] 🤖 STARTING PYTHON AGENT');
            console.log('========================================');
            console.log('[LiveKitService] Room:', roomName);
            
            // Get OpenAI key from settings
            const settingsService = require('../../settings/settingsService');
            const settings = settingsService.getSettings();
            const openaiKey = settings?.openaiApiKey || settings?.openaiKey;
            
            console.log('[LiveKitService] 🔑 API Keys Status:');
            console.log('  - OpenAI Key:', openaiKey ? `${openaiKey.substring(0, 7)}... (from settings)` : '❌ NOT FOUND IN SETTINGS');
            console.log('  - ElevenLabs Key:', 'sk_a0a2444b... (configured)');
            console.log('  - LiveKit Key:', this.config.apiKey ? `${this.config.apiKey.substring(0, 10)}...` : '❌ NOT SET');
            
            if (!openaiKey) {
                console.error('[LiveKitService] ⚠️  WARNING: No OpenAI API key found in settings!');
                console.error('[LiveKitService] The agent will not be able to use OpenAI Realtime API');
                console.error('[LiveKitService] Please add your OpenAI API key in Settings');
            }
            
            // Path to agent script
            const agentPath = path.join(__dirname, '../../../agent/run_agent.py');
            const venvPath = path.join(__dirname, '../../../agent/venv/bin/python');
            
            console.log('[LiveKitService] 📁 Agent paths:');
            console.log('  - Script:', agentPath);
            console.log('  - Python:', venvPath);
            
            // Check if venv exists
            const fs = require('fs');
            const useVenv = fs.existsSync(venvPath);
            const pythonCmd = useVenv ? venvPath : 'python3';
            
            console.log('[LiveKitService] 🐍 Python:', useVenv ? 'Using virtual environment' : 'Using system Python');
            
            // Set up environment for agent
            const env = {
                ...process.env,
                LIVEKIT_URL: this.config.url,
                LIVEKIT_API_KEY: this.config.apiKey,
                LIVEKIT_API_SECRET: this.config.apiSecret,
                OPENAI_API_KEY: openaiKey || '',
                ELEVENLABS_API_KEY: 'sk_a0a2444bdfa08d1dabfa394b6cf36634d99d7c5de8ef72b7',
                AGENT_ROOM_NAME: roomName,
                PYTHONUNBUFFERED: '1',  // For real-time output
                LOG_LEVEL: 'DEBUG',      // Enable debug logging
            };
            
            console.log('[LiveKitService] 🚀 Spawning Python process...');
            
            // Spawn Python process
            this.agentProcess = spawn(pythonCmd, [agentPath], {
                env,
                cwd: path.dirname(agentPath),
            });
            
            console.log('[LiveKitService] ✅ Python process spawned with PID:', this.agentProcess.pid);
            
            // Handle agent output
            this.agentProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.log('[🤖 PythonAgent]', output);
                }
            });
            
            this.agentProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                if (error) {
                    console.error('[🤖 PythonAgent ERROR]', error);
                }
            });
            
            this.agentProcess.on('error', (error) => {
                console.error('[LiveKitService] ❌ Failed to spawn Python process:', error);
                this.emit('error', { type: 'agent_spawn', error });
            });
            
            this.agentProcess.on('close', (code) => {
                console.log('[LiveKitService] 🛑 Python agent process exited with code:', code);
                this.agentProcess = null;
                this.emit('agentStopped', { code });
            });
            
            console.log('[LiveKitService] ✅ Python agent started successfully!');
            console.log('========================================\n');
            this.emit('agentStarted');
            
        } catch (error) {
            console.error('\n========================================');
            console.error('[LiveKitService] ❌ FAILED TO START PYTHON AGENT!');
            console.error('[LiveKitService] Error:', error.message);
            console.error('[LiveKitService] Stack:', error.stack);
            console.error('========================================\n');
            this.emit('error', { type: 'agent', error });
        }
    }
    
    /**
     * Stop Python agent process
     */
    async stopPythonAgent() {
        if (this.agentProcess) {
            console.log('[LiveKitService] Stopping Python agent');
            this.agentProcess.kill('SIGTERM');
            
            // Give it time to clean up
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force kill if still running
            if (this.agentProcess) {
                this.agentProcess.kill('SIGKILL');
            }
            
            this.agentProcess = null;
            console.log('[LiveKitService] Python agent stopped');
        }
    }
    
    /**
     * Send data message to room
     */
    async sendData(data) {
        if (!this.room || !this.isConnected) {
            console.warn('[LiveKitService] Cannot send data - not connected');
            return false;
        }
        
        try {
            const payload = new TextEncoder().encode(JSON.stringify(data));
            await this.room.localParticipant.publishData(payload, { reliable: true });
            console.log('[LiveKitService] Data sent:', data);
            return true;
        } catch (error) {
            console.error('[LiveKitService] Failed to send data:', error);
            return false;
        }
    }
    
    /**
     * Mute/unmute local audio
     */
    async setMicrophoneMuted(muted) {
        for (const track of this.localTracks) {
            if (track.kind === Track.Kind.Audio) {
                await track.setMuted(muted);
                console.log('[LiveKitService] Microphone muted:', muted);
                this.emit('microphoneMuted', { muted });
            }
        }
    }
    
    /**
     * Get current room stats
     */
    getRoomStats() {
        if (!this.room) return null;
        
        return {
            roomName: this.room.name,
            isConnected: this.isConnected,
            participants: this.room.participants.size,
            localTracks: this.localTracks.length,
            remoteTracks: this.remoteTracks.size,
            agentRunning: !!this.agentProcess,
        };
    }
    
    /**
     * Clean up resources
     */
    async cleanup() {
        await this.disconnect();
        
        if (this.audioElement) {
            this.audioElement.remove();
            this.audioElement = null;
        }
        
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
    }
}

module.exports = new LiveKitService();