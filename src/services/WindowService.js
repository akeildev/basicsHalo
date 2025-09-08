const BaseService = require('./core/BaseService');
const { BrowserWindow } = require('electron');
const path = require('path');
const WindowLayoutManager = require('../window/windowLayoutManager');

/**
 * Enhanced Window Service with lifecycle and resource management
 */
class WindowService extends BaseService {
    constructor() {
        super('WindowService', {
            isCritical: true,
            maxRetries: 2
        });
        
        this.windows = new Map();
        this.layoutManager = null;
        this.windowConfigs = {
            header: {
                name: 'header',
                critical: true,
                alwaysVisible: true,
                autoShow: true
            },
            listen: {
                name: 'listen',
                critical: false,
                alwaysVisible: false,
                autoShow: false
            },
            ask: {
                name: 'ask',
                critical: false,
                alwaysVisible: false,
                autoShow: false
            },
            settings: {
                name: 'settings',
                critical: false,
                alwaysVisible: false,
                autoShow: false
            }
        };
        
        // Window state tracking
        this.windowStates = new Map();
        this.focusedWindow = null;
    }
    
    /**
     * Initialize the window service
     */
    async onInitialize() {
        console.log('[WindowService] Initializing window service...');
        
        // Initialize layout manager
        this.layoutManager = new WindowLayoutManager();
        
        // Setup window event handlers
        this.setupGlobalWindowHandlers();
        
        console.log('[WindowService] Window service initialized');
    }
    
    /**
     * Start the window service - create windows
     */
    async onStart() {
        console.log('[WindowService] Creating application windows...');
        
        try {
            // Create windows in order of priority
            await this.createHeaderWindow();
            await this.createListenWindow();
            await this.createAskWindow();
            await this.createSettingsWindow();
            
            // Show windows that should be visible on start
            for (const [name, config] of Object.entries(this.windowConfigs)) {
                if (config.autoShow) {
                    await this.showWindow(name);
                }
            }
            
            console.log('[WindowService] All windows created successfully');
        } catch (error) {
            console.error('[WindowService] Failed to create windows:', error);
            
            // If critical window fails, throw error
            if (error.critical) {
                throw error;
            }
        }
    }
    
    /**
     * Stop the window service - hide windows
     */
    async onStop() {
        console.log('[WindowService] Stopping window service...');
        
        // Hide all non-critical windows
        for (const [name, window] of this.windows.entries()) {
            const config = this.windowConfigs[name];
            if (!config.alwaysVisible && window && !window.isDestroyed()) {
                window.hide();
            }
        }
        
        console.log('[WindowService] Window service stopped');
    }
    
    /**
     * Cleanup window resources
     */
    async onCleanup() {
        console.log('[WindowService] Cleaning up windows...');
        
        // Close all windows
        for (const [name, window] of this.windows.entries()) {
            if (window && !window.isDestroyed()) {
                try {
                    // Remove listeners
                    window.removeAllListeners();
                    
                    // Close window
                    window.close();
                    
                    console.log(`[WindowService] Closed window: ${name}`);
                } catch (error) {
                    console.error(`[WindowService] Error closing window ${name}:`, error);
                }
            }
        }
        
        this.windows.clear();
        this.windowStates.clear();
        
        console.log('[WindowService] Window cleanup complete');
    }
    
    /**
     * Create header window
     */
    async createHeaderWindow() {
        const layout = this.layoutManager.calculateHeaderWindowLayout();
        
        const window = new BrowserWindow({
            ...layout,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../renderer/header/preload.js')
            }
        });
        
        // Track window
        this.trackWindow('header', window);
        
        // Load content
        await window.loadFile(path.join(__dirname, '../../dist/renderer/header/index.html'));
        
        // Setup window-specific handlers
        this.setupWindowHandlers('header', window);
        
