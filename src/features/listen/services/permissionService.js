const { systemPreferences, shell, desktopCapturer } = require('electron');
const { EventEmitter } = require('events');

/**
 * PermissionService - Unified permission management for screen capture and audio access
 * Handles platform-specific permission requirements across macOS, Windows, and Linux
 */
class PermissionService extends EventEmitter {
    constructor() {
        super();
        this.platform = process.platform;
        this.permissionCache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
        this.isInitialized = false;
        
        // Platform-specific permission types
        this.permissionTypes = {
            darwin: ['microphone', 'screen', 'systemAudio', 'keychain'],
            win32: ['microphone', 'screen', 'systemAudio'],
            linux: ['microphone', 'screen', 'systemAudio']
        };
        
        // Permission status constants
        this.STATUS = {
            GRANTED: 'granted',
            DENIED: 'denied',
            RESTRICTED: 'restricted',
            UNKNOWN: 'unknown',
            NOT_DETERMINED: 'not-determined'
        };
    }

    /**
     * Initialize the permission service
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log(`[PermissionService] Initializing for platform: ${this.platform}`);
            
            // Clear any existing cache
            this.permissionCache.clear();
            
            // Perform initial permission check
            await this.checkSystemPermissions();
            
            this.isInitialized = true;
            console.log('[PermissionService] ✅ Initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('[PermissionService] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check all system permissions for the current platform
     */
    async checkSystemPermissions() {
        const permissions = {
            platform: this.platform,
            microphone: this.STATUS.UNKNOWN,
            screen: this.STATUS.UNKNOWN,
            systemAudio: this.STATUS.UNKNOWN,
            keychain: this.STATUS.UNKNOWN,
            needsSetup: true,
            timestamp: Date.now()
        };

        try {
            switch (this.platform) {
                case 'darwin':
                    await this._checkMacOSPermissions(permissions);
                    break;
                case 'win32':
                    await this._checkWindowsPermissions(permissions);
                    break;
                case 'linux':
                    await this._checkLinuxPermissions(permissions);
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }

            // Determine if setup is needed
            permissions.needsSetup = this._needsSetup(permissions);
            
            // Cache the results
            this.permissionCache.set('systemPermissions', {
                data: permissions,
                timestamp: Date.now()
            });

            console.log('[PermissionService] System permissions status:', permissions);
            this.emit('permissionsChecked', permissions);
            
            return permissions;
            
        } catch (error) {
            console.error('[PermissionService] Error checking permissions:', error);
            const errorPermissions = {
                ...permissions,
                error: error.message,
                needsSetup: true
            };
            
            this.emit('permissionError', error);
            return errorPermissions;
        }
    }

    /**
     * Check permissions on macOS
     */
    async _checkMacOSPermissions(permissions) {
        try {
            // Check microphone permission
            permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
            
            // Check screen recording permission
            permissions.screen = systemPreferences.getMediaAccessStatus('screen');
            
            // Check system audio permission (macOS specific)
            permissions.systemAudio = await this._checkMacOSSystemAudioPermission();
            
            // Check keychain access
            permissions.keychain = await this._checkKeychainPermission();
            
        } catch (error) {
            console.error('[PermissionService] macOS permission check error:', error);
            throw error;
        }
    }

    /**
     * Check permissions on Windows
     */
    async _checkWindowsPermissions(permissions) {
        try {
            // Windows permissions are typically granted by default
            // but we can check for specific capabilities
            
            // Check microphone access
            permissions.microphone = await this._checkWindowsMicrophonePermission();
            
            // Check screen recording capability
            permissions.screen = await this._checkWindowsScreenPermission();
            
            // Check system audio (loopback) capability
            permissions.systemAudio = await this._checkWindowsSystemAudioPermission();
            
            // Keychain not applicable on Windows
            permissions.keychain = this.STATUS.GRANTED;
            
        } catch (error) {
            console.error('[PermissionService] Windows permission check error:', error);
            throw error;
        }
    }

    /**
     * Check permissions on Linux
     */
    async _checkLinuxPermissions(permissions) {
        try {
            // Linux permissions vary by distribution and audio system
            
            // Check microphone access
            permissions.microphone = await this._checkLinuxMicrophonePermission();
            
            // Check screen recording capability
            permissions.screen = await this._checkLinuxScreenPermission();
            
            // Check system audio capability
            permissions.systemAudio = await this._checkLinuxSystemAudioPermission();
            
            // Keychain not applicable on Linux
            permissions.keychain = this.STATUS.GRANTED;
            
        } catch (error) {
            console.error('[PermissionService] Linux permission check error:', error);
            throw error;
        }
    }

