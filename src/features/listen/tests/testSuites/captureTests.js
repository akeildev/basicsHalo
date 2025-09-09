const { desktopCapturer } = require('electron');
const listenCapture = require('../../services/listenCapture');
const platformAudioCapture = require('../../services/platformAudioCapture');

/**
 * Capture Tests - Tests screen capture, microphone capture, and system audio capture
 */
class CaptureTests {
    constructor() {
        this.name = 'Capture Tests';
        this.tests = [];
    }

    /**
     * Run all capture tests
     */
    async run(options = {}) {
        console.log('📹 Running capture tests...');
        
        this.tests = [];
        const platform = options.platform || process.platform;
        
        // Test screen capture
        await this.testScreenCapture();
        
        // Test microphone capture
        await this.testMicrophoneCapture();
        
        // Test system audio capture
        await this.testSystemAudioCapture(platform);
        
        // Test combined capture
        await this.testCombinedCapture();
        
        // Test capture error handling
        await this.testCaptureErrorHandling();
        
        // Test capture performance
        await this.testCapturePerformance();
        
        return this.getResults();
    }

    /**
     * Test screen capture functionality
     */
    async testScreenCapture() {
        const testName = 'Screen Capture';
        
        try {
            // Test getting available sources
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 }
            });
            
            if (!Array.isArray(sources)) {
                throw new Error('getSources should return array');
            }
            
            if (sources.length === 0) {
                throw new Error('No screen sources available');
            }
            
            // Test source properties
            const source = sources[0];
            if (!source.id || !source.name) {
                throw new Error('Source should have id and name');
            }
            
            if (!source.thumbnail) {
                throw new Error('Source should have thumbnail');
            }
            
            // Test listenCapture screen capture initialization
            const captureInitialized = await listenCapture.initialize();
            if (!captureInitialized) {
                throw new Error('ListenCapture initialization failed');
            }
            
            // Test starting screen capture
            const screenCaptureStarted = await listenCapture.startScreenCapture({
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080
            });
            
            if (!screenCaptureStarted) {
                throw new Error('Screen capture failed to start');
            }
            
            // Test stopping screen capture
            await listenCapture.stopScreenCapture();
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test microphone capture functionality
     */
    async testMicrophoneCapture() {
        const testName = 'Microphone Capture';
        
        try {
            // Test microphone capture initialization
            const micCaptureStarted = await listenCapture.startMicrophoneCapture({
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 24000,
                channelCount: 1
            });
            
            if (!micCaptureStarted) {
                throw new Error('Microphone capture failed to start');
            }
            
            // Test microphone stream status
            const status = listenCapture.getStatus();
            if (!status.hasMicrophoneStream) {
                throw new Error('Microphone stream not detected');
            }
            
            // Test stopping microphone capture
            await listenCapture.stopMicrophoneCapture();
            
            // Verify microphone stream is stopped
            const statusAfterStop = listenCapture.getStatus();
            if (statusAfterStop.hasMicrophoneStream) {
                throw new Error('Microphone stream should be stopped');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test system audio capture functionality
     */
    async testSystemAudioCapture(platform) {
        const testName = 'System Audio Capture';
        
        try {
            // Test platform-specific system audio capture
            switch (platform) {
                case 'darwin':
                    await this.testMacOSSystemAudioCapture();
                    break;
                case 'win32':
                    await this.testWindowsSystemAudioCapture();
                    break;
                case 'linux':
                    await this.testLinuxSystemAudioCapture();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test macOS system audio capture
     */
    async testMacOSSystemAudioCapture() {
        // Test SystemAudioDump binary availability
        const path = require('path');
        const fs = require('fs');
        const systemAudioDumpPath = path.join(__dirname, '../../../../bin/SystemAudioDump');
        
        if (!fs.existsSync(systemAudioDumpPath)) {
            throw new Error('SystemAudioDump binary not found');
        }
        
        // Test system audio capture start
        const systemAudioStarted = await listenCapture.startSystemAudioCapture({
            sampleRate: 24000,
            channels: 1,
            format: 'float32'
        });
        
        if (!systemAudioStarted) {
            throw new Error('macOS system audio capture failed to start');
        }
        
        // Test stopping system audio capture
        await listenCapture.stopSystemAudioCapture();
    }

    /**
     * Test Windows system audio capture
     */
    async testWindowsSystemAudioCapture() {
        // Test Windows loopback audio capture
        const systemAudioStarted = await listenCapture.startSystemAudioCapture({
            sampleRate: 24000,
            channels: 1
        });
        
        if (!systemAudioStarted) {
            throw new Error('Windows system audio capture failed to start');
        }
        
        // Test stopping system audio capture
        await listenCapture.stopSystemAudioCapture();
    }

    /**
     * Test Linux system audio capture
     */
    async testLinuxSystemAudioCapture() {
        // Test Linux audio capture (PulseAudio/ALSA)
        const systemAudioStarted = await listenCapture.startSystemAudioCapture({
            sampleRate: 24000,
            channels: 1
        });
        
        if (!systemAudioStarted) {
            throw new Error('Linux system audio capture failed to start');
        }
        
        // Test stopping system audio capture
        await listenCapture.stopSystemAudioCapture();
    }

    /**
     * Test combined capture (screen + microphone + system audio)
     */
    async testCombinedCapture() {
        const testName = 'Combined Capture';
        
        try {
            // Test starting all capture types
            const combinedStarted = await listenCapture.startCapture({
                captureScreen: true,
                captureMicrophone: true,
                captureSystemAudio: true
            });
            
            if (!combinedStarted) {
                throw new Error('Combined capture failed to start');
            }
            
            // Test capture status
            const status = listenCapture.getStatus();
            if (!status.isCapturing) {
                throw new Error('Capture should be active');
            }
            
            // Test audio callback setup
            let audioDataReceived = false;
            listenCapture.setAudioCallback('onMicrophoneData', (data) => {
                audioDataReceived = true;
            });
            
            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Test stopping combined capture
            await listenCapture.stopCapture();
            
            // Verify capture is stopped
            const statusAfterStop = listenCapture.getStatus();
            if (statusAfterStop.isCapturing) {
                throw new Error('Capture should be stopped');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test capture error handling
     */
    async testCaptureErrorHandling() {
        const testName = 'Capture Error Handling';
        
        try {
            // Test starting capture without initialization
            const uninitializedCapture = require('../../services/listenCapture');
            // Reset initialization state for testing
            uninitializedCapture.isInitialized = false;
            
            try {
                await uninitializedCapture.startCapture();
                throw new Error('Should have thrown error for uninitialized capture');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('not initialized')) {
                    throw new Error('Should have thrown initialization error');
                }
            }
            
            // Test starting capture when already capturing
            await listenCapture.initialize();
            await listenCapture.startCapture();
            
            try {
                await listenCapture.startCapture();
                throw new Error('Should have thrown error for already capturing');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('already capturing')) {
                    throw new Error('Should have thrown already capturing error');
                }
            }
            
            // Clean up
            await listenCapture.stopCapture();
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test capture performance
     */
    async testCapturePerformance() {
        const testName = 'Capture Performance';
        
        try {
            // Test capture start time
            const startTime = Date.now();
            await listenCapture.startCapture();
            const startDuration = Date.now() - startTime;
            
            if (startDuration > 5000) {
                throw new Error(`Capture start took too long: ${startDuration}ms`);
            }
            
            // Test capture status retrieval performance
            const statusStartTime = Date.now();
            const status = listenCapture.getStatus();
            const statusDuration = Date.now() - statusStartTime;
            
            if (statusDuration > 100) {
                throw new Error(`Status retrieval took too long: ${statusDuration}ms`);
            }
            
            // Test capture stop time
            const stopStartTime = Date.now();
            await listenCapture.stopCapture();
            const stopDuration = Date.now() - stopStartTime;
            
            if (stopDuration > 3000) {
                throw new Error(`Capture stop took too long: ${stopDuration}ms`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    startDuration,
                    statusDuration,
                    stopDuration
                }
            });
            console.log(`  ✅ ${testName} (start: ${startDuration}ms, stop: ${stopDuration}ms)`);
            
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

module.exports = new CaptureTests();
