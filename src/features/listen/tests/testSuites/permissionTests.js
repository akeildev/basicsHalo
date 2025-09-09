const permissionService = require('../../services/permissionService');

/**
 * Permission Tests - Tests all permission-related functionality across platforms
 */
class PermissionTests {
    constructor() {
        this.name = 'Permission Tests';
        this.tests = [];
    }

    /**
     * Run all permission tests
     */
    async run(options = {}) {
        console.log('🔐 Running permission tests...');
        
        this.tests = [];
        const platform = options.platform || process.platform;
        
        // Test permission checking
        await this.testPermissionChecking(platform);
        
        // Test permission requests
        await this.testPermissionRequests(platform);
        
        // Test permission caching
        await this.testPermissionCaching();
        
        // Test platform-specific permissions
        await this.testPlatformSpecificPermissions(platform);
        
        // Test permission callbacks
        await this.testPermissionCallbacks();
        
        // Test permission cleanup
        await this.testPermissionCleanup();
        
        return this.getResults();
    }

    /**
     * Test basic permission checking functionality
     */
    async testPermissionChecking(platform) {
        const testName = 'Permission Checking';
        
        try {
            // Test checking non-existent permission
            const hasMicrophone = await permissionService.hasPermission('microphone');
            if (typeof hasMicrophone !== 'boolean') {
                throw new Error('hasPermission should return boolean');
            }
            
            // Test checking screen permission
            const hasScreen = await permissionService.hasPermission('screen');
            if (typeof hasScreen !== 'boolean') {
                throw new Error('hasPermission should return boolean');
            }
            
            // Test checking system audio permission (platform-specific)
            if (platform === 'darwin') {
                const hasSystemAudio = await permissionService.hasPermission('systemAudio');
                if (typeof hasSystemAudio !== 'boolean') {
                    throw new Error('hasPermission should return boolean');
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
     * Test permission request functionality
     */
    async testPermissionRequests(platform) {
        const testName = 'Permission Requests';
        
        try {
            // Test requesting microphone permission
            const micGranted = await permissionService.requestPermission('microphone');
            if (typeof micGranted !== 'boolean') {
                throw new Error('requestPermission should return boolean');
            }
            
            // Test requesting screen permission
            const screenGranted = await permissionService.requestPermission('screen');
            if (typeof screenGranted !== 'boolean') {
                throw new Error('requestPermission should return boolean');
            }
            
            // Test requesting system audio permission (platform-specific)
            if (platform === 'darwin') {
                const systemAudioGranted = await permissionService.requestPermission('systemAudio');
                if (typeof systemAudioGranted !== 'boolean') {
                    throw new Error('requestPermission should return boolean');
                }
            }
            
            // Test requesting invalid permission
            try {
                await permissionService.requestPermission('invalidPermission');
                throw new Error('Should have thrown error for invalid permission');
            } catch (error) {
                // Expected behavior
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test permission caching functionality
     */
    async testPermissionCaching() {
        const testName = 'Permission Caching';
        
        try {
            // Clear cache first
            permissionService.clearCache();
            
            // Check permission (should not be cached)
            const firstCheck = await permissionService.hasPermission('microphone');
            
            // Check again (should be cached)
            const secondCheck = await permissionService.hasPermission('microphone');
            
            if (firstCheck !== secondCheck) {
                throw new Error('Cached permission should match first check');
            }
            
            // Clear cache and check again
            permissionService.clearCache();
            const thirdCheck = await permissionService.hasPermission('microphone');
            
            // Should still be the same (actual permission state)
            if (firstCheck !== thirdCheck) {
                throw new Error('Permission state should be consistent');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test platform-specific permission handling
     */
    async testPlatformSpecificPermissions(platform) {
        const testName = 'Platform-Specific Permissions';
        
        try {
            switch (platform) {
                case 'darwin':
                    await this.testMacOSPermissions();
                    break;
                case 'win32':
                    await this.testWindowsPermissions();
                    break;
                case 'linux':
                    await this.testLinuxPermissions();
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
     * Test macOS-specific permissions
     */
    async testMacOSPermissions() {
        // Test system audio permission (macOS specific)
        const hasSystemAudio = await permissionService.hasPermission('systemAudio');
        if (typeof hasSystemAudio !== 'boolean') {
            throw new Error('macOS system audio permission check failed');
        }
        
        // Test requesting system audio permission
        const systemAudioGranted = await permissionService.requestPermission('systemAudio');
        if (typeof systemAudioGranted !== 'boolean') {
            throw new Error('macOS system audio permission request failed');
        }
    }

    /**
     * Test Windows-specific permissions
     */
    async testWindowsPermissions() {
        // Windows uses different permission mechanisms
        // Test that basic permissions work
        const hasMicrophone = await permissionService.hasPermission('microphone');
        const hasScreen = await permissionService.hasPermission('screen');
        
        if (typeof hasMicrophone !== 'boolean' || typeof hasScreen !== 'boolean') {
            throw new Error('Windows permission checks failed');
        }
    }

    /**
     * Test Linux-specific permissions
     */
    async testLinuxPermissions() {
        // Linux permission handling varies by distribution
        // Test basic functionality
        const hasMicrophone = await permissionService.hasPermission('microphone');
        const hasScreen = await permissionService.hasPermission('screen');
        
        if (typeof hasMicrophone !== 'boolean' || typeof hasScreen !== 'boolean') {
            throw new Error('Linux permission checks failed');
        }
    }

    /**
     * Test permission callback functionality
     */
    async testPermissionCallbacks() {
        const testName = 'Permission Callbacks';
        
        try {
            let callbackInvoked = false;
            let callbackValue = null;
            
            // Set up callback
            const unsubscribe = permissionService.onPermissionChange('microphone', (granted) => {
                callbackInvoked = true;
                callbackValue = granted;
            });
            
            // Trigger permission change (request permission)
            await permissionService.requestPermission('microphone');
            
            // Check if callback was invoked
            if (!callbackInvoked) {
                throw new Error('Permission callback was not invoked');
            }
            
            if (typeof callbackValue !== 'boolean') {
                throw new Error('Permission callback value should be boolean');
            }
            
            // Test unsubscribe
            unsubscribe();
            
            // Clear callback state
            callbackInvoked = false;
            callbackValue = null;
            
            // Trigger another permission change
            await permissionService.requestPermission('microphone');
            
            // Callback should not be invoked after unsubscribe
            if (callbackInvoked) {
                throw new Error('Permission callback should not be invoked after unsubscribe');
            }
            
            this.tests.push({ name: testName, passed: true });
            console.log(`  ✅ ${testName}`);
            
        } catch (error) {
            this.tests.push({ name: testName, passed: false, error: error.message });
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test permission cleanup functionality
     */
    async testPermissionCleanup() {
        const testName = 'Permission Cleanup';
        
        try {
            // Test getAllPermissions
            const allPermissions = await permissionService.getAllPermissions();
            if (typeof allPermissions !== 'object') {
                throw new Error('getAllPermissions should return object');
            }
            
            // Test hasAllRequiredPermissions
            const hasAllRequired = await permissionService.hasAllRequiredPermissions();
            if (typeof hasAllRequired !== 'boolean') {
                throw new Error('hasAllRequiredPermissions should return boolean');
            }
            
            // Test clearCache
            permissionService.clearCache();
            
            // Verify cache is cleared by checking a permission
            const afterClear = await permissionService.hasPermission('microphone');
            if (typeof afterClear !== 'boolean') {
                throw new Error('Permission check should work after cache clear');
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

module.exports = new PermissionTests();