        console.log('[WindowService] Header window created');
    }
    
    /**
     * Create listen window
     */
    async createListenWindow() {
        const layout = this.layoutManager.calculateListenWindowLayout();
        
        const window = new BrowserWindow({
            ...layout,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../renderer/listen/preload.js')
            }
        });
        
        // Track window
        this.trackWindow('listen', window);
        
        // Load content
        await window.loadFile(path.join(__dirname, '../../dist/renderer/listen/index.html'));
        
        // Setup window-specific handlers
        this.setupWindowHandlers('listen', window);
        
        console.log('[WindowService] Listen window created');
    }
    
    /**
     * Create ask window
     */
    async createAskWindow() {
        const layout = this.layoutManager.calculateAskWindowLayout();
        
        const window = new BrowserWindow({
            ...layout,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../renderer/ask/preload.js')
            }
        });
        
        // Track window
        this.trackWindow('ask', window);
        
        // Load content
        await window.loadFile(path.join(__dirname, '../../dist/renderer/ask/index.html'));
        
        // Setup window-specific handlers
        this.setupWindowHandlers('ask', window);
        
        console.log('[WindowService] Ask window created');
    }
    
    /**
     * Create settings window
     */
    async createSettingsWindow() {
        const layout = this.layoutManager.calculateSettingsWindowLayout();
        
        const window = new BrowserWindow({
            ...layout,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../renderer/settings/preload.js')
            }
        });
        
        // Track window
        this.trackWindow('settings', window);
        
        // Load content
        await window.loadFile(path.join(__dirname, '../../dist/renderer/settings/index.html'));
        
        // Setup window-specific handlers
        this.setupWindowHandlers('settings', window);
        
        console.log('[WindowService] Settings window created');
    }
    
    /**
     * Track a window
     */
    trackWindow(name, window) {
        this.windows.set(name, window);
        this.windowStates.set(name, {
            visible: false,
            focused: false,
            bounds: window.getBounds(),
            createdAt: new Date()
        });
        
        // Track as resource for cleanup
        this.trackConnection(window);
    }
    
    /**
     * Setup window event handlers
     */
    setupWindowHandlers(name, window) {
        // Track window state changes
        this.trackListener(window, 'show', () => {
            const state = this.windowStates.get(name);
            if (state) state.visible = true;
            console.log(`[WindowService] Window shown: ${name}`);
        });
        
        this.trackListener(window, 'hide', () => {
            const state = this.windowStates.get(name);
            if (state) state.visible = false;
            console.log(`[WindowService] Window hidden: ${name}`);
        });
        
        this.trackListener(window, 'focus', () => {
            const state = this.windowStates.get(name);
            if (state) state.focused = true;
            this.focusedWindow = name;
            console.log(`[WindowService] Window focused: ${name}`);
        });
        
        this.trackListener(window, 'blur', () => {
            const state = this.windowStates.get(name);
            if (state) state.focused = false;
            if (this.focusedWindow === name) {
                this.focusedWindow = null;
            }
            console.log(`[WindowService] Window blurred: ${name}`);
        });
        
        this.trackListener(window, 'move', () => {
            const state = this.windowStates.get(name);
            if (state) state.bounds = window.getBounds();
        });
        
        this.trackListener(window, 'resize', () => {
            const state = this.windowStates.get(name);
            if (state) state.bounds = window.getBounds();
        });
        
        // Handle console messages
        this.trackListener(window.webContents, 'console-message', (event, level, message) => {
            console.log(`[${name}] ${message}`);
        });
        
        // Handle crashes
        this.trackListener(window.webContents, 'render-process-gone', async (event, details) => {
            console.error(`[WindowService] Render process gone for ${name}:`, details);
            
            // Attempt to recover
            if (this.windowConfigs[name].critical) {
                await this.recoverWindow(name);
            }
        });
    }
    
    /**
     * Setup global window handlers
     */
    setupGlobalWindowHandlers() {
        // Track new window requests
        this.trackListener(require('electron').app, 'browser-window-created', (event, window) => {
            console.log('[WindowService] New browser window created');
        });
    }
    
    /**
     * Show a window
     */
    async showWindow(name) {
        const window = this.windows.get(name);
        
        if (window && !window.isDestroyed()) {
            window.show();
            return true;
        }
        
        console.warn(`[WindowService] Window not found or destroyed: ${name}`);
        return false;
    }
    
    /**
     * Hide a window
     */
    async hideWindow(name) {
        const window = this.windows.get(name);
        
        if (window && !window.isDestroyed()) {
            window.hide();
            return true;
        }
        
        return false;
    }
    
    /**
     * Toggle window visibility
     */
    async toggleWindow(name) {
        const window = this.windows.get(name);
        
        if (window && !window.isDestroyed()) {
            if (window.isVisible()) {
                window.hide();
            } else {
                window.show();
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Send message to window
     */
    sendToWindow(name, channel, data) {
        const window = this.windows.get(name);
        
        if (window && !window.isDestroyed()) {
            window.webContents.send(channel, data);
            return true;
        }
        
        return false;
    }
    
    /**
     * Recover a crashed window
     */
    async recoverWindow(name) {
        console.log(`[WindowService] Attempting to recover window: ${name}`);
        
        try {
            // Close existing window if any
            const existingWindow = this.windows.get(name);
            if (existingWindow && !existingWindow.isDestroyed()) {
                existingWindow.close();
            }
            
            // Recreate window based on type
            switch (name) {
                case 'header':
                    await this.createHeaderWindow();
                    break;
                case 'listen':
                    await this.createListenWindow();
                    break;
                case 'ask':
                    await this.createAskWindow();
                    break;
                case 'settings':
                    await this.createSettingsWindow();
                    break;
            }
            
            // Restore visibility state
            const state = this.windowStates.get(name);
            if (state && state.visible) {
                await this.showWindow(name);
            }
            
            console.log(`[WindowService] Window recovered: ${name}`);
        } catch (error) {
            console.error(`[WindowService] Failed to recover window ${name}:`, error);
            
            if (this.windowConfigs[name].critical) {
                throw error;
            }
        }
    }
    
    /**
     * Get window by name
     */
    getWindow(name) {
        return this.windows.get(name);
    }
    
    /**
     * Get all windows
     */
    getAllWindows() {
        return new Map(this.windows);
    }
    
    /**
     * Get window state
     */
    getWindowState(name) {
        return this.windowStates.get(name);
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        
        const windowStatuses = {};
        for (const [name, state] of this.windowStates.entries()) {
            const window = this.windows.get(name);
            windowStatuses[name] = {
                ...state,
                exists: !!window,
                destroyed: window ? window.isDestroyed() : true
            };
        }
        
        return {
            ...baseStatus,
            windows: {
                count: this.windows.size,
                focused: this.focusedWindow,
                states: windowStatuses
            }
        };
    }
}

// Export singleton instance
module.exports = new WindowService();