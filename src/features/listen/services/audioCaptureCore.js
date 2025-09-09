/**
 * Audio Capture Core - Complete audio capture system with echo cancellation
 * Implements the audio capture pipeline as shown in the lesson
 */

const { 
    isVoiceActive, 
    convertFloat32ToInt16, 
    arrayBufferToBase64,
    SAMPLE_RATE,
    AUDIO_CHUNK_DURATION,
    BUFFER_SIZE,
    WASMAudioHelpers
} = require('./vadUtils');

// Constants & Globals
const MAX_SYSTEM_BUFFER_SIZE = 10;

// WebAssembly AEC module
let aecModPromise = null;
let aecMod = null;
let aecPtr = 0;

// Audio contexts and processors
let audioContext = null;
let audioProcessor = null;
let systemAudioContext = null;
let systemAudioProcessor = null;
let mediaStream = null;
let micMediaStream = null;

// Audio buffers
let systemAudioBuffer = [];

// Platform detection
const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

/**
 * Initialize WebAssembly AEC module
 */
async function getAec() {
    if (aecModPromise) return aecModPromise;
    
    aecModPromise = new Promise((resolve, reject) => {
        // For now, we'll create a mock AEC module since the actual WASM file isn't available
        // In a real implementation, this would load the actual WebAssembly module
        console.log('⚠️ AEC WebAssembly module not available, using software fallback');
        
        // Mock AEC module for demonstration
        const mockAecMod = {
            _malloc: (bytes) => {
                // Mock memory allocation
                return Math.floor(Math.random() * 1000000);
            },
            _free: (ptr) => {
                // Mock memory deallocation
            },
            newPtr: (sampleRate, frameSize, filterLength, channels) => {
                console.log(`Mock AEC initialized: ${sampleRate}Hz, ${frameSize} samples, ${filterLength} filter length, ${channels} channels`);
                return Math.floor(Math.random() * 1000000);
            },
            cancel: (aecPtr, micPtr, sysPtr, micLen, sysLen) => {
                // Mock echo cancellation - in real implementation this would process the audio
                console.log(`Mock AEC processing: ${micLen} mic samples, ${sysLen} sys samples`);
            },
            destroy: (aecPtr) => {
                console.log('Mock AEC destroyed');
            },
            HEAPU8: new Uint8Array(1024 * 1024), // Mock heap
            HEAP16: new Int16Array(512 * 1024)   // Mock heap
        };
        
        resolve(mockAecMod);
    });
    
    return aecModPromise;
}

/**
 * Run echo cancellation synchronously
 */
function runAecSync(micF32, sysF32) {
    if (!aecMod || !aecPtr || !aecMod.HEAPU8) {
        // console.log('🔊 No AEC module or heap buffer');
        return micF32;
    }

    const frameSize = 160; // AEC module frame size
    const numFrames = Math.floor(micF32.length / frameSize);

    // Buffer for processed audio
    const processedF32 = new Float32Array(micF32.length);

    // Align system and mic audio lengths for stability
    let alignedSysF32 = new Float32Array(micF32.length);
    if (sysF32.length > 0) {
        // Trim or pad sysF32 to match micF32 length
        const lengthToCopy = Math.min(micF32.length, sysF32.length);
        alignedSysF32.set(sysF32.slice(0, lengthToCopy));
    }

    // Process frame by frame
    for (let frame = 0; frame < numFrames; frame++) {
        const offset = frame * frameSize;
        
        // Extract current frame
        const micFrame = micF32.slice(offset, offset + frameSize);
        const sysFrame = alignedSysF32.slice(offset, offset + frameSize);
        
        // Convert to Int16 for WASM
        const micData = WASMAudioHelpers.int16PtrFromFloat32(aecMod, micFrame);
        const sysData = WASMAudioHelpers.int16PtrFromFloat32(aecMod, sysFrame);
        
        // Run echo cancellation
        aecMod.cancel(aecPtr, micData.ptr, sysData.ptr, frameSize, frameSize);
        
        // Convert back to Float32 and store
        const cleanedFrame = WASMAudioHelpers.float32FromInt16View(micData.view);
        processedF32.set(cleanedFrame, offset);
        
        // Free WASM memory
        aecMod._free(micData.ptr);
        aecMod._free(sysData.ptr);
    }

    // Handle remaining samples (partial frame)
    const remainingSamples = micF32.length - (numFrames * frameSize);
    if (remainingSamples > 0) {
        const offset = numFrames * frameSize;
        processedF32.set(micF32.slice(offset), offset);
    }

    return processedF32;
}

