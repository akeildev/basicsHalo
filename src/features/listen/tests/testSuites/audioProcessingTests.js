const audioProcessor = require('../../services/audioProcessor');
const echoCancellation = require('../../services/echoCancellation');

/**
 * Audio Processing Tests - Tests VAD, echo cancellation, noise gate, and format conversion
 */
class AudioProcessingTests {
    constructor() {
        this.name = 'Audio Processing Tests';
        this.tests = [];
    }

    /**
     * Run all audio processing tests
     */
    async run(options = {}) {
        console.log('🎵 Running audio processing tests...');
        
        this.tests = [];
        
        // Test audio processor initialization
        await this.testAudioProcessorInitialization();
        
        // Test Voice Activity Detection (VAD)
        await this.testVoiceActivityDetection();
        
        // Test echo cancellation
        await this.testEchoCancellation();
        
        // Test noise gate
        await this.testNoiseGate();
        
        // Test format conversion
        await this.testFormatConversion();
        
        // Test audio chunking
        await this.testAudioChunking();
        
        // Test audio processing pipeline
        await this.testAudioProcessingPipeline();
        
        // Test performance metrics
        await this.testPerformanceMetrics();
        
        return this.getResults();
    }

    /**
     * Test audio processor initialization
     */
    async testAudioProcessorInitialization() {
        const testName = 'Audio Processor Initialization';
        
        try {
            // Test initialization
            const initialized = await audioProcessor.initialize({
                sampleRate: 24000,
                channels: 1,
                bufferSize: 4096,
                chunkSize: 2400,
                vadThreshold: 0.01,
                noiseGateThreshold: 0.005
            });
            
            if (!initialized) {
                throw new Error('Audio processor initialization failed');
            }
            
            // Test status
            const status = audioProcessor.getStatus();
            if (!status.isInitialized) {
                throw new Error('Audio processor should be initialized');
            }
            
            // Test configuration
            if (status.config.sampleRate !== 24000) {
                throw new Error('Sample rate not set correctly');
            }
            
            if (status.config.channels !== 1) {
                throw new Error('Channel count not set correctly');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test Voice Activity Detection (VAD)
     */
    async testVoiceActivityDetection() {
        const testName = 'Voice Activity Detection';
        
        try {
            // Test VAD with silence
            const silenceFrame = new Float32Array(4096).fill(0);
            const silenceVAD = audioProcessor.detectVoiceActivity(silenceFrame);
            
            if (silenceVAD !== false) {
                throw new Error('Silence should not be detected as voice');
            }
            
            // Test VAD with voice-like signal
            const voiceFrame = new Float32Array(4096);
            for (let i = 0; i < voiceFrame.length; i++) {
                voiceFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1; // 440Hz tone
            }
            const voiceVAD = audioProcessor.detectVoiceActivity(voiceFrame);
            
            if (typeof voiceVAD !== 'boolean') {
                throw new Error('VAD should return boolean');
            }
            
            // Test VAD state management
            audioProcessor.startProcessing();
            
            // Process multiple frames to test VAD state
            for (let i = 0; i < 5; i++) {
                audioProcessor.processMicrophoneAudio(voiceFrame);
            }
            
            const vadStatus = audioProcessor.getStatus().vad;
            if (typeof vadStatus.isVoiceActive !== 'boolean') {
                throw new Error('VAD state should be boolean');
            }
            
            audioProcessor.stopProcessing();
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test echo cancellation
     */
    async testEchoCancellation() {
        const testName = 'Echo Cancellation';
        
        try {
            // Test echo cancellation initialization
            const ecInitialized = await echoCancellation.initialize();
            if (!ecInitialized) {
                throw new Error('Echo cancellation initialization failed');
            }
            
            // Test echo cancellation processing
            const microphoneData = new Float32Array(4096);
            const systemAudioData = new Float32Array(4096);
            
            // Fill with test data
            for (let i = 0; i < 4096; i++) {
                microphoneData[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
                systemAudioData[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.05;
            }
            
            const processedData = echoCancellation.processFrame(microphoneData, systemAudioData);
            
            if (!(processedData instanceof Float32Array)) {
                throw new Error('Echo cancellation should return Float32Array');
            }
            
            if (processedData.length !== microphoneData.length) {
                throw new Error('Processed data should have same length as input');
            }
            
            // Test metrics
            const metrics = echoCancellation.getMetrics();
            if (typeof metrics.processedFrames !== 'number') {
                throw new Error('Echo cancellation metrics should include processedFrames');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test noise gate
     */
    async testNoiseGate() {
        const testName = 'Noise Gate';
        
        try {
            // Test noise gate with quiet signal
            const quietFrame = new Float32Array(4096).fill(0.001); // Below threshold
            const gatedQuiet = audioProcessor.applyNoiseGate(quietFrame);
            
            // All samples should be zeroed
            for (let i = 0; i < gatedQuiet.length; i++) {
                if (gatedQuiet[i] !== 0) {
                    throw new Error('Quiet signal should be gated to zero');
                }
            }
            
            // Test noise gate with loud signal
            const loudFrame = new Float32Array(4096).fill(0.1); // Above threshold
            const gatedLoud = audioProcessor.applyNoiseGate(loudFrame);
            
            // All samples should pass through
            for (let i = 0; i < gatedLoud.length; i++) {
                if (Math.abs(gatedLoud[i] - loudFrame[i]) > 0.001) {
                    throw new Error('Loud signal should pass through noise gate');
                }
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test format conversion
     */
    async testFormatConversion() {
        const testName = 'Format Conversion';
        
        try {
            // Test Float32 to Int16 conversion
            const float32Data = new Float32Array([-1.0, -0.5, 0.0, 0.5, 1.0]);
            const int16Data = audioProcessor.convertFloat32ToInt16(float32Data);
            
            if (!(int16Data instanceof Int16Array)) {
                throw new Error('Should return Int16Array');
            }
            
            if (int16Data.length !== float32Data.length) {
                throw new Error('Length should be preserved');
            }
            
            // Test conversion values
            if (int16Data[0] !== -32768) { // -1.0 should become -32768
                throw new Error('Conversion value incorrect for -1.0');
            }
            
            if (int16Data[2] !== 0) { // 0.0 should become 0
                throw new Error('Conversion value incorrect for 0.0');
            }
            
            if (int16Data[4] !== 32767) { // 1.0 should become 32767
                throw new Error('Conversion value incorrect for 1.0');
            }
            
            // Test base64 encoding
            const base64Data = audioProcessor.encodeToBase64(int16Data);
            if (typeof base64Data !== 'string') {
                throw new Error('Should return base64 string');
            }
            
            if (base64Data.length === 0) {
                throw new Error('Base64 string should not be empty');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test audio chunking
     */
    async testAudioChunking() {
        const testName = 'Audio Chunking';
        
        try {
            // Test chunking with exact chunk size
            const frameSize = 4096;
            const chunkSize = 2400;
            const testFrame = new Float32Array(frameSize);
            
            // Fill with test data
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            let chunkCount = 0;
            audioProcessor.setCallback('onAudioChunk', (chunkData) => {
                chunkCount++;
                if (chunkData.chunkSize !== chunkSize) {
                    throw new Error(`Chunk size should be ${chunkSize}, got ${chunkData.chunkSize}`);
                }
            });
            
            audioProcessor.startProcessing();
            audioProcessor.processMicrophoneAudio(testFrame);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            audioProcessor.stopProcessing();
            
            // Should have generated at least one chunk
            if (chunkCount === 0) {
                throw new Error('No audio chunks were generated');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${chunkCount} chunks)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test complete audio processing pipeline
     */
    async testAudioProcessingPipeline() {
        const testName = 'Audio Processing Pipeline';
        
        try {
            // Test complete pipeline with microphone and system audio
            const microphoneFrame = new Float32Array(4096);
            const systemAudioFrame = new Float32Array(4096);
            
            // Fill with test data
            for (let i = 0; i < 4096; i++) {
                microphoneFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
                systemAudioFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.05;
            }
            
            let processedChunks = 0;
            audioProcessor.setCallback('onAudioChunk', (chunkData) => {
                processedChunks++;
                if (typeof chunkData.data !== 'string') {
                    throw new Error('Chunk data should be base64 string');
                }
                if (typeof chunkData.timestamp !== 'number') {
                    throw new Error('Chunk should have timestamp');
                }
                if (typeof chunkData.voiceActivity !== 'boolean') {
                    throw new Error('Chunk should have voice activity flag');
                }
            });
            
            audioProcessor.startProcessing();
            
            // Process microphone and system audio
            audioProcessor.processMicrophoneAudio(microphoneFrame);
            audioProcessor.processSystemAudio(systemAudioFrame);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));
            
            audioProcessor.stopProcessing();
            
            if (processedChunks === 0) {
                throw new Error('No chunks were processed through pipeline');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${processedChunks} chunks processed)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test performance metrics
     */
    async testPerformanceMetrics() {
        const testName = 'Performance Metrics';
        
        try {
            // Process some audio to generate metrics
            const testFrame = new Float32Array(4096);
            for (let i = 0; i < 4096; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            audioProcessor.startProcessing();
            
            // Process multiple frames
            for (let i = 0; i < 10; i++) {
                audioProcessor.processMicrophoneAudio(testFrame);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            audioProcessor.stopProcessing();
            
            // Test metrics collection
            const metrics = audioProcessor.getMetrics();
            
            if (typeof metrics.processedChunks !== 'number') {
                throw new Error('Metrics should include processedChunks');
            }
            
            if (typeof metrics.voiceChunks !== 'number') {
                throw new Error('Metrics should include voiceChunks');
            }
            
            if (typeof metrics.silenceChunks !== 'number') {
                throw new Error('Metrics should include silenceChunks');
            }
            
            if (typeof metrics.averageProcessingTime !== 'number') {
                throw new Error('Metrics should include averageProcessingTime');
            }
            
            if (metrics.processedChunks === 0) {
                throw new Error('Should have processed some chunks');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${metrics.processedChunks} chunks, ${metrics.averageProcessingTime.toFixed(2)}ms avg)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Get test results
     */
    getResults() {
        const passed = this.tests.filter(t => t.passed).length;
        const failed = this.tests.filter(t => !t.passed).length;
        const total = this.tests.length;
        
        return {
            name: this.name,
            total,
            passed,
            failed,
            skipped: 0,
            tests: this.tests
        };
    }
}

module.exports = new AudioProcessingTests();
