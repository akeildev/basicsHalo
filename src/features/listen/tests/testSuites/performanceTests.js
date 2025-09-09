const listenService = require('../../listenService');
const audioProcessor = require('../../services/audioProcessor');
const echoCancellation = require('../../services/echoCancellation');

/**
 * Performance Tests - Tests performance monitoring, metrics collection, and optimization
 */
class PerformanceTests {
    constructor() {
        this.name = 'Performance Tests';
        this.tests = [];
    }

    /**
     * Run all performance tests
     */
    async run(options = {}) {
        console.log('⚡ Running performance tests...');
        
        this.tests = [];
        
        // Test audio processing performance
        await this.testAudioProcessingPerformance();
        
        // Test echo cancellation performance
        await this.testEchoCancellationPerformance();
        
        // Test memory usage
        await this.testMemoryUsage();
        
        // Test CPU usage
        await this.testCPUUsage();
        
        // Test latency measurements
        await this.testLatencyMeasurements();
        
        // Test throughput
        await this.testThroughput();
        
        // Test resource cleanup
        await this.testResourceCleanup();
        
        return this.getResults();
    }

    /**
     * Test audio processing performance
     */
    async testAudioProcessingPerformance() {
        const testName = 'Audio Processing Performance';
        
        try {
            const frameSize = 4096;
            const numFrames = 100;
            const testFrame = new Float32Array(frameSize);
            
            // Fill with test data
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            audioProcessor.startProcessing();
            
            const startTime = performance.now();
            
            // Process multiple frames
            for (let i = 0; i < numFrames; i++) {
                audioProcessor.processMicrophoneAudio(testFrame);
            }
            
            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerFrame = totalTime / numFrames;
            
            audioProcessor.stopProcessing();
            
            // Performance thresholds
            if (avgTimePerFrame > 50) { // 50ms per frame is too slow
                throw new Error(`Average processing time too high: ${avgTimePerFrame.toFixed(2)}ms per frame`);
            }
            
            // Get metrics
            const metrics = audioProcessor.getMetrics();
            
            if (metrics.averageProcessingTime > 50) {
                throw new Error(`Metrics show high processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    totalTime,
                    avgTimePerFrame,
                    framesProcessed: numFrames,
                    averageProcessingTime: metrics.averageProcessingTime
                }
            });
            console.log(`  ✅ ${testName} (${avgTimePerFrame.toFixed(2)}ms/frame)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test echo cancellation performance
     */
    async testEchoCancellationPerformance() {
        const testName = 'Echo Cancellation Performance';
        
        try {
            const frameSize = 4096;
            const numFrames = 50;
            const microphoneFrame = new Float32Array(frameSize);
            const systemAudioFrame = new Float32Array(frameSize);
            
            // Fill with test data
            for (let i = 0; i < frameSize; i++) {
                microphoneFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
                systemAudioFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.05;
            }
            
            const startTime = performance.now();
            
            // Process multiple frames
            for (let i = 0; i < numFrames; i++) {
                echoCancellation.processFrame(microphoneFrame, systemAudioFrame);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerFrame = totalTime / numFrames;
            
            // Performance thresholds for echo cancellation
            if (avgTimePerFrame > 20) { // 20ms per frame is too slow
                throw new Error(`Echo cancellation too slow: ${avgTimePerFrame.toFixed(2)}ms per frame`);
            }
            
            // Get metrics
            const metrics = echoCancellation.getMetrics();
            
            if (metrics.processedFrames !== numFrames) {
                throw new Error(`Expected ${numFrames} processed frames, got ${metrics.processedFrames}`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    totalTime,
                    avgTimePerFrame,
                    framesProcessed: numFrames,
                    echoReduction: metrics.echoReduction
                }
            });
            console.log(`  ✅ ${testName} (${avgTimePerFrame.toFixed(2)}ms/frame, ${metrics.echoReduction.toFixed(1)}dB reduction)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test memory usage
     */
    async testMemoryUsage() {
        const testName = 'Memory Usage';
        
        try {
            // Get initial memory usage
            const initialMemory = process.memoryUsage();
            
            // Process a lot of audio data
            const frameSize = 4096;
            const numFrames = 1000;
            const testFrame = new Float32Array(frameSize);
            
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            audioProcessor.startProcessing();
            
            for (let i = 0; i < numFrames; i++) {
                audioProcessor.processMicrophoneAudio(testFrame);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            audioProcessor.stopProcessing();
            
            // Get final memory usage
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
            
            // Memory increase should be reasonable (less than 100MB)
            if (memoryIncreaseMB > 100) {
                throw new Error(`Memory usage increased too much: ${memoryIncreaseMB.toFixed(2)}MB`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    initialMemoryMB: initialMemory.heapUsed / 1024 / 1024,
                    finalMemoryMB: finalMemory.heapUsed / 1024 / 1024,
                    memoryIncreaseMB,
                    framesProcessed: numFrames
                }
            });
            console.log(`  ✅ ${testName} (+${memoryIncreaseMB.toFixed(2)}MB for ${numFrames} frames)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test CPU usage
     */
    async testCPUUsage() {
        const testName = 'CPU Usage';
        
        try {
            const frameSize = 4096;
            const numFrames = 100;
            const testFrame = new Float32Array(frameSize);
            
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            // Measure CPU usage during processing
            const startTime = process.hrtime.bigint();
            const startCPU = process.cpuUsage();
            
            audioProcessor.startProcessing();
            
            for (let i = 0; i < numFrames; i++) {
                audioProcessor.processMicrophoneAudio(testFrame);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            audioProcessor.stopProcessing();
            
            const endTime = process.hrtime.bigint();
            const endCPU = process.cpuUsage(startCPU);
            
            const wallTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            const cpuTime = (endCPU.user + endCPU.system) / 1000; // Convert to milliseconds
            const cpuUsagePercent = (cpuTime / wallTime) * 100;
            
            // CPU usage should be reasonable (less than 50% for this test)
            if (cpuUsagePercent > 50) {
                throw new Error(`CPU usage too high: ${cpuUsagePercent.toFixed(1)}%`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    wallTime,
                    cpuTime,
                    cpuUsagePercent,
                    framesProcessed: numFrames
                }
            });
            console.log(`  ✅ ${testName} (${cpuUsagePercent.toFixed(1)}% CPU)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test latency measurements
     */
    async testLatencyMeasurements() {
        const testName = 'Latency Measurements';
        
        try {
            const frameSize = 4096;
            const testFrame = new Float32Array(frameSize);
            
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            let firstChunkTime = null;
            let lastChunkTime = null;
            let chunkCount = 0;
            
            audioProcessor.setCallback('onAudioChunk', (chunkData) => {
                const now = Date.now();
                if (firstChunkTime === null) {
                    firstChunkTime = now;
                }
                lastChunkTime = now;
                chunkCount++;
            });
            
            audioProcessor.startProcessing();
            
            // Process audio and measure latency
            const startTime = Date.now();
            audioProcessor.processMicrophoneAudio(testFrame);
            
            // Wait for first chunk
            await new Promise(resolve => setTimeout(resolve, 200));
            
            audioProcessor.stopProcessing();
            
            if (chunkCount === 0) {
                throw new Error('No audio chunks were generated');
            }
            
            const firstChunkLatency = firstChunkTime - startTime;
            const totalLatency = lastChunkTime - startTime;
            const avgLatency = totalLatency / chunkCount;
            
            // Latency should be reasonable (less than 200ms for first chunk)
            if (firstChunkLatency > 200) {
                throw new Error(`First chunk latency too high: ${firstChunkLatency}ms`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    firstChunkLatency,
                    totalLatency,
                    avgLatency,
                    chunkCount
                }
            });
            console.log(`  ✅ ${testName} (${firstChunkLatency}ms first chunk, ${avgLatency.toFixed(1)}ms avg)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test throughput
     */
    async testThroughput() {
        const testName = 'Throughput';
        
        try {
            const frameSize = 4096;
            const testFrame = new Float32Array(frameSize);
            
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            let processedChunks = 0;
            audioProcessor.setCallback('onAudioChunk', (chunkData) => {
                processedChunks++;
            });
            
            audioProcessor.startProcessing();
            
            const startTime = Date.now();
            
            // Process audio continuously for 1 second
            const endTime = startTime + 1000;
            let frameCount = 0;
            
            while (Date.now() < endTime) {
                audioProcessor.processMicrophoneAudio(testFrame);
                frameCount++;
                
                // Small delay to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            audioProcessor.stopProcessing();
            
            const actualDuration = Date.now() - startTime;
            const throughput = (processedChunks * frameSize) / (actualDuration / 1000); // samples per second
            
            // Throughput should be reasonable (at least 24kHz for real-time)
            if (throughput < 24000) {
                throw new Error(`Throughput too low: ${throughput.toFixed(0)} samples/sec`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    processedChunks,
                    frameCount,
                    actualDuration,
                    throughput
                }
            });
            console.log(`  ✅ ${testName} (${throughput.toFixed(0)} samples/sec)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test resource cleanup
     */
    async testResourceCleanup() {
        const testName = 'Resource Cleanup';
        
        try {
            // Get initial memory
            const initialMemory = process.memoryUsage();
            
            // Process a lot of data
            const frameSize = 4096;
            const numFrames = 500;
            const testFrame = new Float32Array(frameSize);
            
            for (let i = 0; i < frameSize; i++) {
                testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.1;
            }
            
            audioProcessor.startProcessing();
            
            for (let i = 0; i < numFrames; i++) {
                audioProcessor.processMicrophoneAudio(testFrame);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            audioProcessor.stopProcessing();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get final memory
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
            
            // Memory should be cleaned up reasonably well (less than 50MB increase)
            if (memoryIncreaseMB > 50) {
                throw new Error(`Memory not cleaned up properly: ${memoryIncreaseMB.toFixed(2)}MB increase`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    initialMemoryMB: initialMemory.heapUsed / 1024 / 1024,
                    finalMemoryMB: finalMemory.heapUsed / 1024 / 1024,
                    memoryIncreaseMB,
                    framesProcessed: numFrames
                }
            });
            console.log(`  ✅ ${testName} (+${memoryIncreaseMB.toFixed(2)}MB after cleanup)`);
            
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

module.exports = new PerformanceTests();
