const BaseService = require('./core/BaseService');
const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');

/**
 * Splash Screen Service
 * Manages the splash/loading screen shown on app startup
 */
class SplashService extends BaseService {
    constructor() {
        super('SplashService', {
            isCritical: false,
            maxRetries: 2
        });
        
        this.splashWindow = null;
        this.onNextCallback = null;
        this.skipSplash = false;
        this.splashShown = false;
    }
    
    /**
     * Initialize the splash service
     */
    async onInitialize() {
        console.log('[SplashService] Initializing splash service...');
        
        // Check if we should skip splash (e.g., saved preference)
        this.checkSkipPreference();
        
        // Setup IPC handlers
        this.setupIPCHandlers();
        
        console.log('[SplashService] Splash service initialized');
    }
    
    /**
     * Start the splash service - show splash window
     */
    async onStart() {
        if (this.skipSplash) {
            console.log('[SplashService] Skipping splash screen');
            // Immediately trigger the callback to show main windows
            if (this.onNextCallback) {
                setTimeout(() => {
                    this.onNextCallback();
                }, 100); // Small delay to ensure everything is ready
            }
            return;
        }
        
        console.log('[SplashService] Creating splash window...');
        await this.createSplashWindow();
    }
    
    /**
     * Stop the splash service
     */
    async onStop() {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            this.splashWindow.hide();
        }
    }
    
    /**
     * Cleanup splash resources
     */
    async onCleanup() {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            this.splashWindow.removeAllListeners();
            this.splashWindow.close();
            this.splashWindow = null;
        }
        
        // Remove IPC handlers
        ipcMain.removeHandler('splash:next');
        ipcMain.removeHandler('splash:auto-advance');
    }
    
    /**
     * Create the splash window
     */
    async createSplashWindow() {
        this.splashWindow = new BrowserWindow({
            width: 900,
            height: 600,
            show: false,                     // Don't show until ready
            frame: false,                    // Frameless window
            transparent: false,
            resizable: false,
            alwaysOnTop: true,               // Keep on top during loading
            backgroundColor: '#1a1a2e',      // Darker background for better visibility
            titleBarStyle: 'hidden',
            center: true,
            webPreferences: {
                preload: path.join(__dirname, '../../dist/renderer/splash/preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                devTools: true,
                backgroundThrottling: false   // Keep animations smooth
            }
        });
        
        // Track window
        this.trackConnection(this.splashWindow);
        
        // Load splash HTML from dist directory
        const splashPath = path.join(__dirname, '../../dist/renderer/splash/index.html');
        console.log('[SplashService] Loading splash from:', splashPath);
        await this.splashWindow.loadFile(splashPath);
        
        // Setup window event handlers
        this.setupWindowHandlers();
        
        // Show when ready
        this.splashWindow.once('ready-to-show', () => {
            console.log('[SplashService] Splash window ready, showing...');
            const bounds = this.splashWindow.getBounds();
            console.log('[SplashService] Window bounds:', bounds);
            this.splashWindow.show();
            this.splashWindow.focus();
            this.splashWindow.moveTop();  // Ensure it's on top
            this.splashShown = true;
            
            // Open DevTools in development to debug
            if (process.env.NODE_ENV !== 'production') {
                this.splashWindow.webContents.openDevTools({ mode: 'detach' });
            }
            
            // Send initial progress
            this.sendProgress(0, 'Initializing Halo...');
        });
        
        // Fallback: Show window after a short delay if ready-to-show doesn't fire
        setTimeout(() => {
            if (!this.splashShown && this.splashWindow && !this.splashWindow.isDestroyed()) {
                console.log('[SplashService] Forcing splash window to show');
                const bounds = this.splashWindow.getBounds();
                console.log('[SplashService] Window bounds (forced):', bounds);
                this.splashWindow.show();
                this.splashWindow.focus();
                this.splashWindow.moveTop();
                this.splashShown = true;
                
                // Open DevTools in development to debug
                if (process.env.NODE_ENV !== 'production') {
                    this.splashWindow.webContents.openDevTools({ mode: 'detach' });
                }
                
                this.sendProgress(0, 'Initializing Halo...');
            }
        }, 500);
    }
    
    /**
     * Setup window event handlers
     */
    setupWindowHandlers() {
        if (!this.splashWindow) return;
        
        this.trackListener(this.splashWindow, 'closed', () => {
            console.log('[SplashService] Splash window closed');
            this.splashWindow = null;
        });
        
        // Handle console messages for debugging
        this.trackListener(this.splashWindow.webContents, 'console-message', (event, level, message) => {
            console.log(`[Splash Console] ${message}`);
        });
        
        // Handle crashes
        this.trackListener(this.splashWindow.webContents, 'render-process-gone', (event, details) => {
            console.error('[SplashService] Splash render process gone:', details);
            // If splash crashes, just continue to main app
            this.handleNext();
        });
    }
    
    /**
     * Setup IPC handlers for splash communication
     */
    setupIPCHandlers() {
        // Handle next button click
        ipcMain.on('splash:next', () => {
            console.log('[SplashService] User clicked Next');
            this.handleNext();
        });
        
        // Handle auto-advance (optional)
        ipcMain.on('splash:auto-advance', () => {
            console.log('[SplashService] Auto-advancing from splash');
            this.handleNext();
        });
    }
    
    /**
     * Handle transition from splash to main app
     */
    handleNext() {
        if (this.onNextCallback) {
            console.log('[SplashService] Triggering transition to main app');
            this.onNextCallback();
        }
        
        // Close splash window after a short delay
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            setTimeout(() => {
                if (this.splashWindow && !this.splashWindow.isDestroyed()) {
                    this.splashWindow.close();
                }
            }, 500);
        }
    }
    
    /**
     * Send progress update to splash window
     */
    sendProgress(percentage, message) {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            this.splashWindow.webContents.send('splash:progress', {
                percentage,
                message
            });
        }
    }
    
    /**
     * Check if splash should be skipped
     */
    checkSkipPreference() {
        // You can implement persistent preference checking here
        // For now, check environment variable or command line arg
        this.skipSplash = process.env.SKIP_SPLASH === 'true' || 
                         process.argv.includes('--skip-splash');
        
        if (this.skipSplash) {
            console.log('[SplashService] Splash screen will be skipped');
        }
    }
    
    /**
     * Set callback for when user proceeds from splash
     */
    setOnNextCallback(callback) {
        this.onNextCallback = callback;
    }
    
    /**
     * Check if splash is currently showing
     */
    isShowing() {
        // Return true if splash window exists and hasn't been explicitly closed by user
        return this.splashWindow && !this.splashWindow.isDestroyed();
    }
    
    /**
     * Force close splash (used when main app is ready)
     */
    closeSplash() {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            console.log('[SplashService] Closing splash window');
            this.splashWindow.close();
            this.splashWindow = null;
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        
        return {
            ...baseStatus,
            splash: {
                shown: this.splashShown,
                active: this.isShowing(),
                skipped: this.skipSplash
            }
        };
    }
}

// Export singleton instance
module.exports = new SplashService();