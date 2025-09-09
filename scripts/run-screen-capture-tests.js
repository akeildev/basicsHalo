#!/usr/bin/env node

/**
 * Screen Capture Test Runner CLI
 * Runs comprehensive tests for Clueless's screen capture functionality
 */

const path = require('path');
const { app } = require('electron');

// Add the src directory to the module path
process.env.NODE_PATH = path.join(__dirname, '../src');
require('module')._initPaths();

async function main() {
    console.log('🧪 Clueless Screen Capture Test Runner');
    console.log('=====================================\n');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);
    
    try {
        // Initialize Electron app
        await app.whenReady();
        
        // Import and run the test runner
        const testRunner = require('../src/features/listen/tests/screenCaptureTestRunner');
        
        // Run tests
        const results = await testRunner.runAllTests(options);
        
        // Print summary
        printSummary(results);
        
        // Exit with appropriate code
        process.exit(results.metrics.failedTests > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArguments(args) {
    const options = {
        suites: [],
        verbose: false,
        timeout: 30000,
        retries: 3,
        saveResults: true
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--suites':
                if (i + 1 < args.length) {
                    options.suites = args[i + 1].split(',');
                    i++;
                }
                break;
                
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
                
            case '--timeout':
                if (i + 1 < args.length) {
                    options.timeout = parseInt(args[i + 1]);
                    i++;
                }
                break;
                
            case '--retries':
                if (i + 1 < args.length) {
                    options.retries = parseInt(args[i + 1]);
                    i++;
                }
                break;
                
            case '--no-save':
                options.saveResults = false;
                break;
                
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
                
            default:
                if (arg.startsWith('--')) {
                    console.error(`Unknown option: ${arg}`);
                    process.exit(1);
                }
                break;
        }
    }
    
    return options;
}

/**
 * Print help information
 */
function printHelp() {
    console.log(`
Usage: node run-screen-capture-tests.js [options]

Options:
  --suites <list>     Comma-separated list of test suites to run
                      Available: permissions, capture, audioProcessing, 
                      platform, performance, errorHandling, integration
  --verbose, -v       Enable verbose output
  --timeout <ms>      Timeout for individual tests (default: 30000)
  --retries <count>   Number of retries for failed tests (default: 3)
  --no-save           Don't save test results to file
  --help, -h          Show this help message

Examples:
  node run-screen-capture-tests.js
  node run-screen-capture-tests.js --suites permissions,capture
  node run-screen-capture-tests.js --verbose --timeout 60000
  node run-screen-capture-tests.js --suites performance --retries 5
`);
}

/**
 * Print test summary
 */
function printSummary(results) {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const { metrics } = results;
    const duration = metrics.endTime - metrics.startTime;
    const successRate = (metrics.passedTests / metrics.totalTests * 100).toFixed(1);
    
    console.log(`📱 Platform: ${metrics.platform}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`✅ Passed: ${metrics.passedTests}`);
    console.log(`❌ Failed: ${metrics.failedTests}`);
    console.log(`⏭️  Skipped: ${metrics.skippedTests}`);
    console.log(`📊 Total: ${metrics.totalTests}`);
    
    if (metrics.failedTests > 0) {
        console.log('\n❌ Failed Tests:');
        for (const suiteResult of metrics.testResults) {
            if (suiteResult.failed > 0) {
                console.log(`\n${suiteResult.name}:`);
                for (const test of suiteResult.tests) {
                    if (!test.passed) {
                        console.log(`  ❌ ${test.name}: ${test.error}`);
                    }
                }
            }
        }
    }
    
    if (successRate >= 90) {
        console.log('\n🎉 Excellent! All tests are passing.');
    } else if (successRate >= 70) {
        console.log('\n⚠️  Good, but some tests are failing. Check the details above.');
    } else {
        console.log('\n🚨 Many tests are failing. Please review the implementation.');
    }
}

// Run the main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
