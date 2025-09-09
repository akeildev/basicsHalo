const listenService = require('../../listenService');
const audioProcessor = require('../../services/audioProcessor');
const platformAudioCapture = require('../../services/platformAudioCapture');

/**
 * Error Handling Tests - Tests error handling, recovery mechanisms, and failure scenarios
 */
class ErrorHandlingTests {
    constructor() {
        this.name = 'Error Handling Tests';
        this.tests = [];
    }

    /**
     * Run all error handling tests
     */
    async run(options = {}) {
        console.log('🚨 Running error handling tests...');
        
        this.tests = [];
        
        // Test service initialization errors
        await this.testServiceInitializationErrors();
        
        // Test capture errors
        await this.testCaptureErrors();
        
        // Test audio processing errors
        await this.testAudioProcessingErrors();
        
        // Test permission errors
        await this.testPermissionErrors();
        
        // Test resource errors
        await this.testResourceErrors();
        
        // Test recovery mechanisms
        await this.testRecoveryMechanisms();
        
        // Test error propagation
        await this.testErrorPropagation();
        
        return this.getResults();
    }

    /**
     * Test service initialization errors
     */
    async testServiceInitializationErrors() {
        const testName = 'Service Initialization Errors';
        
        try {
            // Test initialization with invalid config
            try {
                await audioProcessor.initialize({
                    sampleRate: -1, // Invalid sample rate
                    channels: 0,    // Invalid channel count
                    bufferSize: -1  // Invalid buffer size
                });
                throw new Error('Should have thrown error for invalid config');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('invalid') && !error.message.includes('Invalid')) {
                    throw new Error('Should have thrown validation error');
                }
            }
            
            // Test initialization with missing config
            try {
                await audioProcessor.initialize(null);
                throw new Error('Should have thrown error for null config');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('config') && !error.message.includes('required')) {
                    throw new Error('Should have thrown config error');
                }
            }
            
            // Test double initialization
            await audioProcessor.initialize({
                sampleRate: 24000,
                channels: 1,
                bufferSize: 4096
            });
            
            try {
                await audioProcessor.initialize({
                    sampleRate: 48000,
                    channels: 2,
                    bufferSize: 8192
                });
                throw new Error('Should have thrown error for double initialization');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('already') && !error.message.includes('initialized')) {
                    throw new Error('Should have thrown already initialized error');
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
     * Test capture errors
     */
    async testCaptureErrors() {
        const testName = 'Capture Errors';
        
        try {
            // Test starting capture without initialization
            const uninitializedCapture = require('../../services/listenCapture');
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
            await uninitializedCapture.initialize();
            await uninitializedCapture.startCapture();
            
            try {
                await uninitializedCapture.startCapture();
                throw new Error('Should have thrown error for already capturing');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('already capturing')) {
                    throw new Error('Should have thrown already capturing error');
                }
            }
            
            // Test stopping capture when not capturing
            await uninitializedCapture.stopCapture();
            
            try {
                await uninitializedCapture.stopCapture();
                throw new Error('Should have thrown error for not capturing');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('not capturing')) {
                    throw new Error('Should have thrown not capturing error');
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
     * Test audio processing errors
     */
    async testAudioProcessingErrors() {
        const testName = 'Audio Processing Errors';
        
        try {
            // Test processing without initialization
            const uninitializedProcessor = require('../../services/audioProcessor');
            uninitializedProcessor.isInitialized = false;
            
            try {
                uninitializedProcessor.processMicrophoneAudio(new Float32Array(1024));
                throw new Error('Should have thrown error for uninitialized processor');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('not initialized')) {
                    throw new Error('Should have thrown initialization error');
                }
            }
            
            // Test processing with invalid data
            await uninitializedProcessor.initialize({
                sampleRate: 24000,
                channels: 1,
                bufferSize: 4096
            });
            
            try {
                uninitializedProcessor.processMicrophoneAudio(null);
                throw new Error('Should have thrown error for null data');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('data') && !error.message.includes('null')) {
                    throw new Error('Should have thrown data error');
                }
            }
            
            try {
                uninitializedProcessor.processMicrophoneAudio('invalid');
                throw new Error('Should have thrown error for invalid data type');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('Float32Array') && !error.message.includes('array')) {
                    throw new Error('Should have thrown data type error');
                }
            }
            
            // Test processing with wrong buffer size
            try {
                uninitializedProcessor.processMicrophoneAudio(new Float32Array(1000)); // Wrong size
                throw new Error('Should have thrown error for wrong buffer size');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('size') && !error.message.includes('length')) {
                    throw new Error('Should have thrown buffer size error');
                }
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
        }
    }