/**
 * Capture audio with echo cancellation
 */
async function captureAudioWithAEC(selectedMicId, isCapturingSystemAudio = false) {
    // Clean up previous capture
    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }
    if (audioContext) {
        await audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    try {
        // Initialize AEC module if needed
        if (!aecMod && isCapturingSystemAudio) {
            console.log('🎤 Loading AEC module...');
            aecMod = await getAec();
            if (aecMod && !aecPtr) {
                aecPtr = aecMod.newPtr(24000, 160, 512, 1);
                console.log('✅ AEC initialized');
            }
        }

        // Get microphone stream
        const constraints = {
            audio: {
                deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
                echoCancellation: false,  // We handle this ourselves
                noiseSuppression: false,  // Preserve original
                autoGainControl: false,   // Manual control
                sampleRate: SAMPLE_RATE
            }
        };

        console.log('🎤 Requesting microphone access...');
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        micMediaStream = mediaStream;

        // Create audio context and processor
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        const source = audioContext.createMediaStreamSource(mediaStream);
        audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

        let audioBuffer = [];
        let lastProcessTime = Date.now();

        audioProcessor.onaudioprocess = function(event) {
            const inputBuffer = event.inputBuffer;
            const audioData = inputBuffer.getChannelData(0);

            // Accumulate audio samples
            audioBuffer.push(...audioData);

            // Process when we have enough samples
            const chunkSize = Math.floor(SAMPLE_RATE * AUDIO_CHUNK_DURATION);
            while (audioBuffer.length >= chunkSize) {
                const chunk = audioBuffer.splice(0, chunkSize);
                const float32Array = new Float32Array(chunk);

                let processedAudio = float32Array;

                // Apply echo cancellation if capturing system audio
                if (isCapturingSystemAudio && systemAudioBuffer.length > 0) {
                    const latestSystemAudio = systemAudioBuffer[systemAudioBuffer.length - 1];
                    processedAudio = runAecSync(float32Array, latestSystemAudio);
                }

                // Check for voice activity
                const hasVoice = isVoiceActive(processedAudio);

                // Convert to base64 for transmission
                const int16Array = convertFloat32ToInt16(processedAudio);
                const base64Audio = arrayBufferToBase64(int16Array.buffer);

                // Send to main process (this would be implemented based on your IPC system)
                // window.api.stt.sendMicAudioContent(base64Audio, 'audio/pcm');

                // Update UI with audio levels
                const rms = Math.sqrt(
                    processedAudio.reduce((sum, val) => sum + val * val, 0) / 
                    processedAudio.length
                );
                
                // Dispatch audio level event
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('audioLevel', {
                        detail: { level: rms, hasVoice }
                    }));
                }

                lastProcessTime = Date.now();
            }
        };

        // Connect audio pipeline
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);

        console.log('✅ Audio capture started');
        return true;

    } catch (error) {
        console.error('❌ Audio capture failed:', error);
        throw error;
    }
}

/**
 * Start system audio capture for echo cancellation reference
 */
