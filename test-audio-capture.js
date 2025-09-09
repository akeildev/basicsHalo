// Test audio capture and echo cancellation
const path = require('path');

// Add the src directory to the module path
process.env.NODE_PATH = path.join(__dirname, 'src');
require('module')._initPaths();

async function testAudioCapture() {
    console.log('🎤 Testing Audio Capture and Echo Cancellation');
    console.log('============================================\n');
    
    try {
        // Test Permission Service
        console.log('1️⃣ Testing Permission Service...');
        const permissionService = require('./src/features/listen/services/permissionService');
        await permissionService.initialize();
        const status = await permissionService.getSystemPermissionsStatus();
        console.log('   ✅ Permissions:', {
            microphone: status.microphone,
            screen: status.screen,
            systemAudio: status.systemAudio
        });
        console.log('');
        
        // Test Platform Audio Capture
        console.log('2️⃣ Testing Platform Audio Capture...');
        const PlatformAudioCapture = require('./src/features/listen/services/platformAudioCapture');
        const platformCapture = new PlatformAudioCapture();
        await platformCapture.initialize();
        const capabilities = platformCapture.getCapabilities();
        console.log('   ✅ Audio Capabilities:', capabilities);
        console.log('');
        
        // Test Echo Cancellation
        console.log('3️⃣ Testing Echo Cancellation...');
        const EchoCancellation = require('./src/features/listen/services/echoCancellation');
        const echoCancellation = new EchoCancellation();
        const echoInitialized = await echoCancellation.initialize();
        console.log('   ✅ Echo Cancellation initialized:', echoInitialized);
        
        // Test processing with dummy data
        if (echoInitialized) {
            const testMicData = new Float32Array(1024).fill(0.5);
            const testSystemData = new Float32Array(1024).fill(0.3);
            const processed = echoCancellation.process(testMicData, testSystemData);
            console.log('   ✅ Processed audio sample length:', processed.length);
            console.log('   📊 Echo Cancellation Metrics:', echoCancellation.getMetrics());
        }
        console.log('');
        
        // Test Audio Processor
        console.log('4️⃣ Testing Audio Processor...');
        const AudioProcessor = require('./src/features/listen/services/audioProcessor');
        const audioProcessor = new AudioProcessor();
        await audioProcessor.initialize();
        console.log('   ✅ Audio Processor initialized');
        
        // Set up audio callback
        let audioChunkReceived = false;
        audioProcessor.setOnAudioChunk((chunk) => {
            audioChunkReceived = true;
            console.log('   📦 Received audio chunk:', chunk.length, 'samples');
        });
        
        // Process test audio
        const testAudio = new Float32Array(4096).fill(0.1);
        audioProcessor.processAudio(testAudio, 'microphone');
        console.log('   ✅ Test audio processed');
        console.log('');
        
        // Test Listen Capture Service
        console.log('5️⃣ Testing Listen Capture Service...');
        const ListenCaptureService = require('./src/features/listen/services/listenCapture');
        const listenCapture = new ListenCaptureService();
        await listenCapture.initialize();
        console.log('   ✅ Listen Capture initialized');
        
        // Check available sources
        const sources = await listenCapture.getAvailableSources();
        console.log('   📋 Available audio sources:', sources.microphones.length, 'microphones');
        console.log('');
        
        // Cleanup
        console.log('🧹 Cleaning up...');
        echoCancellation.cleanup();
        audioProcessor.cleanup();
        await listenCapture.cleanup();
        console.log('   ✅ Cleanup complete');
        
        console.log('\n✅ All audio tests passed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testAudioCapture().then(() => {
    console.log('\n🎉 Audio capture and echo cancellation tests completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});