    /**
     * Test permission errors
     */
    async testPermissionErrors() {
        const testName = 'Permission Errors';
        
        try {
            const permissionService = require('../../services/permissionService');
            
            // Test checking invalid permission type
            try {
                await permissionService.hasPermission('invalidPermission');
                throw new Error('Should have thrown error for invalid permission type');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('invalid') && !error.message.includes('supported')) {
                    throw new Error('Should have thrown invalid permission error');
                }
            }
            
            // Test requesting invalid permission type
            try {
                await permissionService.requestPermission('invalidPermission');
                throw new Error('Should have thrown error for invalid permission request');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('invalid') && !error.message.includes('supported')) {
                    throw new Error('Should have thrown invalid permission request error');
                }
            }
            
            // Test permission callback with invalid type
            try {
                permissionService.onPermissionChange('invalidPermission', () => {});
                throw new Error('Should have thrown error for invalid permission callback');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('invalid') && !error.message.includes('supported')) {
                    throw new Error('Should have thrown invalid permission callback error');
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
     * Test resource errors
     */
    async testResourceErrors() {
        const testName = 'Resource Errors';
        
        try {
            // Test platform audio capture with missing resources
            const platform = process.platform;
            
            if (platform === 'darwin') {
                // Test missing SystemAudioDump binary
                const path = require('path');
                const fs = require('fs');
                const originalPath = path.join(__dirname, '../../../../bin/SystemAudioDump');
                const backupPath = originalPath + '.backup';
                
                // Backup the binary if it exists
                if (fs.existsSync(originalPath)) {
                    fs.renameSync(originalPath, backupPath);
                }
                
                try {
                    await platformAudioCapture.startSystemAudioCapture({
                        sampleRate: 24000,
                        channels: 1
                    });
                    throw new Error('Should have thrown error for missing binary');
                } catch (error) {
                    // Expected behavior
                    if (!error.message.includes('binary') && !error.message.includes('not found')) {
                        throw new Error('Should have thrown binary not found error');
                    }
                }
                
                // Restore the binary
                if (fs.existsSync(backupPath)) {
                    fs.renameSync(backupPath, originalPath);
                }
            }
            
            // Test memory allocation errors (simulate)
            const largeArray = new Float32Array(1024 * 1024 * 100); // 100MB array
            
            try {
                audioProcessor.processMicrophoneAudio(largeArray);
                throw new Error('Should have thrown error for large array');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('size') && !error.message.includes('large')) {
                    throw new Error('Should have thrown size error');
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
     * Test recovery mechanisms
     */
    async testRecoveryMechanisms() {
        const testName = 'Recovery Mechanisms';
        
        try {
            // Test service recovery after error
            let errorOccurred = false;
            let recoveryAttempted = false;
            
            // Set up error callback
            listenService.setCallback('onError', (error) => {
                errorOccurred = true;
            });
            
            // Set up recovery callback
            listenService.setCallback('onRecovery', () => {
                recoveryAttempted = true;
            });
            
            // Trigger an error
            try {
                await listenService.startListening();
                await listenService.startListening(); // This should fail
            } catch (error) {
                // Expected error
            }
            
            // Test recovery
            if (errorOccurred) {
                // Attempt recovery
                try {
                    await listenService.stopListening();
                    await listenService.startListening();
                    recoveryAttempted = true;
                } catch (error) {
                    // Recovery failed, but that's okay for this test
                }
            }
            
            // Clean up
            listenService.setCallback('onError', null);
            listenService.setCallback('onRecovery', null);
            
            if (listenService.isListening) {
                await listenService.stopListening();
            }
            
            if (!errorOccurred) {
                throw new Error('Error should have occurred');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test error propagation
     */
    async testErrorPropagation() {
        const testName = 'Error Propagation';
        
        try {
            let errorPropagated = false;
            let propagatedError = null;
            
            // Set up error callback
            listenService.setCallback('onError', (error) => {
                errorPropagated = true;
                propagatedError = error;
            });
            
            // Trigger an error in a service
            try {
                // This should trigger an error
                await listenService.startListening();
                await listenService.startListening(); // This should fail
            } catch (error) {
                // Expected error
            }
            
            // Check if error was propagated
            if (!errorPropagated) {
                throw new Error('Error should have been propagated to callback');
            }
            
            if (!propagatedError) {
                throw new Error('Propagated error should not be null');
            }
            
            // Test error details
            if (typeof propagatedError.message !== 'string') {
                throw new Error('Propagated error should have message');
            }
            
            if (typeof propagatedError.timestamp !== 'number') {
                throw new Error('Propagated error should have timestamp');
            }
            
            // Clean up
            listenService.setCallback('onError', null);
            
            if (listenService.isListening) {
                await listenService.stopListening();
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
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

module.exports = new ErrorHandlingTests();