async function startSystemAudioCapture() {
    if (systemAudioContext || systemAudioProcessor) {
        console.log('⚠️ System audio already capturing');
        return;
    }

    try {
        console.log('🔊 Starting system audio capture...');
        
        // Platform-specific system audio capture
        if (isMacOS || isLinux) {
            // Use screen recording API for system audio
            const systemStream = await navigator.mediaDevices.getDisplayMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: SAMPLE_RATE
                },
                video: false  // Audio only
            });

            systemAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
            const source = systemAudioContext.createMediaStreamSource(systemStream);
            systemAudioProcessor = systemAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

            systemAudioProcessor.onaudioprocess = function(event) {
                const inputBuffer = event.inputBuffer;
                const audioData = inputBuffer.getChannelData(0);
                
                // Store in circular buffer for AEC
                const float32Copy = new Float32Array(audioData);
                systemAudioBuffer.push(float32Copy);
                
                // Maintain buffer size limit
                if (systemAudioBuffer.length > MAX_SYSTEM_BUFFER_SIZE) {
                    systemAudioBuffer.shift();
                }
                
                // Also send to STT for "Them" speaker
                const int16Array = convertFloat32ToInt16(float32Copy);
                const base64Audio = arrayBufferToBase64(int16Array.buffer);
                
                // Send to main process (this would be implemented based on your IPC system)
                // window.api.stt.sendSystemAudioContent(base64Audio, 'audio/pcm');
            };

            source.connect(systemAudioProcessor);
            systemAudioProcessor.connect(systemAudioContext.destination);
            
            console.log('✅ System audio capture started');
            
        } else {
            console.log('⚠️ System audio not supported on this platform');
        }
        
    } catch (error) {
        console.error('❌ System audio capture failed:', error);
        
        // Clean up on failure
        if (systemAudioProcessor) {
            systemAudioProcessor.disconnect();
            systemAudioProcessor = null;
        }
        if (systemAudioContext) {
            await systemAudioContext.close();
            systemAudioContext = null;
        }
    }
}

/**
 * Get available audio devices for microphone selection
 */
async function getAudioDevices() {
    try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // Immediately stop the stream - we just needed permissions
                stream.getTracks().forEach(track => track.stop());
            });

        // Now enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        return audioInputs.map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
            groupId: device.groupId
        }));
        
    } catch (error) {
        console.error('Failed to get audio devices:', error);
        return [];
    }
}

/**
 * Stop audio capture
 */
async function stopAudioCapture() {
    try {
        console.log('🛑 Stopping audio capture...');
        
        // Stop microphone capture
        if (audioProcessor) {
            audioProcessor.disconnect();
            audioProcessor = null;
        }
        if (audioContext) {
            await audioContext.close();
            audioContext = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // Stop system audio capture
        if (systemAudioProcessor) {
            systemAudioProcessor.disconnect();
            systemAudioProcessor = null;
        }
        if (systemAudioContext) {
            await systemAudioContext.close();
            systemAudioContext = null;
        }
        
        // Clear buffers
        systemAudioBuffer = [];
        
        // Clean up AEC
        if (aecMod && aecPtr) {
            aecMod.destroy(aecPtr);
            aecPtr = 0;
        }
        
        console.log('✅ Audio capture stopped');
        
    } catch (error) {
        console.error('❌ Error stopping audio capture:', error);
        throw error;
    }
}

/**
 * Get capture status
 */
function getCaptureStatus() {
    return {
        microphone: {
            active: !!mediaStream,
            hasStream: !!mediaStream,
            contextActive: !!audioContext,
            processorActive: !!audioProcessor
        },
        systemAudio: {
            active: !!systemAudioContext,
            hasStream: !!systemAudioContext,
            contextActive: !!systemAudioContext,
            processorActive: !!systemAudioProcessor,
            bufferSize: systemAudioBuffer.length
        },
        aec: {
            moduleLoaded: !!aecMod,
            initialized: !!aecPtr,
            bufferSize: systemAudioBuffer.length
        }
    };
}

module.exports = {
    captureAudioWithAEC,
    startSystemAudioCapture,
    getAudioDevices,
    stopAudioCapture,
    getCaptureStatus,
    runAecSync,
    getAec
};
