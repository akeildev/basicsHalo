const { spawn, exec } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

/**
 * PlatformAudioCapture - Platform-specific system audio capture implementation
 * Handles macOS SystemAudioDump, Windows loopback, and Linux PulseAudio/ALSA
 */
class PlatformAudioCapture extends EventEmitter {
    constructor() {
        super();
        this.platform = process.platform;
        this.isInitialized = false;
        this.isCapturing = false;
        
        // Capture state
        this.captureState = {
            process: null,
            stream: null,
            audioCallback: null,
            config: null
        };
        
        // Platform-specific paths and commands
        this.platformConfig = {
            darwin: {
                systemAudioDumpPath: path.join(__dirname, '../../../../bin/SystemAudioDump'),
                fallbackCommand: 'ffmpeg -f avfoundation -i ":0" -f s16le -ar 24000 -ac 1 -'
            },
            win32: {
                fallbackCommand: 'ffmpeg -f dshow -i audio="Stereo Mix" -f s16le -ar 24000 -ac 1 -'
            },
            linux: {
                pulseAudioCommand: 'parec --format=s16le --rate=24000 --channels=1 --raw /dev/stdout',
                alsaCommand: 'arecord -f S16_LE -r 24000 -c 1 -D pulse /dev/stdout',
                fallbackCommand: 'ffmpeg -f pulse -i default -f s16le -ar 24000 -ac 1 -'
            }
        };
        
        // Audio capabilities
        this.capabilities = {
            systemAudio: false,
            echoCancellation: false,
            loopback: false
        };
    }

