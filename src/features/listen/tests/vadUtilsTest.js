/**
 * VAD Utils Test - Demonstrates the Voice Activity Detection implementation
 * Tests the simple VAD functions and utilities from the lesson
 */

const { 
    isVoiceActive, 
    enhancedVAD, 
    base64ToFloat32Array, 
    convertFloat32ToInt16, 
    arrayBufferToBase64,
    isNoiseTranscription,
    NOISE_PATTERNS,
    SAMPLE_RATE,
    AUDIO_CHUNK_DURATION,
    BUFFER_SIZE
} = require('../services/vadUtils');

/**
 * Test VAD utilities implementation
 */
class VADUtilsTest {
    constructor() {
        this.name = 'VAD Utils Test';
        this.tests = [];
    }

    /**
     * Run all VAD utility tests
     */
    async run() {
        console.log('🎤 Running VAD Utils tests...');
        
        this.tests = [];
        
        // Test basic VAD function
        await this.testBasicVAD();
        
        // Test enhanced VAD with adaptive threshold
        await this.testEnhancedVAD();
        
        // Test audio format conversions
        await this.testAudioFormatConversions();
        
        // Test noise filtering
        await this.testNoiseFiltering();
        
        // Test constants
        await this.testConstants();
        
        return this.getResults();
    }

    /**
     * Test basic VAD function
     */
    async testBasicVAD() {
        try {
            console.log('  Testing basic VAD function...');
            
            // Create test audio data
            const silence = new Float32Array(1000).fill(0);
            const quietNoise = new Float32Array(1000).fill(0.001);
            const normalSpeech = new Float32Array(1000).fill(0.02);
            const loudSpeech = new Float32Array(1000).fill(0.1);
            
            // Test silence detection
            const silenceResult = isVoiceActive(silence, 0.005);
            this.addTest('VAD silence detection', !silenceResult, 'Silence should not be detected as voice');
            
            // Test quiet noise detection
            const quietResult = isVoiceActive(quietNoise, 0.005);
            this.addTest('VAD quiet noise detection', !quietResult, 'Quiet noise should not be detected as voice');
            
            // Test normal speech detection
            const speechResult = isVoiceActive(normalSpeech, 0.005);
            this.addTest('VAD normal speech detection', speechResult, 'Normal speech should be detected as voice');
            
            // Test loud speech detection
            const loudResult = isVoiceActive(loudSpeech, 0.005);
            this.addTest('VAD loud speech detection', loudResult, 'Loud speech should be detected as voice');
            
            console.log('  ✅ Basic VAD tests passed');
            
        } catch (error) {
            this.addTest('Basic VAD test', false, `Error: ${error.message}`);
            console.error('  ❌ Basic VAD test failed:', error);
        }
    }

    /**
     * Test enhanced VAD with adaptive threshold
     */
    async testEnhancedVAD() {
        try {
            console.log('  Testing enhanced VAD...');
            
            // Create test audio with varying energy levels
            const audioData = new Float32Array(1000);
            for (let i = 0; i < audioData.length; i++) {
                // Create a pattern: quiet -> normal -> loud -> quiet
                if (i < 250) audioData[i] = 0.001; // Quiet
                else if (i < 500) audioData[i] = 0.02; // Normal speech
                else if (i < 750) audioData[i] = 0.05; // Loud speech
                else audioData[i] = 0.001; // Quiet again
            }
            
            const energyHistory = [];
            const vadResult = enhancedVAD(audioData, {
                threshold: 0.005,
                adaptiveThreshold: true,
                energyHistory: energyHistory,
                minEnergyHistory: 3
            });
            
            this.addTest('Enhanced VAD result structure', 
                vadResult.hasOwnProperty('isVoiceActive') && 
                vadResult.hasOwnProperty('energy') && 
                vadResult.hasOwnProperty('threshold') && 
                vadResult.hasOwnProperty('energyHistory'),
                'Enhanced VAD should return complete result object');
            
            this.addTest('Enhanced VAD energy calculation', 
                vadResult.energy > 0, 
                'Energy should be calculated and positive');
            
            this.addTest('Enhanced VAD adaptive threshold', 
                vadResult.threshold >= 0.005, 
                'Adaptive threshold should be at least the base threshold');
            
            console.log('  ✅ Enhanced VAD tests passed');
            
        } catch (error) {
            this.addTest('Enhanced VAD test', false, `Error: ${error.message}`);
            console.error('  ❌ Enhanced VAD test failed:', error);
        }
    }

