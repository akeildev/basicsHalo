/**
 * Voice Activity Detection Utilities
 * Simple but effective VAD implementation for Clueless
 * Based on RMS energy calculation with configurable thresholds
 */

// Constants & Globals
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;

/**
 * Simple Voice Activity Detection using RMS energy
 * @param {Float32Array} audioFloat32Array - Audio samples to analyze
 * @param {number} threshold - RMS threshold for voice detection (default: 0.005)
 * @returns {boolean} - True if voice activity detected
 */
function isVoiceActive(audioFloat32Array, threshold = 0.005) {
    if (!audioFloat32Array || audioFloat32Array.length === 0) {
        return false;
    }

    let sumOfSquares = 0;
    for (let i = 0; i < audioFloat32Array.length; i++) {
        sumOfSquares += audioFloat32Array[i] * audioFloat32Array[i];
    }
    const rms = Math.sqrt(sumOfSquares / audioFloat32Array.length);

    // console.log(`VAD RMS: ${rms.toFixed(4)}`); // For debugging VAD threshold

    return rms > threshold;
}

/**
 * Convert base64 encoded audio to Float32Array
 * @param {string} base64 - Base64 encoded audio data
 * @returns {Float32Array} - Decoded audio samples
 */
function base64ToFloat32Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
}

/**
 * Convert Float32Array to Int16Array for API compatibility
 * @param {Float32Array} float32Array - Input audio samples
 * @returns {Int16Array} - Converted audio samples
 */
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Audio buffer to encode
 * @returns {string} - Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * WebAssembly integration helpers for audio processing
 */
class WASMAudioHelpers {
    /**
     * Create Int16 pointer from Float32Array in WASM memory
     * @param {Object} mod - WebAssembly module
     * @param {Float32Array} f32 - Float32 audio data
     * @returns {Object} - Pointer and view object
     */
    static int16PtrFromFloat32(mod, f32) {
        const len = f32.length;
        const bytes = len * 2;
        const ptr = mod._malloc(bytes);
        // HEAP16 might not exist, use HEAPU8.buffer directly
        const heapBuf = (mod.HEAP16 ? mod.HEAP16.buffer : mod.HEAPU8.buffer);
        const i16 = new Int16Array(heapBuf, ptr, len);
        for (let i = 0; i < len; ++i) {
            const s = Math.max(-1, Math.min(1, f32[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return { ptr, view: i16 };
    }

    /**
     * Convert Int16 view back to Float32Array
     * @param {Int16Array} i16 - Int16 audio data
     * @returns {Float32Array} - Converted audio samples
     */
    static float32FromInt16View(i16) {
        const out = new Float32Array(i16.length);
        for (let i = 0; i < i16.length; ++i) out[i] = i16[i] / 32768;
        return out;
    }

    /**
     * Clean up WASM resources
     * @param {Object} mod - WebAssembly module
     * @param {number} ptr - Pointer to free
     */
    static disposeAec(mod, ptr) {
        if (ptr && mod && mod._free) {
            mod._free(ptr);
        }
    }
}

/**
 * Noise filtering patterns for STT services
 * Common noise patterns that Whisper and other STT services return
 */
const NOISE_PATTERNS = [
    '[BLANK_AUDIO]',
    '[INAUDIBLE]',
    '[MUSIC]',
    '[SOUND]',
    '[NOISE]',
    '(BLANK_AUDIO)',
    '(INAUDIBLE)',
    '(MUSIC)',
    '(SOUND)',
    '(NOISE)'
];

/**
 * Filter out noise transcriptions from STT results
 * @param {string} text - Transcription text to filter
 * @returns {boolean} - True if text is likely noise
 */
function isNoiseTranscription(text) {
    if (!text || text.trim().length <= 2) {
        return true;
    }
    
    return NOISE_PATTERNS.some(pattern => 
        text.includes(pattern) || text.trim() === pattern
    );
}

/**
 * Enhanced VAD with adaptive threshold
 * @param {Float32Array} audioFloat32Array - Audio samples
 * @param {Object} options - VAD options
 * @returns {Object} - VAD result with energy and activity
 */
function enhancedVAD(audioFloat32Array, options = {}) {
    const {
        threshold = 0.005,
        adaptiveThreshold = true,
        energyHistory = [],
        minEnergyHistory = 5
    } = options;

    if (!audioFloat32Array || audioFloat32Array.length === 0) {
        return { isVoiceActive: false, energy: 0, threshold: threshold };
    }

    // Calculate RMS energy
    let sumOfSquares = 0;
    for (let i = 0; i < audioFloat32Array.length; i++) {
        sumOfSquares += audioFloat32Array[i] * audioFloat32Array[i];
    }
    const energy = Math.sqrt(sumOfSquares / audioFloat32Array.length);

    // Update energy history
    energyHistory.push(energy);
    if (energyHistory.length > 20) {
        energyHistory.shift();
    }

    // Calculate adaptive threshold
    let finalThreshold = threshold;
    if (adaptiveThreshold && energyHistory.length >= minEnergyHistory) {
        const averageEnergy = energyHistory.reduce((sum, e) => sum + e, 0) / energyHistory.length;
        finalThreshold = Math.max(threshold, averageEnergy * 1.5);
    }

    const isVoiceActive = energy > finalThreshold;

    return {
        isVoiceActive,
        energy,
        threshold: finalThreshold,
        energyHistory: [...energyHistory]
    };
}

module.exports = {
    // Core VAD function
    isVoiceActive,
    
    // Audio format conversions
    base64ToFloat32Array,
    convertFloat32ToInt16,
    arrayBufferToBase64,
    
    // WebAssembly helpers
    WASMAudioHelpers,
    
    // Noise filtering
    NOISE_PATTERNS,
    isNoiseTranscription,
    
    // Enhanced VAD
    enhancedVAD,
    
    // Constants
    SAMPLE_RATE,
    AUDIO_CHUNK_DURATION,
    BUFFER_SIZE
};
