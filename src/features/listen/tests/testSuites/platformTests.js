const os = require('os');
const platformAudioCapture = require('../../services/platformAudioCapture');

/**
 * Platform Tests - Tests platform-specific functionality and compatibility
 */
class PlatformTests {
    constructor() {
        this.name = 'Platform Tests';
        this.tests = [];
    }

    /**
     * Run all platform tests
     */
    async run(options = {}) {
        console.log('🖥️  Running platform tests...');
        
        this.tests = [];
        const platform = options.platform || process.platform;
        
        // Test platform detection
        await this.testPlatformDetection(platform);
        
        // Test platform-specific audio capabilities
        await this.testPlatformAudioCapabilities(platform);
        
        // Test platform-specific binaries
        await this.testPlatformBinaries(platform);
        
        // Test platform-specific permissions
        await this.testPlatformPermissions(platform);
        
        // Test platform compatibility
        await this.testPlatformCompatibility(platform);
        
        return this.getResults();
    }

    /**
     * Test platform detection
     */
    async testPlatformDetection(platform) {
        const testName = 'Platform Detection';
        
        try {
            // Test that platform is correctly detected
            if (platform !== process.platform) {
                throw new Error(`Platform mismatch: expected ${platform}, got ${process.platform}`);
            }
            
            // Test platform-specific properties
            const platformInfo = {
                platform: process.platform,
                arch: process.arch,
                version: os.release(),
                type: os.type(),
                hostname: os.hostname()
            };
            
            if (!platformInfo.platform) {
                throw new Error('Platform should be detected');
            }
            
            if (!platformInfo.arch) {
                throw new Error('Architecture should be detected');
            }
            
            if (!platformInfo.version) {
                throw new Error('OS version should be detected');
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                platformInfo
            });
            console.log(`  ✅ ${testName} (${platformInfo.platform} ${platformInfo.arch})`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test platform-specific audio capabilities
     */
    async testPlatformAudioCapabilities(platform) {
        const testName = 'Platform Audio Capabilities';
        
        try {
            const capabilities = platformAudioCapture.getAudioCapabilities();
            
            if (capabilities.platform !== platform) {
                throw new Error(`Capabilities platform mismatch: expected ${platform}, got ${capabilities.platform}`);
            }
            
            // Test platform-specific capabilities
            switch (platform) {
                case 'darwin':
                    if (!capabilities.systemAudio) {
                        throw new Error('macOS should support system audio');
                    }
                    if (!capabilities.echoCancellation) {
                        throw new Error('macOS should support echo cancellation');
                    }
                    break;
                    
                case 'win32':
                    if (!capabilities.loopback) {
                        throw new Error('Windows should support loopback audio');
                    }
                    if (!capabilities.echoCancellation) {
                        throw new Error('Windows should support echo cancellation');
                    }
                    break;
                    
                case 'linux':
                    if (!capabilities.systemAudio) {
                        throw new Error('Linux should support system audio');
                    }
                    if (!capabilities.echoCancellation) {
                        throw new Error('Linux should support echo cancellation');
                    }
                    break;
                    
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                capabilities
            });
            console.log(`  ✅ ${testName} (${Object.keys(capabilities).filter(k => capabilities[k]).join(', ')})`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test platform-specific binaries
     */
    async testPlatformBinaries(platform) {
        const testName = 'Platform Binaries';
        
        try {
            const path = require('path');
            const fs = require('fs');
            
            switch (platform) {
                case 'darwin':
                    await this.testMacOSBinaries();
                    break;
                    
                case 'win32':
                    await this.testWindowsBinaries();
                    break;
                    
                case 'linux':
                    await this.testLinuxBinaries();
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
     * Test macOS-specific binaries
     */
    async testMacOSBinaries() {
        const path = require('path');
        const fs = require('fs');
        
        // Test SystemAudioDump binary
        const systemAudioDumpPath = path.join(__dirname, '../../../../bin/SystemAudioDump');
        
        if (!fs.existsSync(systemAudioDumpPath)) {
            throw new Error('SystemAudioDump binary not found');
        }
        
        // Test if binary is executable
        const stats = fs.statSync(systemAudioDumpPath);
        if ((stats.mode & parseInt('111', 8)) === 0) {
            throw new Error('SystemAudioDump binary is not executable');
        }
    }

    /**
     * Test Windows-specific binaries
     */
    async testWindowsBinaries() {
        // Windows doesn't require external binaries for basic functionality
        // Test that we can access Windows audio APIs
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
            exec('powershell -Command "Get-AudioDevice"', (error, stdout, stderr) => {
                if (error && !stdout.includes('AudioDevice')) {
                    reject(new Error('Windows audio device detection failed'));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Test Linux-specific binaries
     */
    async testLinuxBinaries() {
        const { exec } = require('child_process');
        
        // Test for PulseAudio
        const pulseAudioTest = new Promise((resolve, reject) => {
            exec('which pulseaudio', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('PulseAudio not found'));
                } else {
                    resolve();
                }
            });
        });
        
        // Test for ALSA
        const alsaTest = new Promise((resolve, reject) => {
            exec('which aplay', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('ALSA not found'));
                } else {
                    resolve();
                }
            });
        });
        
        // At least one should work
        try {
            await pulseAudioTest;
        } catch (pulseError) {
            try {
                await alsaTest;
            } catch (alsaError) {
                throw new Error('Neither PulseAudio nor ALSA found');
            }
        }
    }

    /**
     * Test platform-specific permissions
     */
    async testPlatformPermissions(platform) {
        const testName = 'Platform Permissions';
        
        try {
            const permissionService = require('../../services/permissionService');
            
            // Test platform-specific permission types
            const permissionTypes = ['microphone', 'screen'];
            if (platform === 'darwin') {
                permissionTypes.push('systemAudio');
            }
            
            for (const permissionType of permissionTypes) {
                const hasPermission = await permissionService.hasPermission(permissionType);
                if (typeof hasPermission !== 'boolean') {
                    throw new Error(`Permission check for ${permissionType} should return boolean`);
                }
            }
            
            // Test platform-specific permission requests
            for (const permissionType of permissionTypes) {
                const granted = await permissionService.requestPermission(permissionType);
                if (typeof granted !== 'boolean') {
                    throw new Error(`Permission request for ${permissionType} should return boolean`);
                }
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${permissionTypes.join(', ')})`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test platform compatibility
     */
    async testPlatformCompatibility(platform) {
        const testName = 'Platform Compatibility';
        
        try {
            // Test that all services can initialize on this platform
            const listenService = require('../../listenService');
            const initialized = await listenService.initialize();
            
            if (!initialized) {
                throw new Error('Listen service failed to initialize on this platform');
            }
            
            // Test platform-specific features
            switch (platform) {
                case 'darwin':
                    await this.testMacOSCompatibility();
                    break;
                    
                case 'win32':
                    await this.testWindowsCompatibility();
                    break;
                    
                case 'linux':
                    await this.testLinuxCompatibility();
                    break;
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test macOS compatibility
     */
    async testMacOSCompatibility() {
        // Test macOS-specific features
        const { systemPreferences } = require('electron');
        
        // Test media access status
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        const screenStatus = systemPreferences.getMediaAccessStatus('screen');
        
        if (typeof micStatus !== 'string') {
            throw new Error('Microphone access status should be string');
        }
        
        if (typeof screenStatus !== 'string') {
            throw new Error('Screen access status should be string');
        }
    }

    /**
     * Test Windows compatibility
     */
    async testWindowsCompatibility() {
        // Test Windows-specific features
        const { desktopCapturer } = require('electron');
        
        // Test desktop capturer
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 150, height: 150 }
        });
        
        if (!Array.isArray(sources)) {
            throw new Error('Desktop capturer should return array');
        }
    }

    /**
     * Test Linux compatibility
     */
    async testLinuxCompatibility() {
        // Test Linux-specific features
        const { desktopCapturer } = require('electron');
        
        // Test desktop capturer
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 150, height: 150 }
        });
        
        if (!Array.isArray(sources)) {
            throw new Error('Desktop capturer should return array');
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

module.exports = new PlatformTests();
