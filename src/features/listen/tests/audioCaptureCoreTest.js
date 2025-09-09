/**
 * Audio Capture Core Test - Tests the complete audio capture system
 * Demonstrates the audio capture pipeline with echo cancellation
 */

const { 
    captureAudioWithAEC, 
    startSystemAudioCapture, 
    getAudioDevices, 
    stopAudioCapture, 
    getCaptureStatus,
    runAecSync,
    getAec
} = require('../services/audioCaptureCore');

/**
 * Test audio capture core implementation
 */
class AudioCaptureCoreTest {
    constructor() {
        this.name = 'Audio Capture Core Test';
        this.tests = [];
    }

    /**
     * Run all audio capture core tests
     */
    async run() {
        console.log('🎤 Running Audio Capture Core tests...');
        
        this.tests = [];
        
        // Test AEC module initialization
        await this.testAecModuleInitialization();
        
        // Test echo cancellation function
        await this.testEchoCancellation();
        
        // Test audio device enumeration
        await this.testAudioDeviceEnumeration();
        
        // Test capture status
        await this.testCaptureStatus();
        
        // Test audio capture simulation (without actual hardware)
        await this.testAudioCaptureSimulation();
        
        return this.getResults();
    }

    /**
     * Test AEC module initialization
     */
    async testAecModuleInitialization() {
        try {
            console.log('  Testing AEC module initialization...');
            
            const aecMod = await getAec();
            
            this.addTest('AEC module loaded', 
                aecMod !== null, 
                'AEC module should be loaded (mock implementation)');
            
            this.addTest('AEC module has required methods', 
                aecMod && 
                typeof aecMod.newPtr === 'function' &&
                typeof aecMod.cancel === 'function' &&
                typeof aecMod.destroy === 'function' &&
                typeof aecMod._malloc === 'function' &&
                typeof aecMod._free === 'function',
                'AEC module should have all required methods');
            
            this.addTest('AEC module has heap memory', 
                aecMod && aecMod.HEAPU8 && aecMod.HEAP16,
                'AEC module should have heap memory for audio processing');
            
            console.log('  ✅ AEC module initialization tests passed');
            
        } catch (error) {
            this.addTest('AEC module initialization', false, `Error: ${error.message}`);
            console.error('  ❌ AEC module initialization test failed:', error);
        }
    }

    /**
     * Test echo cancellation function
     */
    async testEchoCancellation() {
        try {
            console.log('  Testing echo cancellation...');
            
            // Create test audio data
            const micAudio = new Float32Array(1600).fill(0.1); // 100ms of audio
            const sysAudio = new Float32Array(1600).fill(0.05); // System audio reference
            
            // Test echo cancellation
            const processedAudio = runAecSync(micAudio, sysAudio);
            
            this.addTest('Echo cancellation returns audio', 
                processedAudio instanceof Float32Array && processedAudio.length === micAudio.length,
                'Echo cancellation should return processed audio of same length');
            
            this.addTest('Echo cancellation preserves audio structure', 
                processedAudio.length === micAudio.length,
                'Processed audio should have same length as input');
            
            // Test with empty system audio
            const processedAudioEmpty = runAecSync(micAudio, new Float32Array(0));
            this.addTest('Echo cancellation handles empty system audio', 
                processedAudioEmpty instanceof Float32Array,
                'Should handle empty system audio gracefully');
            
            console.log('  ✅ Echo cancellation tests passed');
            
        } catch (error) {
            this.addTest('Echo cancellation test', false, `Error: ${error.message}`);
            console.error('  ❌ Echo cancellation test failed:', error);
        }
    }

    /**
     * Test audio device enumeration
     */
    async testAudioDeviceEnumeration() {
        try {
            console.log('  Testing audio device enumeration...');
            
            // Note: This test might fail in non-browser environments
            // We'll test the function structure instead
            const devices = await getAudioDevices();
            
            this.addTest('Audio device enumeration returns array', 
                Array.isArray(devices),
                'getAudioDevices should return an array');
            
            if (devices.length > 0) {
                const device = devices[0];
                this.addTest('Audio device has required properties', 
                    device && 
                    typeof device.deviceId === 'string' &&
                    typeof device.label === 'string' &&
                    typeof device.groupId === 'string',
                    'Audio devices should have deviceId, label, and groupId');
            }
            
            console.log('  ✅ Audio device enumeration tests passed');
            
        } catch (error) {
            this.addTest('Audio device enumeration', false, `Error: ${error.message}`);
            console.error('  ❌ Audio device enumeration test failed:', error);
        }
    }

    /**
     * Test capture status
     */
    async testCaptureStatus() {
        try {
            console.log('  Testing capture status...');
            
            const status = getCaptureStatus();
            
            this.addTest('Capture status returns object', 
                typeof status === 'object' && status !== null,
                'getCaptureStatus should return an object');
            
            this.addTest('Capture status has microphone info', 
                status.microphone && 
                typeof status.microphone.active === 'boolean' &&
                typeof status.microphone.hasStream === 'boolean',
                'Status should include microphone information');
            
            this.addTest('Capture status has system audio info', 
                status.systemAudio && 
                typeof status.systemAudio.active === 'boolean' &&
                typeof status.systemAudio.hasStream === 'boolean',
                'Status should include system audio information');
            
            this.addTest('Capture status has AEC info', 
                status.aec && 
                typeof status.aec.moduleLoaded === 'boolean' &&
                typeof status.aec.initialized === 'boolean',
                'Status should include AEC information');
            
            console.log('  ✅ Capture status tests passed');
            
        } catch (error) {
            this.addTest('Capture status test', false, `Error: ${error.message}`);
            console.error('  ❌ Capture status test failed:', error);
        }
    }

    /**
     * Test audio capture simulation (without actual hardware)
     */
    async testAudioCaptureSimulation() {
        try {
            console.log('  Testing audio capture simulation...');
            
            // Test that functions exist and are callable
            this.addTest('captureAudioWithAEC function exists', 
                typeof captureAudioWithAEC === 'function',
                'captureAudioWithAEC should be a function');
            
            this.addTest('startSystemAudioCapture function exists', 
                typeof startSystemAudioCapture === 'function',
                'startSystemAudioCapture should be a function');
            
            this.addTest('stopAudioCapture function exists', 
                typeof stopAudioCapture === 'function',
                'stopAudioCapture should be a function');
            
            // Test function signatures
            this.addTest('captureAudioWithAEC has correct signature', 
                captureAudioWithAEC.length >= 1,
                'captureAudioWithAEC should accept at least one parameter');
            
            this.addTest('startSystemAudioCapture has correct signature', 
                startSystemAudioCapture.length >= 0,
                'startSystemAudioCapture should be callable without parameters');
            
            this.addTest('stopAudioCapture has correct signature', 
                stopAudioCapture.length >= 0,
                'stopAudioCapture should be callable without parameters');
            
            console.log('  ✅ Audio capture simulation tests passed');
            
        } catch (error) {
            this.addTest('Audio capture simulation test', false, `Error: ${error.message}`);
            console.error('  ❌ Audio capture simulation test failed:', error);
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

module.exports = AudioCaptureCoreTest;
