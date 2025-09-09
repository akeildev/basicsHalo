const { ipcMain, BrowserWindow } = require('electron');
const { EventEmitter } = require('events');

class WindowBridge extends EventEmitter {
    constructor() {
        super();
        this.setupIPC();
        this.windowPool = new Map();
        this.windowStates = new Map();
        this.sharedState = {};
        this.setupDefaultHandlers();
    }

    initialize() {
        // Handlers are registered in constructor; keep for API compatibility
        return true;
    }

    setupIPC() {
        // Window lifecycle events
        ipcMain.handle('window:requestVisibility', this.handleRequestVisibility.bind(this));
        ipcMain.handle('window:moveStep', this.handleMoveStep.bind(this));
        ipcMain.handle('window:resizeHeaderWindow', this.handleResizeHeaderWindow.bind(this));
        ipcMain.handle('window:getHeaderPosition', this.handleGetHeaderPosition.bind(this));
        ipcMain.handle('window:moveHeaderTo', this.handleMoveHeaderTo.bind(this));
        ipcMain.handle('window:adjustWindowHeight', this.handleAdjustWindowHeight.bind(this));
        ipcMain.handle('window:headerAnimationFinished', this.handleHeaderAnimationFinished.bind(this));
        
        // Window state management
        ipcMain.handle('window:getState', this.handleGetWindowState.bind(this));
        ipcMain.handle('window:setState', this.handleSetWindowState.bind(this));
        ipcMain.handle('window:minimize', this.handleMinimizeWindow.bind(this));
        ipcMain.handle('window:maximize', this.handleMaximizeWindow.bind(this));
        ipcMain.handle('window:close', this.handleCloseWindow.bind(this));
        
        // Window positioning and layout
        ipcMain.handle('window:getBounds', this.handleGetBounds.bind(this));
        ipcMain.handle('window:setBounds', this.handleSetBounds.bind(this));
        ipcMain.handle('window:center', this.handleCenterWindow.bind(this));
        ipcMain.handle('window:bringToFront', this.handleBringToFront.bind(this));

        // Messaging bridge
        ipcMain.on('relay:to-window', (event, { target, channel, data }) => {
            try {
                this.sendToWindow(target, channel, data);
            } catch (error) {
                console.error('[WindowBridge] relay:to-window error:', error);
            }
        });
        ipcMain.on('broadcast', (event, { channel, data }) => {
            try {
                this.broadcast(channel, data);
            } catch (error) {
                console.error('[WindowBridge] broadcast error:', error);
            }
        });

        // Shared state
        ipcMain.handle('state:get', async (event, key) => {
            try {
                return this.sharedState[key];
            } catch (error) {
                console.error('[WindowBridge] state:get error:', error);
                return undefined;
            }
        });
        ipcMain.handle('state:set', async (event, { key, value }) => {
            try {
                this.sharedState[key] = value;
                this.broadcast('state:changed', { key, value });
                return { success: true };
            } catch (error) {
                console.error('[WindowBridge] state:set error:', error);
                return { success: false, error: error.message };
            }
        });
        
        console.log('[WindowBridge] IPC handlers registered');
    }

    setupDefaultHandlers() {
        // Default window operations
        this.windowOperations = {
            show: this.defaultShowWindow,
            hide: this.defaultHideWindow,
            move: this.defaultMoveWindow,
            resize: this.defaultResizeWindow,
            minimize: this.defaultMinimizeWindow,
            maximize: this.defaultMaximizeWindow,
            close: this.defaultCloseWindow
        };
    }

    // Set window pool reference
    setWindowPool(windowPool) {
        this.windowPool = windowPool;
        console.log('[WindowBridge] Window pool connected');
    }

