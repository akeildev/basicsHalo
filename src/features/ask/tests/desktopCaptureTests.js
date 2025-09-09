const desktopCaptureService = require('../services/desktopCaptureService');
const askService = require('../askService');

/**
 * Desktop Capture Tests - Tests desktop capture functionality for Ask feature
 */
class DesktopCaptureTests {
    constructor() {
        this.name = 'Desktop Capture Tests';
        this.tests = [];
    }

    /**
     * Run all desktop capture tests
     */
    async run(options = {}) {
        console.log('🖥️  Running desktop capture tests...');
        
        this.tests = [];
        
        // Test service initialization
        await this.testServiceInitialization();
        
        // Test source enumeration
        await this.testSourceEnumeration();
        
        // Test screenshot capture
        await this.testScreenshotCapture();
        
        // Test platform-specific features
        await this.testPlatformSpecificFeatures();
        
        // Test configuration management
        await this.testConfigurationManagement();
        
        // Test error handling
        await this.testErrorHandling();
        
        // Test performance
        await this.testPerformance();
        
        return this.getResults();
    }

    /**
     * Test service initialization
     */
    async testServiceInitialization() {
        const testName = 'Service Initialization';
        
        try {
            // Test desktop capture service initialization
            const initialized = await desktopCaptureService.initialize();
            if (!initialized) {
                throw new Error('Desktop capture service initialization failed');
            }
            
            // Test status
            const status = desktopCaptureService.getStatus();
            if (!status.isInitialized) {
                throw new Error('Desktop capture service should be initialized');
            }
            
            // Test Ask service initialization
            const askInitialized = await askService.initialize();
            if (!askInitialized) {
                throw new Error('Ask service initialization failed');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test source enumeration
     */
    async testSourceEnumeration() {
        const testName = 'Source Enumeration';
        
        try {
            // Test getting available sources
            const result = await desktopCaptureService.getAvailableSources();
            
            if (!result.success) {
                throw new Error('Failed to get available sources');
            }
            
            if (!Array.isArray(result.sources)) {
                throw new Error('Sources should be an array');
            }
            
            if (result.sources.length === 0) {
                throw new Error('Should have at least one source available');
            }
            
            // Test source properties
            const source = result.sources[0];
            if (!source.id || !source.name) {
                throw new Error('Source should have id and name');
            }
            
            if (!source.thumbnail) {
                throw new Error('Source should have thumbnail');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${result.sources.length} sources)`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test screenshot capture
     */
    async testScreenshotCapture() {
        const testName = 'Screenshot Capture';
        
        try {
            // Test basic screenshot capture
            const result = await desktopCaptureService.captureScreenshot({
                quality: 70,
                maxWidth: 1920,
                maxHeight: 1080
            });
            
            if (!result.success) {
                throw new Error('Screenshot capture failed');
            }
            
            if (!result.base64) {
                throw new Error('Screenshot should have base64 data');
            }
            
            if (!result.width || !result.height) {
                throw new Error('Screenshot should have dimensions');
            }
            
            if (typeof result.width !== 'number' || typeof result.height !== 'number') {
                throw new Error('Screenshot dimensions should be numbers');
            }
            
            // Test with Ask service integration
            const askResult = await askService.captureScreenshot({
                quality: 80
            });
            
            if (!askResult.success) {
                throw new Error('Ask service screenshot capture failed');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName} (${result.width}x${result.height})`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test platform-specific features
     */
    async testPlatformSpecificFeatures() {
        const testName = 'Platform-Specific Features';
        
        try {
            const platform = process.platform;
            
            // Test platform-specific setup
            switch (platform) {
                case 'win32':
                    await this.testWindowsFeatures();
                    break;
                case 'darwin':
                    await this.testMacOSFeatures();
                    break;
                case 'linux':
                    await this.testLinuxFeatures();
                    break;
                default:
                    console.log(`  ⏭️  ${testName} - Platform ${platform} not specifically tested`);
                    this.tests.push({ name: testName, passed: true, skipped: true });
                    return;
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test Windows-specific features
     */
    async testWindowsFeatures() {
        // Test display media handler setup
        const result = await desktopCaptureService.setupDisplayMediaHandler();
        if (!result.success) {
            throw new Error('Windows display media handler setup failed');
        }
    }

    /**
     * Test macOS-specific features
     */
    async testMacOSFeatures() {
        // Test permission checking
        const status = desktopCaptureService.getStatus();
        if (!status.isInitialized) {
            throw new Error('macOS service should be initialized');
        }
    }

    /**
     * Test Linux-specific features
     */
    async testLinuxFeatures() {
        // Test basic functionality
        const status = desktopCaptureService.getStatus();
        if (!status.isInitialized) {
            throw new Error('Linux service should be initialized');
        }
    }

    /**
     * Test configuration management
     */
    async testConfigurationManagement() {
        const testName = 'Configuration Management';
        
        try {
            // Test configuration update
            const newConfig = {
                defaultQuality: 80,
                maxWidth: 2560,
                maxHeight: 1440
            };
            
            desktopCaptureService.updateConfig(newConfig);
            
            // Test metrics
            const metrics = desktopCaptureService.getCaptureMetrics();
            if (!metrics.config) {
                throw new Error('Metrics should include configuration');
            }
            
            // Test metrics reset
            desktopCaptureService.resetMetrics();
            
            const resetMetrics = desktopCaptureService.getCaptureMetrics();
            if (resetMetrics.capturesPerformed !== 0) {
                throw new Error('Metrics should be reset');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        const testName = 'Error Handling';
        
        try {
            // Test invalid source capture
            try {
                await desktopCaptureService.captureSource('invalid-source-id');
                throw new Error('Should have thrown error for invalid source');
            } catch (error) {
                // Expected behavior
                if (!error.message.includes('not found')) {
                    throw new Error('Should have thrown source not found error');
                }
            }
            
            // Test invalid configuration
            try {
                desktopCaptureService.updateConfig({
                    defaultQuality: -1 // Invalid quality
                });
                // Should not throw, but should handle gracefully
            } catch (error) {
                // Configuration validation might throw
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test performance
     */
    async testPerformance() {
        const testName = 'Performance';
        
        try {
            // Test capture performance
            const startTime = Date.now();
            const result = await desktopCaptureService.captureScreenshot({
                quality: 70
            });
            const captureTime = Date.now() - startTime;
            
            if (!result.success) {
                throw new Error('Performance test capture failed');
            }
            
            // Performance threshold (should be under 5 seconds)
            if (captureTime > 5000) {
                throw new Error(`Capture took too long: ${captureTime}ms`);
            }
            
            // Test multiple captures
            const multiStartTime = Date.now();
            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push(desktopCaptureService.captureScreenshot({ quality: 50 }));
            }
            
            const results = await Promise.all(promises);
            const multiCaptureTime = Date.now() - multiStartTime;
            
            const successCount = results.filter(r => r.success).length;
            if (successCount < 2) {
                throw new Error('Multiple captures should mostly succeed');
            }
            
            this.tests.push({ 
                name: testName, 
                passed: true,
                metrics: {
                    singleCaptureTime: captureTime,
                    multiCaptureTime: multiCaptureTime,
                    successRate: successCount / results.length
                }
            });
            console.log(`  ✅ ${testName} (${captureTime}ms single, ${multiCaptureTime}ms multi)`);
            
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
        const skipped = this.tests.filter(t => t.skipped).length;
        const total = this.tests.length;
        
        return {
            name: this.name,
            total,
            passed,
            failed,
            skipped,
            tests: this.tests
        };
    }
}

module.exports = new DesktopCaptureTests();
