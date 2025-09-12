/**
 * LiveKit Client for Listen Window (Renderer Process)
 * Handles LiveKit room connection in the browser context
 */

// We'll load LiveKit from CDN or use dynamic imports to avoid bundling issues

class LiveKitClient {
    constructor() {
        this.room = null;
        this.localTracks = [];
        this.remoteTracks = new Map();
        this.isConnected = false;
        this.livekitAPI = null;
        this.isMuted = false;  // Track mute state
        
        console.log('[LiveKitClient] Initialized in renderer process');
    }
    
    /**
     * Load LiveKit SDK dynamically
     */
    async loadLiveKitSDK() {
        if (this.livekitAPI) {
            return this.livekitAPI;
        }
        
        try {
            console.log('[LiveKitClient] Loading LiveKit SDK...');
            
            // Load from CDN (more reliable in Electron renderer)
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (window.LivekitClient) {
                    this.livekitAPI = window.LivekitClient;
                    console.log('[LiveKitClient] LiveKit SDK already loaded');
                    resolve(this.livekitAPI);
                    return;
                }
                
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2.1.2/dist/livekit-client.umd.min.js';
                script.onload = () => {
                    // The CDN version exposes LivekitClient on window
                    this.livekitAPI = window.LivekitClient || window.LiveKit;
                    
                    if (!this.livekitAPI) {
                        console.error('[LiveKitClient] SDK loaded but not found on window');
                        reject(new Error('LiveKit SDK not found after loading'));
                        return;
                    }
                    
                    console.log('[LiveKitClient] Loaded LiveKit SDK from CDN successfully');
                    console.log('[LiveKitClient] Available exports:', Object.keys(this.livekitAPI));
                    resolve(this.livekitAPI);
                };
                script.onerror = (error) => {
                    console.error('[LiveKitClient] Failed to load from CDN:', error);
                    reject(new Error('Failed to load LiveKit SDK from CDN'));
                };
                document.head.appendChild(script);
            });
        } catch (error) {
            console.error('[LiveKitClient] Failed to load LiveKit SDK:', error);
            throw error;
        }
    }
    
    /**
     * Connect to LiveKit room
     */
    async connect(url, token) {
        try {
            console.log('[LiveKitClient] Connecting to room...');
            console.log('[LiveKitClient] URL:', url);
            console.log('[LiveKitClient] Token (first 50 chars):', token ? token.substring(0, 50) + '...' : 'NO TOKEN');
            
            if (!url || !token) {
                throw new Error('Missing URL or token for LiveKit connection');
            }
            
            // Load LiveKit SDK first
            const livekit = await this.loadLiveKitSDK();
            
            // Create room instance with additional options
            this.room = new livekit.Room({
                adaptiveStream: true,
                dynacast: true,
                stopLocalTrackOnUnpublish: true,
                reconnectPolicy: {
                    nextRetryDelayInMs: (context) => {
                        // Exponential backoff with jitter
                        return Math.min(5000, Math.random() * 300 * Math.pow(2, context.retryCount));
                    },
                    maxRetries: 10,
                },
                logLevel: 'debug', // Enable debug logging
            });
            
            // Set up event handlers BEFORE connecting
            this.setupEventHandlers();
            
            // Add connection quality monitoring
            this.room.on(livekit.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
                console.log('[LiveKitClient] Connection quality changed:', quality, 'for', participant?.identity);
            });
            
            // Connect to the room
            console.log('[LiveKitClient] Attempting connection...');
            await this.room.connect(url, token);
            
            this.isConnected = true;
            console.log('[LiveKitClient] Successfully connected to room:', this.room.name);
            console.log('[LiveKitClient] Local participant:', this.room.localParticipant?.identity);
            
            // Create and publish local microphone track (only if not muted)
            if (!this.isMuted) {
                await this.publishMicrophone();
            } else {
                console.log('[LiveKitClient] Skipping microphone publish - already muted');
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Connection failed:', error);
            console.error('[LiveKitClient] Error details:', {
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack
            });
            
            // Send detailed error to main process
            window.electronAPI.sendLiveKitEvent('error', {
                type: 'connection',
                error: error.message,
                code: error.code,
                details: error.toString()
            });
            
            this.isConnected = false;
            throw error;
        }
    }
    
    /**
     * Set up room event handlers
     */
    setupEventHandlers() {
        if (!this.room || !this.livekitAPI) return;
        
        const { RoomEvent, Track } = this.livekitAPI;
        
        this.room.on(RoomEvent.Connected, () => {
            console.log('[LiveKitClient] Room connected');
            window.electronAPI.sendLiveKitEvent('connected', { 
                roomName: this.room.name,
                localParticipant: this.room.localParticipant?.identity 
            });
        });
        
        this.room.on(RoomEvent.Disconnected, (reason) => {
            console.log('[LiveKitClient] Room disconnected:', reason);
            this.isConnected = false;
            window.electronAPI.sendLiveKitEvent('disconnected', { reason });
        });
        
        this.room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log('[LiveKitClient] Participant connected:', participant.identity);
            
            // Check if this is the agent
            if (participant.identity && participant.identity.includes('agent')) {
                window.electronAPI.sendLiveKitEvent('agentConnected', {
                    identity: participant.identity
                });
            }
        });
        
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('[LiveKitClient] Track subscribed:', track.kind, 'from', participant.identity);
            
            // Handle agent audio track
            if (participant.identity && participant.identity.includes('agent') && track.kind === Track.Kind.Audio) {
                this.handleAgentAudioTrack(track);
            }
        });
        
        this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('[LiveKitClient] Track unsubscribed:', track.kind, 'from', participant.identity);
            
            if (track.kind === Track.Kind.Audio) {
                const audioElement = this.remoteTracks.get(track.sid);
                if (audioElement) {
                    track.detach(audioElement);
                    audioElement.remove();
                    this.remoteTracks.delete(track.sid);
                }
            }
        });
        
        this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const agentSpeaking = speakers.some(speaker => 
                speaker.identity && speaker.identity.includes('agent')
            );
            
            window.electronAPI.sendLiveKitEvent('agentSpeaking', { 
                speaking: agentSpeaking 
            });
        });
        
        this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
            console.log('[LiveKitClient] Connection state changed:', state);
            window.electronAPI.sendLiveKitEvent('connectionStateChanged', { state });
        });
        
        this.room.on(RoomEvent.MediaDevicesError, (error) => {
            console.error('[LiveKitClient] Media devices error:', error);
            window.electronAPI.sendLiveKitEvent('error', { 
                type: 'mediaDevices',
                error: error.message 
            });
        });
    }
    
    /**
     * Publish local microphone to the room
     */
    async publishMicrophone() {
        try {
            console.log('[LiveKitClient] Creating local microphone track...');
            
            const { createLocalTracks, Track } = this.livekitAPI;
            
            const tracks = await createLocalTracks({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            
            this.localTracks = tracks;
            
            // Publish tracks to the room
            for (const track of tracks) {
                if (track.kind === Track.Kind.Audio) {
                    await this.room.localParticipant.publishTrack(track);
                    console.log('[LiveKitClient] Published microphone track');
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Failed to publish microphone:', error);
            window.electronAPI.sendLiveKitEvent('error', { 
                type: 'microphone',
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Handle agent's audio track
     */
    handleAgentAudioTrack(track) {
        console.log('[LiveKitClient] Handling agent audio track');
        
        // Create audio element for playback
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        
        // Attach the track to the audio element
        track.attach(audioElement);
        
        // Store reference
        this.remoteTracks.set(track.sid, audioElement);
        
        // Add to document (hidden)
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
        
        console.log('[LiveKitClient] Agent audio track attached and playing');
        
        window.electronAPI.sendLiveKitEvent('agentAudioStarted', {
            trackId: track.sid
        });
    }
    
    /**
     * Disconnect from the room
     */
    async disconnect() {
        try {
            console.log('[LiveKitClient] Disconnecting from room...');
            
            // Stop all local tracks
            for (const track of this.localTracks) {
                track.stop();
                await this.room?.localParticipant?.unpublishTrack(track);
            }
            this.localTracks = [];
            
            // Clean up remote audio elements
            for (const [sid, audioElement] of this.remoteTracks) {
                audioElement.remove();
            }
            this.remoteTracks.clear();
            
            // Disconnect from room
            if (this.room) {
                await this.room.disconnect();
                this.room = null;
            }
            
            this.isConnected = false;
            console.log('[LiveKitClient] Disconnected successfully');
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Disconnect error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Mute/unmute the local microphone
     */
    async setMicrophoneMuted(muted) {
        try {
            // Store mute state
            this.isMuted = muted;
            
            if (!this.room || !this.room.localParticipant) {
                console.error('[LiveKitClient] Cannot mute: not connected to room');
                return { success: false, error: 'Not connected to room' };
            }

            if (!this.livekitAPI) {
                console.error('[LiveKitClient] LiveKit API not loaded');
                return { success: false, error: 'LiveKit API not loaded' };
            }

            const { Track } = this.livekitAPI;
            console.log(`[LiveKitClient] ${muted ? 'MUTING' : 'UNMUTING'} microphone`);
            
            if (muted) {
                // Find and unpublish ALL audio tracks
                const audioPublications = Array.from(this.room.localParticipant.trackPublications.values())
                    .filter(pub => pub.track && pub.track.kind === Track.Kind.Audio);
                
                console.log(`[LiveKitClient] Found ${audioPublications.length} audio track(s) to unpublish`);
                
                for (const audioPublication of audioPublications) {
                    console.log('[LiveKitClient] Unpublishing audio track:', audioPublication.trackName);
                    await this.room.localParticipant.unpublishTrack(audioPublication.track);
                    
                    // Only stop the track if it exists and has a stop method
                    if (audioPublication.track && typeof audioPublication.track.stop === 'function') {
                        audioPublication.track.stop();
                    }
                    
                    this.localTracks = this.localTracks.filter(t => t !== audioPublication.track);
                }
                
                if (audioPublications.length === 0) {
                    console.log('[LiveKitClient] No audio tracks to unpublish - already muted');
                } else {
                    console.log('[LiveKitClient] ✅ All audio tracks unpublished and stopped');
                }
            } else {
                // Check if we already have an audio track
                const existingAudio = Array.from(this.room.localParticipant.trackPublications.values())
                    .find(pub => pub.track && pub.track.kind === Track.Kind.Audio);
                
                if (existingAudio) {
                    console.log('[LiveKitClient] Audio track already exists - skipping creation');
                    return { success: true };
                }
                
                // Create and publish a new audio track
                console.log('[LiveKitClient] Creating new audio track');
                const tracks = await this.livekitAPI.createLocalTracks({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });
                
                for (const track of tracks) {
                    if (track.kind === Track.Kind.Audio) {
                        await this.room.localParticipant.publishTrack(track, {
                            name: 'microphone',
                            source: Track.Source.Microphone,
                        });
                        this.localTracks.push(track);
                        console.log('[LiveKitClient] ✅ New audio track published');
                    }
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('[LiveKitClient] Error setting microphone mute:', error);
            console.error('[LiveKitClient] Error stack:', error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            roomName: this.room?.name,
            localParticipant: this.room?.localParticipant?.identity,
            remoteParticipants: this.room?.participants ? 
                Array.from(this.room.participants.values()).map(p => p.identity) : [],
            connectionState: this.room?.state
        };
    }
}

// Export for use in the Listen window
export default LiveKitClient;