    // Window Visibility Management
    async handleRequestVisibility(event, { name, visible, options = {} }) {
        try {
            console.log('[WindowBridge] Visibility request:', { name, visible, options });
            
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found or destroyed`);
            }

            // Handle toggle behavior
            if (visible === undefined) {
                // Toggle the window
                visible = !window.isVisible();
            }

            if (visible) {
                // Close other child windows when opening a new one (except header)
                if (name !== 'header') {
                    const childWindows = ['listen', 'ask', 'settings'];
                    for (const winName of childWindows) {
                        if (winName !== name) {
                            const otherWindow = this.windowPool.get(winName);
                            if (otherWindow && !otherWindow.isDestroyed() && otherWindow.isVisible()) {
                                console.log(`[WindowBridge] Closing ${winName} window`);
                                await this.hideWindow(winName, {});
                            }
                        }
                    }
                }
                await this.showWindow(name, options);
            } else {
                await this.hideWindow(name, options);
            }

            this.emit('window:visibilityChanged', { name, visible, windowId: event.sender.id });
            
            // Broadcast to all windows so they can update their UI
            this.broadcast('window:visibilityChanged', { name, visible });
            
            return { success: true, visible };
        } catch (error) {
            console.error('[WindowBridge] Visibility request error:', error);
            this.emit('window:error', { error: error.message, windowId: event.sender.id });
            return { success: false, error: error.message };
        }
    }

    // Window Movement
    async handleMoveStep(event, { direction, distance = 10 }) {
        try {
            console.log('[WindowBridge] Move step request:', { direction, distance });
            
            const window = this.windowPool.get('header');
            if (!window || window.isDestroyed()) {
                throw new Error('Header window not found');
            }

            // Use layout manager for intelligent positioning if available
            const WindowLayoutManager = require('../window/windowLayoutManager');
            const layoutManager = new WindowLayoutManager();
            layoutManager.setWindowPool(this.windowPool);
            
            const newPosition = layoutManager.calculateStepMovePosition(window, direction);
            if (newPosition) {
                window.setPosition(newPosition.x, newPosition.y);
                this.emit('window:moved', { direction, distance, position: [newPosition.x, newPosition.y] });
                return { success: true, position: [newPosition.x, newPosition.y] };
            } else {
                throw new Error('Unable to calculate new position');
            }
        } catch (error) {
            console.error('[WindowBridge] Move step error:', error);
            return { success: false, error: error.message };
        }
    }

    // Header Window Resize
    async handleResizeHeaderWindow(event, { width, height }) {
        try {
            console.log('[WindowBridge] Resize header request:', { width, height });
            
            const window = this.windowPool.get('header');
            if (!window || window.isDestroyed()) {
                throw new Error('Header window not found');
            }

            this.validateDimensions(width, height);
            
            // Use layout manager for intelligent resizing that keeps window centered
            const WindowLayoutManager = require('../window/windowLayoutManager');
            const layoutManager = new WindowLayoutManager();
            layoutManager.setWindowPool(this.windowPool);
            
            const newBounds = layoutManager.calculateHeaderResize(window, { width, height });
            if (newBounds) {
                window.setBounds(newBounds);
                this.emit('window:resized', { name: 'header', width, height });
                return { success: true, size: { width, height } };
            } else {
                // Fallback to simple resize
                window.setSize(width, height);
                this.emit('window:resized', { name: 'header', width, height });
                return { success: true, size: { width, height } };
            }
        } catch (error) {
            console.error('[WindowBridge] Resize header error:', error);
            return { success: false, error: error.message };
        }
    }

    // Header Position Management
    async handleGetHeaderPosition(event) {
        try {
            const window = this.windowPool.get('header');
            if (!window || window.isDestroyed()) {
                throw new Error('Header window not found');
            }

            const [x, y] = window.getPosition();
            const [width, height] = window.getSize();
            
            return { success: true, position: { x, y, width, height } };
        } catch (error) {
            console.error('[WindowBridge] Get header position error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMoveHeaderTo(event, { newX, newY }) {
        try {
            console.log('[WindowBridge] Move header to:', { newX, newY });
            
            const window = this.windowPool.get('header');
            if (!window || window.isDestroyed()) {
                throw new Error('Header window not found');
            }

            this.validatePosition(newX, newY);
            window.setPosition(newX, newY);
            
            this.emit('window:moved', { name: 'header', position: { x: newX, y: newY } });
            
            return { success: true, position: { x: newX, y: newY } };
        } catch (error) {
            console.error('[WindowBridge] Move header to error:', error);
            return { success: false, error: error.message };
        }
    }

    // Window Height Adjustment
    async handleAdjustWindowHeight(event, { winName, targetHeight }) {
        try {
            console.log('[WindowBridge] Adjust height request:', { winName, targetHeight });
            
            const window = this.windowPool.get(winName);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${winName}' not found`);
            }

            this.validateHeight(targetHeight);
            const [width] = window.getSize();
            window.setSize(width, targetHeight);
            
            this.emit('window:heightAdjusted', { name: winName, height: targetHeight });
            