    /**
     * Initialize platform audio capture
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log(`[PlatformAudioCapture] Initializing for platform: ${this.platform}`);
            
            // Detect platform capabilities
            await this._detectCapabilities();
            
            this.isInitialized = true;
            console.log('[PlatformAudioCapture] ✅ Initialized successfully');
            console.log('[PlatformAudioCapture] Capabilities:', this.capabilities);
            
            return true;
            
        } catch (error) {
            console.error('[PlatformAudioCapture] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Detect platform-specific audio capabilities
     */
    async _detectCapabilities() {
        try {
            switch (this.platform) {
                case 'darwin':
                    await this._detectMacOSCapabilities();
                    break;
                case 'win32':
                    await this._detectWindowsCapabilities();
                    break;
                case 'linux':
                    await this._detectLinuxCapabilities();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
        } catch (error) {
            console.warn('[PlatformAudioCapture] Capability detection failed:', error.message);
            // Set fallback capabilities
            this.capabilities = {
                systemAudio: true,
                echoCancellation: false,
                loopback: false
            };
        }
    }

    /**
     * Detect macOS audio capabilities
     */
    async _detectMacOSCapabilities() {
        // Check for SystemAudioDump binary
        const systemAudioDumpPath = this.platformConfig.darwin.systemAudioDumpPath;
        if (fs.existsSync(systemAudioDumpPath)) {
            this.capabilities.systemAudio = true;
            this.capabilities.echoCancellation = true;
            console.log('[PlatformAudioCapture] SystemAudioDump binary found');
        } else {
            console.warn('[PlatformAudioCapture] SystemAudioDump binary not found, using fallback');
            this.capabilities.systemAudio = true;
            this.capabilities.echoCancellation = false;
        }
    }

    /**
     * Detect Windows audio capabilities
     */
    async _detectWindowsCapabilities() {
        // Check for Windows audio loopback
        try {
            await this._checkWindowsAudioDevices();
            this.capabilities.systemAudio = true;
            this.capabilities.loopback = true;
            this.capabilities.echoCancellation = true;
        } catch (error) {
            console.warn('[PlatformAudioCapture] Windows audio loopback not available:', error.message);
            this.capabilities.systemAudio = false;
        }
    }

    /**
     * Detect Linux audio capabilities
     */
    async _detectLinuxCapabilities() {
        // Check for PulseAudio
        try {
            await this._checkPulseAudio();
            this.capabilities.systemAudio = true;
            this.capabilities.echoCancellation = true;
            console.log('[PlatformAudioCapture] PulseAudio detected');
        } catch (error) {
            // Check for ALSA
            try {
                await this._checkALSA();
                this.capabilities.systemAudio = true;
                this.capabilities.echoCancellation = false;
                console.log('[PlatformAudioCapture] ALSA detected');
            } catch (alsaError) {
                console.warn('[PlatformAudioCapture] Neither PulseAudio nor ALSA available');
                this.capabilities.systemAudio = false;
            }
        }
    }

    /**
     * Check Windows audio devices
     */
    async _checkWindowsAudioDevices() {
        return new Promise((resolve, reject) => {
            exec('powershell -Command "Get-AudioDevice"', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('Windows audio device check failed'));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Check PulseAudio availability
     */
    async _checkPulseAudio() {
        return new Promise((resolve, reject) => {
            exec('which pulseaudio', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('PulseAudio not found'));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Check ALSA availability
     */
    async _checkALSA() {
        return new Promise((resolve, reject) => {
            exec('which arecord', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('ALSA not found'));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Start system audio capture
     */
    async startSystemAudioCapture(config = {}) {
        try {
            if (this.isCapturing) {
                throw new Error('System audio capture is already active');
            }
            
            if (!this.capabilities.systemAudio) {
                throw new Error('System audio capture not supported on this platform');
            }
            
            console.log('[PlatformAudioCapture] Starting system audio capture...');
            
            // Merge configuration
            const captureConfig = {
                sampleRate: 24000,
                channels: 1,
                format: 'float32',
                ...config
            };
            
            let result;
            switch (this.platform) {
                case 'darwin':
                    result = await this._startMacOSSystemAudio(captureConfig);
                    break;
                case 'win32':
                    result = await this._startWindowsSystemAudio(captureConfig);
                    break;
                case 'linux':
                    result = await this._startLinuxSystemAudio(captureConfig);
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
            if (result.success) {
                this.isCapturing = true;
                this.captureState = {
                    process: result.process,
                    stream: result.stream,
                    audioCallback: this.captureState.audioCallback,
                    config: captureConfig
                };
                
                console.log('[PlatformAudioCapture] ✅ System audio capture started');
                this.emit('systemAudioCaptureStarted', captureConfig);
            }
            
            return result;
            
        } catch (error) {
            console.error('[PlatformAudioCapture] ❌ System audio capture failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start macOS system audio capture
     */
    async _startMacOSSystemAudio(config) {
        try {
            const systemAudioDumpPath = this.platformConfig.darwin.systemAudioDumpPath;
            
            if (fs.existsSync(systemAudioDumpPath)) {
                // Use SystemAudioDump binary
                return await this._startSystemAudioDump(config);
            } else {
                // Use fallback command
                return await this._startFallbackCapture(config);
            }
        } catch (error) {
            console.error('[PlatformAudioCapture] macOS system audio capture failed:', error);
            throw error;
        }
    }

    /**
     * Start SystemAudioDump binary
     */
    async _startSystemAudioDump(config) {
        return new Promise((resolve, reject) => {
            const systemAudioDumpPath = this.platformConfig.darwin.systemAudioDumpPath;
            
            const args = [
                '-r', config.sampleRate.toString(),
                '-c', config.channels.toString(),
                '-f', config.format
            ];
            
            console.log('[PlatformAudioCapture] Starting SystemAudioDump:', systemAudioDumpPath, args);
            
            const process = spawn(systemAudioDumpPath, args);
            
            let audioData = Buffer.alloc(0);
            const chunkSize = config.sampleRate * config.channels * 2; // 2 bytes per sample
            
            process.stdout.on('data', (data) => {
                audioData = Buffer.concat([audioData, data]);
                
                // Process complete chunks
                while (audioData.length >= chunkSize) {
                    const chunk = audioData.slice(0, chunkSize);
                    audioData = audioData.slice(chunkSize);
                    
                    if (this.captureState.audioCallback) {
                        this.captureState.audioCallback(chunk);
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log('[PlatformAudioCapture] SystemAudioDump stderr:', data.toString());
            });
            
            process.on('error', (error) => {
                console.error('[PlatformAudioCapture] SystemAudioDump process error:', error);
                reject(error);
            });
            
            process.on('exit', (code, signal) => {
                console.log(`[PlatformAudioCapture] SystemAudioDump exited with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    reject(new Error(`SystemAudioDump exited with code ${code}`));
                }
            });
            
            // Give the process a moment to start
            setTimeout(() => {
                resolve({
                    success: true,
                    process,
                    stream: null
                });
            }, 100);
        });
    }

    /**
     * Start Windows system audio capture
     */
    async _startWindowsSystemAudio(config) {
        return new Promise((resolve, reject) => {
            const command = this.platformConfig.win32.fallbackCommand;
            
            console.log('[PlatformAudioCapture] Starting Windows system audio capture:', command);
            
            const process = spawn('ffmpeg', [
                '-f', 'dshow',
                '-i', 'audio="Stereo Mix"',
                '-f', 's16le',
                '-ar', config.sampleRate.toString(),
                '-ac', config.channels.toString(),
                '-'
            ]);
            
            let audioData = Buffer.alloc(0);
            const chunkSize = config.sampleRate * config.channels * 2; // 2 bytes per sample
            
            process.stdout.on('data', (data) => {
                audioData = Buffer.concat([audioData, data]);
                
                // Process complete chunks
                while (audioData.length >= chunkSize) {
                    const chunk = audioData.slice(0, chunkSize);
                    audioData = audioData.slice(chunkSize);
                    
                    if (this.captureState.audioCallback) {
                        this.captureState.audioCallback(chunk);
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log('[PlatformAudioCapture] FFmpeg stderr:', data.toString());
            });
            
            process.on('error', (error) => {
                console.error('[PlatformAudioCapture] FFmpeg process error:', error);
                reject(error);
            });
            
            process.on('exit', (code, signal) => {
                console.log(`[PlatformAudioCapture] FFmpeg exited with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });
            
            // Give the process a moment to start
            setTimeout(() => {
                resolve({
                    success: true,
                    process,
                    stream: null
                });
            }, 100);
        });
    }

    /**
     * Start Linux system audio capture
     */
    async _startLinuxSystemAudio(config) {
        try {
            // Try PulseAudio first
            try {
                return await this._startPulseAudioCapture(config);
            } catch (pulseError) {
                console.warn('[PlatformAudioCapture] PulseAudio capture failed, trying ALSA:', pulseError.message);
                
                // Try ALSA
                try {
                    return await this._startALSACapture(config);
                } catch (alsaError) {
                    console.warn('[PlatformAudioCapture] ALSA capture failed, using fallback:', alsaError.message);
                    
                    // Use fallback
                    return await this._startFallbackCapture(config);
                }
            }
        } catch (error) {
            console.error('[PlatformAudioCapture] Linux system audio capture failed:', error);
            throw error;
        }
    }

    /**
     * Start PulseAudio capture
     */
    async _startPulseAudioCapture(config) {
        return new Promise((resolve, reject) => {
            const command = this.platformConfig.linux.pulseAudioCommand;
            
            console.log('[PlatformAudioCapture] Starting PulseAudio capture:', command);
            
            const process = spawn('parec', [
                '--format=s16le',
                '--rate=' + config.sampleRate,
                '--channels=' + config.channels,
                '--raw',
                '/dev/stdout'
            ]);
            
            let audioData = Buffer.alloc(0);
            const chunkSize = config.sampleRate * config.channels * 2; // 2 bytes per sample
            
            process.stdout.on('data', (data) => {
                audioData = Buffer.concat([audioData, data]);
                
                // Process complete chunks
                while (audioData.length >= chunkSize) {
                    const chunk = audioData.slice(0, chunkSize);
                    audioData = audioData.slice(chunkSize);
                    
                    if (this.captureState.audioCallback) {
                        this.captureState.audioCallback(chunk);
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log('[PlatformAudioCapture] PulseAudio stderr:', data.toString());
            });
            
            process.on('error', (error) => {
                console.error('[PlatformAudioCapture] PulseAudio process error:', error);
                reject(error);
            });
            
            process.on('exit', (code, signal) => {
                console.log(`[PlatformAudioCapture] PulseAudio exited with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    reject(new Error(`PulseAudio exited with code ${code}`));
                }
            });
            
            // Give the process a moment to start
            setTimeout(() => {
                resolve({
                    success: true,
                    process,
                    stream: null
                });
            }, 100);
        });
    }

    /**
     * Start ALSA capture
     */
    async _startALSACapture(config) {
        return new Promise((resolve, reject) => {
            const command = this.platformConfig.linux.alsaCommand;
            
            console.log('[PlatformAudioCapture] Starting ALSA capture:', command);
            
            const process = spawn('arecord', [
                '-f', 'S16_LE',
                '-r', config.sampleRate.toString(),
                '-c', config.channels.toString(),
                '-D', 'pulse',
                '/dev/stdout'
            ]);
            
            let audioData = Buffer.alloc(0);
            const chunkSize = config.sampleRate * config.channels * 2; // 2 bytes per sample
            
            process.stdout.on('data', (data) => {
                audioData = Buffer.concat([audioData, data]);
                
                // Process complete chunks
                while (audioData.length >= chunkSize) {
                    const chunk = audioData.slice(0, chunkSize);
                    audioData = audioData.slice(chunkSize);
                    
                    if (this.captureState.audioCallback) {
                        this.captureState.audioCallback(chunk);
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log('[PlatformAudioCapture] ALSA stderr:', data.toString());
            });
            
            process.on('error', (error) => {
                console.error('[PlatformAudioCapture] ALSA process error:', error);
                reject(error);
            });
            
            process.on('exit', (code, signal) => {
                console.log(`[PlatformAudioCapture] ALSA exited with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    reject(new Error(`ALSA exited with code ${code}`));
                }
            });
            
            // Give the process a moment to start
            setTimeout(() => {
                resolve({
                    success: true,
                    process,
                    stream: null
                });
            }, 100);
        });
    }

    /**
     * Start fallback capture using FFmpeg
     */
    async _startFallbackCapture(config) {
        return new Promise((resolve, reject) => {
            let command;
            
            switch (this.platform) {
                case 'darwin':
                    command = this.platformConfig.darwin.fallbackCommand;
                    break;
                case 'win32':
                    command = this.platformConfig.win32.fallbackCommand;
                    break;
                case 'linux':
                    command = this.platformConfig.linux.fallbackCommand;
                    break;
                default:
                    reject(new Error(`Unsupported platform: ${this.platform}`));
                    return;
            }
            
            console.log('[PlatformAudioCapture] Starting fallback capture:', command);
            
            const process = spawn('ffmpeg', [
                '-f', this.platform === 'darwin' ? 'avfoundation' : 
                     this.platform === 'win32' ? 'dshow' : 'pulse',
                '-i', this.platform === 'darwin' ? ':0' : 
                     this.platform === 'win32' ? 'audio="Stereo Mix"' : 'default',
                '-f', 's16le',
                '-ar', config.sampleRate.toString(),
                '-ac', config.channels.toString(),
                '-'
            ]);
            
            let audioData = Buffer.alloc(0);
            const chunkSize = config.sampleRate * config.channels * 2; // 2 bytes per sample
            
            process.stdout.on('data', (data) => {
                audioData = Buffer.concat([audioData, data]);
                
                // Process complete chunks
                while (audioData.length >= chunkSize) {
                    const chunk = audioData.slice(0, chunkSize);
                    audioData = audioData.slice(chunkSize);
                    
                    if (this.captureState.audioCallback) {
                        this.captureState.audioCallback(chunk);
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                console.log('[PlatformAudioCapture] FFmpeg stderr:', data.toString());
            });
            
            process.on('error', (error) => {
                console.error('[PlatformAudioCapture] FFmpeg process error:', error);
                reject(error);
            });
            
            process.on('exit', (code, signal) => {
                console.log(`[PlatformAudioCapture] FFmpeg exited with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });
            
            // Give the process a moment to start
            setTimeout(() => {
                resolve({
                    success: true,
                    process,
                    stream: null
                });
            }, 100);
        });
    }

    /**
     * Stop system audio capture
     */
    async stopSystemAudioCapture() {
        try {
            if (!this.isCapturing) {
                return true;
            }
            
            console.log('[PlatformAudioCapture] Stopping system audio capture...');
            
            // Stop the capture process
            if (this.captureState.process) {
                this.captureState.process.kill('SIGTERM');
                
                // Wait for process to exit
                await new Promise((resolve) => {
                    this.captureState.process.on('exit', resolve);
                    setTimeout(resolve, 1000); // Timeout after 1 second
                });
            }
            
            // Reset state
            this.isCapturing = false;
            this.captureState = {
                process: null,
                stream: null,
                audioCallback: this.captureState.audioCallback,
                config: null
            };
            
            console.log('[PlatformAudioCapture] ✅ System audio capture stopped');
            this.emit('systemAudioCaptureStopped');
            
            return true;
            
        } catch (error) {
            console.error('[PlatformAudioCapture] ❌ System audio capture stop failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Set audio callback
     */
    setAudioCallback(callback) {
        this.captureState.audioCallback = callback;
        console.log('[PlatformAudioCapture] Audio callback set');
    }

    /**
     * Get audio capabilities
     */
    getAudioCapabilities() {
        return {
            platform: this.platform,
            ...this.capabilities
        };
    }

    /**
     * Get capture status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isCapturing: this.isCapturing,
            platform: this.platform,
            capabilities: this.capabilities,
            hasProcess: !!this.captureState.process,
            hasCallback: !!this.captureState.audioCallback
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('[PlatformAudioCapture] Cleaning up...');
            
            // Stop capture if active
            if (this.isCapturing) {
                await this.stopSystemAudioCapture();
            }
            
            // Clear callback
            this.captureState.audioCallback = null;
            
            // Remove all listeners
            this.removeAllListeners();
            
            // Reset state
            this.isInitialized = false;
            
            console.log('[PlatformAudioCapture] ✅ Cleanup complete');
            
        } catch (error) {
            console.error('[PlatformAudioCapture] ❌ Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new PlatformAudioCapture();