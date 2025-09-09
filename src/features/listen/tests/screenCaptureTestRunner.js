const { EventEmitter } = require('events');
const permissionService = require('../services/permissionService');
const listenCapture = require('../services/listenCapture');
const platformAudioCapture = require('../services/platformAudioCapture');
const audioProcessor = require('../services/audioProcessor');
const echoCancellation = require('../services/echoCancellation');
const listenService = require('../listenService');

/**
 * ScreenCaptureTestRunner - Comprehensive testing system for Clueless's screen capture functionality
 * Tests all components across different platforms and scenarios
 */
class ScreenCaptureTestRunner extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.testResults = new Map();
        this.currentTest = null;
        this.platform = process.platform;
        
        // Test configuration
        this.config = {
            timeout: 30000, // 30 seconds per test
            retries: 3,
            verbose: true,
            saveResults: true
        };
        
        // Test suites
        this.testSuites = {
            permissions: require('./testSuites/permissionTests'),
            capture: require('./testSuites/captureTests'),
            audioProcessing: require('./testSuites/audioProcessingTests'),
            platform: require('./testSuites/platformTests'),
            performance: require('./testSuites/performanceTests'),
            errorHandling: require('./testSuites/errorHandlingTests'),
            integration: require('./testSuites/integrationTests'),
            desktopCapture: require('../../ask/tests/desktopCaptureTests'),
            askIntegration: require('../../ask/tests/integrationTest')
        };
        
        // Metrics collection
        this.metrics = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            startTime: null,
            endTime: null,
            platform: this.platform,
            testResults: []
        };
    }

    /**
     * Run all test suites
     */
    async runAllTests(options = {}) {
        if (this.isRunning) {
            throw new Error('Test runner is already running');
        }

        this.isRunning = true;
        this.metrics.startTime = Date.now();
        this.metrics.totalTests = 0;
        this.metrics.passedTests = 0;
        this.metrics.failedTests = 0;
        this.metrics.skippedTests = 0;
        this.metrics.testResults = [];

        console.log('🧪 Starting Clueless Screen Capture Test Suite');
        console.log(`📱 Platform: ${this.platform}`);
        console.log(`⏱️  Timeout: ${this.config.timeout}ms`);
        console.log('=' * 60);

        try {
            // Initialize services
            await this.initializeServices();

            // Run test suites in order
            const suiteOrder = [
                'permissions',
                'platform', 
                'capture',
                'audioProcessing',
                'performance',
                'errorHandling',
                'integration',
                'desktopCapture',
                'askIntegration'
            ];

            for (const suiteName of suiteOrder) {
                if (options.suites && !options.suites.includes(suiteName)) {
                    continue;
                }

                await this.runTestSuite(suiteName, options);
            }

            // Generate final report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Test runner failed:', error);
            this.emit('error', error);
        } finally {
            this.isRunning = false;
            this.metrics.endTime = Date.now();
            await this.cleanup();
        }

        return this.getResults();
    }

    /**
     * Run a specific test suite
     */
    async runTestSuite(suiteName, options = {}) {
        const suite = this.testSuites[suiteName];
        if (!suite) {
            throw new Error(`Unknown test suite: ${suiteName}`);
        }

        console.log(`\n🔬 Running ${suiteName} tests...`);
        console.log('-'.repeat(40));

        try {
            const suiteResults = await suite.run({
                ...this.config,
                ...options,
                platform: this.platform
            });

            this.testResults.set(suiteName, suiteResults);
            this.updateMetrics(suiteResults);

            // Report suite results
            this.reportSuiteResults(suiteName, suiteResults);

        } catch (error) {
            console.error(`❌ Test suite ${suiteName} failed:`, error);
            this.emit('suiteError', { suite: suiteName, error });
        }
    }

    /**
     * Initialize all services for testing
     */
    async initializeServices() {
        console.log('🔧 Initializing services for testing...');

        try {
            // Initialize services in order
            await permissionService.initialize();
            await platformAudioCapture.initialize();
            await audioProcessor.initialize();
            await echoCancellation.initialize();
            await listenCapture.initialize();
            await listenService.initialize();

            console.log('✅ All services initialized successfully');

        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Update metrics from test results
     */
    updateMetrics(suiteResults) {
        this.metrics.totalTests += suiteResults.total;
        this.metrics.passedTests += suiteResults.passed;
        this.metrics.failedTests += suiteResults.failed;
        this.metrics.skippedTests += suiteResults.skipped;
        this.metrics.testResults.push(suiteResults);
    }

    /**
     * Report suite results
     */
    reportSuiteResults(suiteName, results) {
        const status = results.failed === 0 ? '✅' : '❌';
        console.log(`${status} ${suiteName}: ${results.passed}/${results.total} passed`);
        
        if (results.failed > 0) {
            console.log(`   Failed: ${results.failed}`);
        }
        if (results.skipped > 0) {
            console.log(`   Skipped: ${results.skipped}`);
        }
    }

    /**
     * Generate comprehensive test report
     */
    async generateReport() {
        console.log('\n📊 Test Report');
        console.log('=' * 60);
        
        const duration = this.metrics.endTime - this.metrics.startTime;
        const successRate = (this.metrics.passedTests / this.metrics.totalTests * 100).toFixed(1);
        
        console.log(`📱 Platform: ${this.metrics.platform}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`✅ Passed: ${this.metrics.passedTests}`);
        console.log(`❌ Failed: ${this.metrics.failedTests}`);
        console.log(`⏭️  Skipped: ${this.metrics.skippedTests}`);
        console.log(`📊 Total: ${this.metrics.totalTests}`);

        // Detailed results by suite
        console.log('\n📋 Detailed Results:');
        for (const [suiteName, results] of this.testResults) {
            console.log(`\n${suiteName}:`);
            for (const test of results.tests) {
                const status = test.passed ? '✅' : '❌';
                console.log(`  ${status} ${test.name}`);
                if (!test.passed && test.error) {
                    console.log(`     Error: ${test.error}`);
                }
            }
        }

        // Platform-specific recommendations
        this.generatePlatformRecommendations();

        // Save results if configured
        if (this.config.saveResults) {
            await this.saveResults();
        }
    }

    /**
     * Generate platform-specific recommendations
     */
    generatePlatformRecommendations() {
        console.log('\n💡 Platform Recommendations:');
        
        switch (this.platform) {
            case 'darwin':
                console.log('🍎 macOS:');
                console.log('  - Ensure SystemAudioDump binary is present and executable');
                console.log('  - Grant screen recording and microphone permissions');
                console.log('  - Test with different audio output devices');
                break;
                
            case 'win32':
                console.log('🪟 Windows:');
                console.log('  - Verify Windows audio loopback is working');
                console.log('  - Test with different audio drivers');
                console.log('  - Check Windows privacy settings for microphone access');
                break;
                
            case 'linux':
                console.log('🐧 Linux:');
                console.log('  - Install PulseAudio or ALSA development packages');
                console.log('  - Configure audio permissions for your user');
                console.log('  - Test with different audio subsystems');
                break;
        }
    }

    /**
     * Save test results to file
     */
    async saveResults() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            const resultsPath = path.join(__dirname, '../../../../test-results');
            await fs.mkdir(resultsPath, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screen-capture-test-${this.platform}-${timestamp}.json`;
            const filepath = path.join(resultsPath, filename);
            
            const report = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    platform: this.platform,
                    duration: this.metrics.endTime - this.metrics.startTime
                },
                summary: {
                    total: this.metrics.totalTests,
                    passed: this.metrics.passedTests,
                    failed: this.metrics.failedTests,
                    skipped: this.metrics.skippedTests,
                    successRate: (this.metrics.passedTests / this.metrics.totalTests * 100).toFixed(1)
                },
                results: Object.fromEntries(this.testResults)
            };
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            console.log(`💾 Results saved to: ${filepath}`);
            
        } catch (error) {
            console.error('❌ Failed to save results:', error);
        }
    }

    /**
     * Get test results
     */
    getResults() {
        return {
            metrics: this.metrics,
            results: Object.fromEntries(this.testResults),
            isComplete: !this.isRunning
        };
    }

    /**
     * Run a single test with timeout and retry logic
     */
    async runTest(testName, testFunction, options = {}) {
        const timeout = options.timeout || this.config.timeout;
        const retries = options.retries || this.config.retries;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`  🧪 ${testName} (attempt ${attempt}/${retries})`);
                
                const result = await Promise.race([
                    testFunction(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Test timeout')), timeout)
                    )
                ]);
                
                console.log(`  ✅ ${testName} passed`);
                return { name: testName, passed: true, result, attempt };
                
            } catch (error) {
                console.log(`  ❌ ${testName} failed (attempt ${attempt}): ${error.message}`);
                
                if (attempt === retries) {
                    return { name: testName, passed: false, error: error.message, attempt };
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            console.log('\n🧹 Cleaning up test resources...');
            
            // Stop any running services
            if (listenService.isListening) {
                await listenService.stopListening();
            }
            
            // Clean up services
            await listenService.cleanup();
            await audioProcessor.cleanup();
            await platformAudioCapture.cleanup();
            
            console.log('✅ Cleanup complete');
            
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    /**
     * Get current test status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentTest: this.currentTest,
            metrics: this.metrics,
            platform: this.platform
        };
    }
}

module.exports = new ScreenCaptureTestRunner();