            return { success: true, height: targetHeight };
        } catch (error) {
            console.error('[WindowBridge] Adjust height error:', error);
            return { success: false, error: error.message };
        }
    }

    // Animation Events
    async handleHeaderAnimationFinished(event, state) {
        try {
            console.log('[WindowBridge] Header animation finished:', state);
            
            this.emit('window:animationFinished', { name: 'header', state });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Animation finished error:', error);
            return { success: false, error: error.message };
        }
    }

    // Window State Management
    async handleGetWindowState(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            const state = {
                visible: window.isVisible(),
                minimized: window.isMinimized(),
                maximized: window.isMaximized(),
                focused: window.isFocused(),
                bounds: window.getBounds()
            };

            return { success: true, state };
        } catch (error) {
            console.error('[WindowBridge] Get window state error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSetWindowState(event, { name, state }) {
        try {
            console.log('[WindowBridge] Set window state:', { name, state });
            
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            if (state.visible !== undefined) {
                if (state.visible) {
                    window.show();
                } else {
                    window.hide();
                }
            }

            if (state.minimized !== undefined) {
                if (state.minimized) {
                    window.minimize();
                } else {
                    window.restore();
                }
            }

            if (state.maximized !== undefined) {
                if (state.maximized) {
                    window.maximize();
                } else {
                    window.unmaximize();
                }
            }

            this.emit('window:stateChanged', { name, state });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Set window state error:', error);
            return { success: false, error: error.message };
        }
    }

    // Window Operations
    async handleMinimizeWindow(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            window.minimize();
            this.emit('window:minimized', { name });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Minimize window error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMaximizeWindow(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            window.maximize();
            this.emit('window:maximized', { name });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Maximize window error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleCloseWindow(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            window.close();
            this.emit('window:closed', { name });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Close window error:', error);
            return { success: false, error: error.message };
        }
    }

    // Window Positioning
    async handleGetBounds(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            const bounds = window.getBounds();
            return { success: true, bounds };
        } catch (error) {
            console.error('[WindowBridge] Get bounds error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSetBounds(event, { name, bounds }) {
        try {
            console.log('[WindowBridge] Set bounds request:', { name, bounds });
            
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            this.validateBounds(bounds);
            window.setBounds(bounds);
            
            this.emit('window:boundsChanged', { name, bounds });
            
            return { success: true, bounds };
        } catch (error) {
            console.error('[WindowBridge] Set bounds error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleCenterWindow(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            window.center();
            const bounds = window.getBounds();
            
            this.emit('window:centered', { name, bounds });
            
            return { success: true, bounds };
        } catch (error) {
            console.error('[WindowBridge] Center window error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleBringToFront(event, { name }) {
        try {
            const window = this.windowPool.get(name);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window '${name}' not found`);
            }

            window.focus();
            window.show();
            
            this.emit('window:broughtToFront', { name });
            
            return { success: true };
        } catch (error) {
            console.error('[WindowBridge] Bring to front error:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper Methods
    broadcast(channel, data) {
        this.windowPool.forEach((window, name) => {
            try {
                if (window && !window.isDestroyed()) {
                    window.webContents.send(channel, data);
                }
            } catch (error) {
                console.error(`[WindowBridge] broadcast to ${name} failed:`, error);
            }
        });
    }

    sendToWindow(name, channel, data) {
        const window = this.windowPool.get(name);
        if (window && !window.isDestroyed()) {
            window.webContents.send(channel, data);
        } else {
            throw new Error(`Window '${name}' not available`);
        }
    }

    async showWindow(name, options = {}) {
        console.log(`[WindowBridge] Attempting to show window: ${name}`);
        console.log(`[WindowBridge] Window pool size: ${this.windowPool.size}`);
        console.log(`[WindowBridge] Available windows:`, Array.from(this.windowPool.keys()));
        
        const window = this.windowPool.get(name);
        if (!window || window.isDestroyed()) {
            console.error(`[WindowBridge] Window '${name}' not found or destroyed`);
            throw new Error(`Window '${name}' not found`);
        }

        console.log(`[WindowBridge] Window found, showing...`);
        console.log(`[WindowBridge] Window bounds before show:`, window.getBounds());
        console.log(`[WindowBridge] Window visible before show:`, window.isVisible());

        // For child windows, position them relative to header
        if (name !== 'header') {
            const headerWindow = this.windowPool.get('header');
            if (headerWindow && !headerWindow.isDestroyed() && headerWindow.isVisible()) {
                const headerBounds = headerWindow.getBounds();
                const WindowLayoutManager = require('../window/windowLayoutManager');
                const layoutManager = new WindowLayoutManager();
                
                // Calculate proper position based on window type
                let layout;
                if (name === 'listen') {
                    layout = layoutManager.calculateListenWindowLayout(headerBounds);
                } else if (name === 'ask') {
                    layout = layoutManager.calculateAskWindowLayout(headerBounds);
                } else if (name === 'settings') {
                    layout = layoutManager.calculateSettingsWindowLayout(headerBounds);
                }
                
                if (layout) {
                    window.setBounds(layout);
                    console.log(`[WindowBridge] Positioned ${name} window relative to header:`, layout);
                }
            }
        }
        
        if (options.focus !== false) {
            window.focus();
        }
        
        // Make sure the window is on top and visible
        window.setAlwaysOnTop(true);
        window.show();
        window.focus();
        
        console.log(`[WindowBridge] Window visible after show:`, window.isVisible());
        console.log(`[WindowBridge] Window bounds after show:`, window.getBounds());
        console.log(`[WindowBridge] Window is always on top:`, window.isAlwaysOnTop());
    }

    async hideWindow(name, options = {}) {
        const window = this.windowPool.get(name);
        if (!window || window.isDestroyed()) {
            throw new Error(`Window '${name}' not found`);
        }

        window.hide();
    }

    // Validation Methods
    validateDimensions(width, height) {
        if (typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Width and height must be numbers');
        }
        if (width < 100 || height < 100) {
            throw new Error('Minimum window size is 100x100');
        }
        if (width > 4000 || height > 4000) {
            throw new Error('Maximum window size is 4000x4000');
        }
    }

    validatePosition(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Position must be numbers');
        }
        if (x < 0 || y < 0) {
            throw new Error('Position cannot be negative');
        }
    }

    validateHeight(height) {
        if (typeof height !== 'number') {
            throw new Error('Height must be a number');
        }
        if (height < 50) {
            throw new Error('Minimum height is 50');
        }
        if (height > 2000) {
            throw new Error('Maximum height is 2000');
        }
    }

    validateBounds(bounds) {
        if (!bounds || typeof bounds !== 'object') {
            throw new Error('Bounds must be an object');
        }
        const { x, y, width, height } = bounds;
        this.validatePosition(x, y);
        this.validateDimensions(width, height);
    }

    // Default Handlers
    defaultShowWindow = async (name, options) => {
        console.log(`[WindowBridge] Default show window: ${name}`);
    };

    defaultHideWindow = async (name, options) => {
        console.log(`[WindowBridge] Default hide window: ${name}`);
    };

    defaultMoveWindow = async (name, position) => {
        console.log(`[WindowBridge] Default move window: ${name}`, position);
    };

    defaultResizeWindow = async (name, size) => {
        console.log(`[WindowBridge] Default resize window: ${name}`, size);
    };

    defaultMinimizeWindow = async (name) => {
        console.log(`[WindowBridge] Default minimize window: ${name}`);
    };

    defaultMaximizeWindow = async (name) => {
        console.log(`[WindowBridge] Default maximize window: ${name}`);
    };

    defaultCloseWindow = async (name) => {
        console.log(`[WindowBridge] Default close window: ${name}`);
    };

    // Cleanup
    destroy() {
        // Remove all IPC handlers
        ipcMain.removeAllListeners('window:requestVisibility');
        ipcMain.removeAllListeners('window:moveStep');
        ipcMain.removeAllListeners('window:resizeHeaderWindow');
        ipcMain.removeAllListeners('window:getHeaderPosition');
        ipcMain.removeAllListeners('window:moveHeaderTo');
        ipcMain.removeAllListeners('window:adjustWindowHeight');
        ipcMain.removeAllListeners('window:headerAnimationFinished');
        ipcMain.removeAllListeners('window:getState');
        ipcMain.removeAllListeners('window:setState');
        ipcMain.removeAllListeners('window:minimize');
        ipcMain.removeAllListeners('window:maximize');
        ipcMain.removeAllListeners('window:close');
        ipcMain.removeAllListeners('window:getBounds');
        ipcMain.removeAllListeners('window:setBounds');
        ipcMain.removeAllListeners('window:center');
        ipcMain.removeAllListeners('window:bringToFront');
        
        this.windowPool.clear();
        this.windowStates.clear();
        this.removeAllListeners();
        
        console.log('[WindowBridge] Destroyed');
    }
}

module.exports = new WindowBridge();