    /**
     * Test audio format conversions
     */
    async testAudioFormatConversions() {
        try {
            console.log('  Testing audio format conversions...');
            
            // Create test Float32 audio data
            const float32Data = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5]);
            
            // Test Float32 to Int16 conversion
            const int16Data = convertFloat32ToInt16(float32Data);
            this.addTest('Float32 to Int16 conversion', 
                int16Data instanceof Int16Array && int16Data.length === float32Data.length,
                'Should convert Float32Array to Int16Array with same length');
            
            // Test Int16 to base64 encoding
            const base64Data = arrayBufferToBase64(int16Data.buffer);
            this.addTest('Int16 to base64 encoding', 
                typeof base64Data === 'string' && base64Data.length > 0,
                'Should encode Int16Array to base64 string');
            
            // Test base64 to Float32 conversion
            const decodedFloat32 = base64ToFloat32Array(base64Data);
            this.addTest('Base64 to Float32 conversion', 
                decodedFloat32 instanceof Float32Array && decodedFloat32.length === float32Data.length,
                'Should decode base64 back to Float32Array');
            
            // Test round-trip conversion accuracy
            const maxDifference = Math.max(...float32Data.map((val, i) => Math.abs(val - decodedFloat32[i])));
            this.addTest('Round-trip conversion accuracy', 
                maxDifference < 0.01, 
                'Round-trip conversion should maintain reasonable accuracy');
            
            console.log('  ✅ Audio format conversion tests passed');
            
        } catch (error) {
            this.addTest('Audio format conversion test', false, `Error: ${error.message}`);
            console.error('  ❌ Audio format conversion test failed:', error);
        }
    }

    /**
     * Test noise filtering
     */
    async testNoiseFiltering() {
        try {
            console.log('  Testing noise filtering...');
            
            // Test noise pattern detection
            const noiseTexts = [
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
            
            const speechTexts = [
                'Hello world',
                'This is a test',
                'How are you doing today?',
                'The weather is nice'
            ];
            
            // Test noise detection
            for (const noiseText of noiseTexts) {
                const isNoise = isNoiseTranscription(noiseText);
                this.addTest(`Noise detection: ${noiseText}`, 
                    isNoise, 
                    `Should detect "${noiseText}" as noise`);
            }
            
            // Test speech detection
            for (const speechText of speechTexts) {
                const isNoise = isNoiseTranscription(speechText);
                this.addTest(`Speech detection: ${speechText}`, 
                    !isNoise, 
                    `Should detect "${speechText}" as speech`);
            }
            
            // Test short text filtering
            const shortText = 'Hi';
            const isShortNoise = isNoiseTranscription(shortText);
            this.addTest('Short text filtering', 
                isShortNoise, 
                'Should filter out very short text');
            
            console.log('  ✅ Noise filtering tests passed');
            
        } catch (error) {
            this.addTest('Noise filtering test', false, `Error: ${error.message}`);
            console.error('  ❌ Noise filtering test failed:', error);
        }
    }

    /**
     * Test constants
     */
    async testConstants() {
        try {
            console.log('  Testing constants...');
            
            this.addTest('Sample rate constant', 
                SAMPLE_RATE === 24000, 
                'Sample rate should be 24kHz');
            
            this.addTest('Audio chunk duration constant', 
                AUDIO_CHUNK_DURATION === 0.1, 
                'Audio chunk duration should be 100ms');
            
            this.addTest('Buffer size constant', 
                BUFFER_SIZE === 4096, 
                'Buffer size should be 4096 samples');
            
            this.addTest('Noise patterns array', 
                Array.isArray(NOISE_PATTERNS) && NOISE_PATTERNS.length > 0, 
                'Noise patterns should be a non-empty array');
            
            console.log('  ✅ Constants tests passed');
            
        } catch (error) {
            this.addTest('Constants test', false, `Error: ${error.message}`);
            console.error('  ❌ Constants test failed:', error);
        }
    }

    /**
     * Add a test result
     */
    addTest(name, passed, description) {
        this.tests.push({
            name,
            passed,
            description,
            timestamp: Date.now()
        });
    }

    /**
     * Get test results
     */
    getResults() {
        const passed = this.tests.filter(t => t.passed).length;
        const total = this.tests.length;
        const success = passed === total;
        
        return {
            name: this.name,
            success,
            passed,
            total,
            tests: this.tests
        };
    }
}

module.exports = VADUtilsTest;