    /**
     * Check if setup is needed based on permission status
     */
    _needsSetup(permissions) {
        const requiredPermissions = this.permissionTypes[this.platform] || [];
        
        for (const permission of requiredPermissions) {
            if (permissions[permission] !== this.STATUS.GRANTED) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Request microphone permission
     */
    async requestMicrophonePermission() {
        try {
            console.log('[PermissionService] Requesting microphone permission...');
            
            switch (this.platform) {
                case 'darwin':
                    return await this._requestMacOSMicrophonePermission();
                case 'win32':
                    return await this._requestWindowsMicrophonePermission();
                case 'linux':
                    return await this._requestLinuxMicrophonePermission();
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
        } catch (error) {
            console.error('[PermissionService] Error requesting microphone permission:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Request screen recording permission
     */
    async requestScreenPermission() {
        try {
            console.log('[PermissionService] Requesting screen recording permission...');
            
            switch (this.platform) {
                case 'darwin':
                    return await this._requestMacOSScreenPermission();
                case 'win32':
                    return await this._requestWindowsScreenPermission();
                case 'linux':
                    return await this._requestLinuxScreenPermission();
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
        } catch (error) {
            console.error('[PermissionService] Error requesting screen permission:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Request system audio permission
     */
    async requestSystemAudioPermission() {
        try {
            console.log('[PermissionService] Requesting system audio permission...');
            
            switch (this.platform) {
                case 'darwin':
                    return await this._requestMacOSSystemAudioPermission();
                case 'win32':
                    return await this._requestWindowsSystemAudioPermission();
                case 'linux':
                    return await this._requestLinuxSystemAudioPermission();
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
        } catch (error) {
            console.error('[PermissionService] Error requesting system audio permission:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Request all required permissions
     */
    async requestAllPermissions() {
        const results = {
            microphone: null,
            screen: null,
            systemAudio: null,
            keychain: null,
            allGranted: false
        };

        try {
            // Request permissions in order
            results.microphone = await this.requestMicrophonePermission();
            results.screen = await this.requestScreenPermission();
            results.systemAudio = await this.requestSystemAudioPermission();
            
            if (this.platform === 'darwin') {
                results.keychain = await this._requestKeychainPermission();
            } else {
                results.keychain = { success: true, status: this.STATUS.GRANTED };
            }
            
            // Check if all permissions are granted
            results.allGranted = Object.values(results).every(result => 
                result && result.success && result.status === this.STATUS.GRANTED
            );
            
            console.log('[PermissionService] All permissions requested:', results);
            this.emit('allPermissionsRequested', results);
            
            return results;
            
        } catch (error) {
            console.error('[PermissionService] Error requesting all permissions:', error);
            return {
                ...results,
                error: error.message
            };
        }
    }

    /**
     * Open system preferences for permission management
     */
    async openSystemPreferences(section = 'all') {
        try {
            console.log(`[PermissionService] Opening system preferences for: ${section}`);
            
            switch (this.platform) {
                case 'darwin':
                    return await this._openMacOSSystemPreferences(section);
                case 'win32':
                    return await this._openWindowsSystemPreferences(section);
                case 'linux':
                    return await this._openLinuxSystemPreferences(section);
                default:
                    return {
                        success: false,
                        error: `System preferences not supported on ${this.platform}`
                    };
            }
            
        } catch (error) {
            console.error('[PermissionService] Error opening system preferences:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if a specific permission is granted
     */
    async hasPermission(permissionType) {
        try {
            // Check cache first
            const cached = this._getCachedPermission(permissionType);
            if (cached !== null) {
                return cached === this.STATUS.GRANTED;
            }
            
            // Get fresh permission status
            const permissions = await this.checkSystemPermissions();
            return permissions[permissionType] === this.STATUS.GRANTED;
            
        } catch (error) {
            console.error(`[PermissionService] Error checking ${permissionType} permission:`, error);
            return false;
        }
    }

    /**
     * Get all permissions status
     */
    async getAllPermissions() {
        try {
            const permissions = await this.checkSystemPermissions();
            return {
                ...permissions,
                hasAllRequired: !permissions.needsSetup
            };
        } catch (error) {
            console.error('[PermissionService] Error getting all permissions:', error);
            return {
                error: error.message,
                needsSetup: true
            };
        }
    }

    /**
     * Check if all required permissions are granted
     */
    async hasAllRequiredPermissions() {
        try {
            const permissions = await this.checkSystemPermissions();
            return !permissions.needsSetup;
        } catch (error) {
            console.error('[PermissionService] Error checking required permissions:', error);
            return false;
        }
    }

    /**
     * Clear permission cache
     */
    clearCache() {
        this.permissionCache.clear();
        console.log('[PermissionService] Permission cache cleared');
    }

    /**
     * Set up permission change callback
     */
    onPermissionChange(permissionType, callback) {
        if (!this.permissionTypes[this.platform]?.includes(permissionType)) {
            throw new Error(`Unsupported permission type: ${permissionType}`);
        }
        
        this.on(`permissionChanged:${permissionType}`, callback);
        
        // Return unsubscribe function
        return () => {
            this.removeListener(`permissionChanged:${permissionType}`, callback);
        };
    }

    // macOS-specific methods
    async _checkMacOSSystemAudioPermission() {
        // macOS system audio permission is typically granted with screen recording
        return systemPreferences.getMediaAccessStatus('screen');
    }

    async _checkKeychainPermission() {
        try {
            // Check if keychain access is working
            const keytar = require('keytar');
            await keytar.getPassword('clueless-test', 'test-user');
            return this.STATUS.GRANTED;
        } catch (error) {
            return this.STATUS.DENIED;
        }
    }

    async _requestMacOSMicrophonePermission() {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        
        if (status === this.STATUS.GRANTED) {
            return { success: true, status: this.STATUS.GRANTED };
        }
        
        const granted = await systemPreferences.askForMediaAccess('microphone');
        const result = {
            success: granted,
            status: granted ? this.STATUS.GRANTED : this.STATUS.DENIED
        };
        
        this.emit('permissionChanged:microphone', result.status);
        return result;
    }

    async _requestMacOSScreenPermission() {
        const status = systemPreferences.getMediaAccessStatus('screen');
        
        if (status === this.STATUS.GRANTED) {
            return { success: true, status: this.STATUS.GRANTED };
        }
        
        // Use the screen recording registration trick
        try {
            console.log('[PermissionService] Triggering screen capture request to register app...');
            await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1, height: 1 }
            });
            console.log('[PermissionService] App registered for screen recording');
        } catch (captureError) {
            console.log('[PermissionService] Screen capture request triggered (expected to fail):', captureError.message);
        }
        
        // Check status after registration attempt
        const newStatus = systemPreferences.getMediaAccessStatus('screen');
        const result = {
            success: newStatus === this.STATUS.GRANTED,
            status: newStatus
        };
        
        this.emit('permissionChanged:screen', result.status);
        return result;
    }

    async _requestMacOSSystemAudioPermission() {
        // System audio permission is tied to screen recording on macOS
        return await this._requestMacOSScreenPermission();
    }

    async _requestKeychainPermission() {
        try {
            const keytar = require('keytar');
            await keytar.setPassword('clueless-test', 'test-user', 'test-value');
            await keytar.deletePassword('clueless-test', 'test-user');
            
            return {
                success: true,
                status: this.STATUS.GRANTED
            };
        } catch (error) {
            return {
                success: false,
                status: this.STATUS.DENIED,
                error: error.message
            };
        }
    }

    async _openMacOSSystemPreferences(section) {
        const urls = {
            microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
            screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
            all: 'x-apple.systempreferences:com.apple.preference.security'
        };
        
        const url = urls[section] || urls.all;
        await shell.openExternal(url);
        
        return { success: true };
    }

    // Windows-specific methods
    async _checkWindowsMicrophonePermission() {
        // Windows microphone permission is typically granted by default
        return this.STATUS.GRANTED;
    }

    async _checkWindowsScreenPermission() {
        // Windows screen recording is typically allowed
        return this.STATUS.GRANTED;
    }

    async _checkWindowsSystemAudioPermission() {
        // Windows system audio (loopback) is typically available
        return this.STATUS.GRANTED;
    }

    async _requestWindowsMicrophonePermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _requestWindowsScreenPermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _requestWindowsSystemAudioPermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _openWindowsSystemPreferences(section) {
        const urls = {
            microphone: 'ms-settings:privacy-microphone',
            screen: 'ms-settings:privacy-camera',
            all: 'ms-settings:privacy'
        };
        
        const url = urls[section] || urls.all;
        await shell.openExternal(url);
        
        return { success: true };
    }

    // Linux-specific methods
    async _checkLinuxMicrophonePermission() {
        // Linux microphone permission varies by distribution
        return this.STATUS.GRANTED;
    }

    async _checkLinuxScreenPermission() {
        // Linux screen recording permission varies by distribution
        return this.STATUS.GRANTED;
    }

    async _checkLinuxSystemAudioPermission() {
        // Linux system audio permission varies by audio system
        return this.STATUS.GRANTED;
    }

    async _requestLinuxMicrophonePermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _requestLinuxScreenPermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _requestLinuxSystemAudioPermission() {
        return { success: true, status: this.STATUS.GRANTED };
    }

    async _openLinuxSystemPreferences(section) {
        // Linux doesn't have a unified system preferences
        return {
            success: false,
            error: 'System preferences not available on Linux'
        };
    }

    // Utility methods
    _getCachedPermission(permissionType) {
        const cached = this.permissionCache.get('systemPermissions');
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > this.cacheTimeout) {
            this.permissionCache.delete('systemPermissions');
            return null;
        }
        
        return cached.data[permissionType];
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            platform: this.platform,
            cacheSize: this.permissionCache.size,
            supportedPermissions: this.permissionTypes[this.platform] || []
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.removeAllListeners();
        this.permissionCache.clear();
        this.isInitialized = false;
        console.log('[PermissionService] Cleaned up');
    }
}

module.exports = new PermissionService();