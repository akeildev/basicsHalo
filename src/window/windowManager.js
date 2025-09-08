const { BrowserWindow, globalShortcut, screen, app, shell } = require('electron');
const WindowLayoutManager = require('./windowLayoutManager');
const SmoothMovementManager = require('./smoothMovementManager');
const path = require('node:path');
const os = require('os');
const shortcutsService = require('../features/shortcuts/shortcutsService');
const internalBridge = require('../bridge/internalBridge');
const permissionRepository = require('../features/common/repositories/permission');

/* ────────────────[ CLUELESS BYPASS ]─────────────── */
let liquidGlass;
const isLiquidCluelessSupported = () => {
    if (process.platform !== 'darwin') {
        return false;
    }
    const majorVersion = parseInt(os.release().split('.')[0], 10);
    // return majorVersion >= 25; // macOS 26+ (Darwin 25+)
    return majorVersion >= 26; // See you soon!
};
let shouldUseLiquidClueless = isLiquidCluelessSupported();
if (shouldUseLiquidClueless) {
    try {
        liquidGlass = require('electron-liquid-glass');
    } catch (e) {
        console.warn('Could not load optional dependency "electron-liquid-glass". The feature will be disabled.');
        shouldUseLiquidClueless = false;
    }
}
/* ────────────────[ CLUELESS BYPASS ]─────────────── */

let isContentProtectionOn = true;
let lastVisibleWindows = new Set(['header']);

let currentHeaderState = 'apikey';
const windowPool = new Map();

let settingsHideTimer = null;

let layoutManager = null;
let movementManager = null;

let layoutDebounceTimer = null;

function updateChildWindowLayouts(animated = true) {
    // if (movementManager.isAnimating) return;

    const visibleWindows = {};
    const listenWin = windowPool.get('listen');
    const askWin = windowPool.get('ask');
    if (listenWin && !listenWin.isDestroyed() && listenWin.isVisible()) {
        visibleWindows.listen = true;
    }
    if (askWin && !askWin.isDestroyed() && askWin.isVisible()) {
        visibleWindows.ask = true;
    }

    if (Object.keys(visibleWindows).length === 0) return;

    // Get header bounds for alignment
    const headerWindow = windowPool.get('header');
    const headerBounds = headerWindow && !headerWindow.isDestroyed() && headerWindow.isVisible() 
        ? headerWindow.getBounds() : null;

    const newLayout = layoutManager.calculateFeatureWindowLayout(visibleWindows, headerBounds);
    
    // Apply new positions to windows
    Object.keys(newLayout).forEach(windowName => {
        const window = windowPool.get(windowName);
        if (window && !window.isDestroyed()) {
            const layout = newLayout[windowName];
            if (animated && movementManager) {
                // Use smooth movement if available
                movementManager.moveWindow(window, layout);
            } else {
                // Direct positioning
                window.setBounds(layout);
            }
        }
    });
}

const showSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: true });
};

const hideSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: false });
};

const cancelHideSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: true });
};

const moveWindowStep = (direction) => {
    internalBridge.emit('window:moveStep', { direction });
};

const resizeHeaderWindow = ({ width, height }) => {
    internalBridge.emit('window:resizeHeaderWindow', { width, height });
};

const handleHeaderAnimationFinished = (state) => {
    internalBridge.emit('window:headerAnimationFinished', state);
};

const getHeaderPosition = () => {
    return new Promise((resolve) => {
        internalBridge.emit('window:getHeaderPosition', (position) => {
            resolve(position);
        });
    });
};

const moveHeaderTo = (newX, newY) => {
    internalBridge.emit('window:moveHeaderTo', { newX, newY });
};

const adjustWindowHeight = (winName, targetHeight) => {
    internalBridge.emit('window:adjustWindowHeight', { winName, targetHeight });
};

// ============================================================================
// WINDOW CREATION AND MANAGEMENT
// ============================================================================

async function createWindows() {
    console.log('[WindowManager] Creating application windows...');
    
    try {
        // Initialize managers
        layoutManager = new WindowLayoutManager();
        movementManager = new SmoothMovementManager();
        
        // Create header window first
        await createHeaderWindow();
        
        // Create feature windows (but keep them hidden initially)
        await createListenWindow();
        await createAskWindow();
        await createSettingsWindow();
        
        console.log('[WindowManager] ✅ All windows created successfully');
        
    } catch (error) {
        console.error('[WindowManager] ❌ Error creating windows:', error);
        throw error;
    }
}

async function createHeaderWindow() {
    const headerLayout = layoutManager.calculateHeaderWindowLayout();
    
    const headerWindow = new BrowserWindow({
        width: headerLayout.width,
        height: headerLayout.height,
        x: headerLayout.x,
        y: headerLayout.y,
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
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        headerWindow.setWindowButtonVisibility(false);
        headerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    
    // Apply liquid glass effect if supported
    if (shouldUseLiquidClueless && liquidGlass) {
        try {
            await liquidGlass.setWindowEffect(headerWindow, 'acrylic');
        } catch (error) {
            console.warn('[WindowManager] Could not apply liquid glass effect:', error);
        }
    }
    
    await headerWindow.loadFile(path.join(__dirname, '../../dist/renderer/header/index.html'));
    
    // Track header movement to reflow child windows
    headerWindow.on('moved', () => {
        if (!layoutDebounceTimer) {
            layoutDebounceTimer = setTimeout(() => {
                updateChildWindowLayouts(false);
                layoutDebounceTimer = null;
            }, 100);
        }
    });
    
    // Cleanup on close
    headerWindow.on('closed', () => {
        windowPool.delete('header');
    });
    
    // Add event listeners for debugging
    headerWindow.on('ready-to-show', () => {
        console.log('[WindowManager] Header window ready to show');
    });
    
    headerWindow.on('show', () => {
        console.log('[WindowManager] Header window shown');
    });
    
    headerWindow.on('hide', () => {
        console.log('[WindowManager] Header window hidden');
    });
    
    headerWindow.webContents.on('did-finish-load', () => {
        console.log('[WindowManager] Header window HTML loaded');
    });
    
    headerWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Header Console] ${message}`);
    });
    
    // DevTools in development
    if (!app.isPackaged) {
        headerWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                headerWindow.webContents.toggleDevTools();
            }
        });
        
        if (process.env.OPEN_DEVTOOLS === '1') {
            headerWindow.webContents.openDevTools({ mode: 'detach' });
        }
    }
    
    if (isContentProtectionOn) {
        headerWindow.setContentProtection(true);
    }
    
    windowPool.set('header', headerWindow);
    console.log('[WindowManager] ✅ Header window created');
    console.log('[WindowManager] Header window bounds:', headerWindow.getBounds());
    console.log('[WindowManager] Header window visible:', headerWindow.isVisible());
}

async function createListenWindow() {
    // Get header window bounds if available
    const headerWindow = windowPool.get('header');
    const headerBounds = headerWindow && !headerWindow.isDestroyed() ? headerWindow.getBounds() : null;
    const listenLayout = layoutManager.calculateListenWindowLayout(headerBounds);
    
    const listenWindow = new BrowserWindow({
        width: listenLayout.width,
        height: listenLayout.height,
        x: listenLayout.x,
        y: listenLayout.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false, // Start hidden
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../renderer/listen/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        listenWindow.setWindowButtonVisibility(false);
    }
    
    // Ensure the window is positioned correctly
    listenWindow.setBounds(listenLayout);
    console.log('[WindowManager] Listen window positioned at:', listenLayout);
    
    const listenHtmlPath = path.join(__dirname, '../../dist/renderer/listen/index.html');
    console.log('[WindowManager] Loading Listen window HTML from:', listenHtmlPath);
    await listenWindow.loadFile(listenHtmlPath);
    
    // Cleanup on close
    listenWindow.on('closed', () => {
        windowPool.delete('listen');
    });
    
    // Add event listeners for debugging
    listenWindow.on('ready-to-show', () => {
        console.log('[WindowManager] Listen window ready to show');
    });
    
    listenWindow.on('show', () => {
        console.log('[WindowManager] Listen window shown');
        if (process.platform === 'darwin') {
            listenWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        listenWindow.focus();
    });
    
    listenWindow.on('hide', () => {
        console.log('[WindowManager] Listen window hidden');
    });
    
    // DevTools in development
    if (!app.isPackaged) {
        listenWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                listenWindow.webContents.toggleDevTools();
            }
        });
        
        if (process.env.OPEN_DEVTOOLS === '1') {
            listenWindow.webContents.openDevTools({ mode: 'detach' });
        }
    }
    
    if (isContentProtectionOn) {
        listenWindow.setContentProtection(true);
    }
    
    windowPool.set('listen', listenWindow);
    console.log('[WindowManager] ✅ Listen window created');
}

async function createAskWindow() {
    // Get header window bounds if available
    const headerWindow = windowPool.get('header');
    const headerBounds = headerWindow && !headerWindow.isDestroyed() ? headerWindow.getBounds() : null;
    const askLayout = layoutManager.calculateAskWindowLayout(headerBounds);
    
    const askWindow = new BrowserWindow({
        width: askLayout.width,
        height: askLayout.height,
        x: askLayout.x,
        y: askLayout.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false, // Start hidden
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../renderer/ask/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        askWindow.setWindowButtonVisibility(false);
    }
    
    // Ensure the window is positioned correctly
    askWindow.setBounds(askLayout);
    console.log('[WindowManager] Ask window positioned at:', askLayout);
    
    const askHtmlPath = path.join(__dirname, '../../dist/renderer/ask/index.html');
    console.log('[WindowManager] Loading Ask window HTML from:', askHtmlPath);
    await askWindow.loadFile(askHtmlPath);
    
    // Cleanup on close
    askWindow.on('closed', () => {
        windowPool.delete('ask');
    });
    
    // Add event listeners for debugging
    askWindow.on('ready-to-show', () => {
        console.log('[WindowManager] Ask window ready to show');
    });
    
    askWindow.on('show', () => {
        console.log('[WindowManager] Ask window shown');
        if (process.platform === 'darwin') {
            askWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        askWindow.focus();
    });
    
    askWindow.on('hide', () => {
        console.log('[WindowManager] Ask window hidden');
    });
    
    // DevTools in development
    if (!app.isPackaged) {
        askWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                askWindow.webContents.toggleDevTools();
            }
        });
        
        if (process.env.OPEN_DEVTOOLS === '1') {
            askWindow.webContents.openDevTools({ mode: 'detach' });
        }
    }
    
    if (isContentProtectionOn) {
        askWindow.setContentProtection(true);
    }
    
    windowPool.set('ask', askWindow);
    console.log('[WindowManager] ✅ Ask window created');
}

async function createSettingsWindow() {
    // Get header window bounds if available
    const headerWindow = windowPool.get('header');
    const headerBounds = headerWindow && !headerWindow.isDestroyed() ? headerWindow.getBounds() : null;
    const settingsLayout = layoutManager.calculateSettingsWindowLayout(headerBounds);
    
    const settingsWindow = new BrowserWindow({
        width: settingsLayout.width,
        height: settingsLayout.height,
        x: settingsLayout.x,
        y: settingsLayout.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false, // Start hidden
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../renderer/settings/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        settingsWindow.setWindowButtonVisibility(false);
    }
    
    await settingsWindow.loadFile(path.join(__dirname, '../../dist/renderer/settings/index.html'));
    
    // Cleanup on close
    settingsWindow.on('closed', () => {
        windowPool.delete('settings');
    });
    
    // Add show event for focus
    settingsWindow.on('show', () => {
        console.log('[WindowManager] Settings window shown');
        if (process.platform === 'darwin') {
            settingsWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        settingsWindow.focus();
    });
    
    // DevTools in development
    if (!app.isPackaged) {
        settingsWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                settingsWindow.webContents.toggleDevTools();
            }
        });
        
        if (process.env.OPEN_DEVTOOLS === '1') {
            settingsWindow.webContents.openDevTools({ mode: 'detach' });
        }
        
        // Context menu for inspect element
        settingsWindow.webContents.on('context-menu', (e, params) => {
            settingsWindow.webContents.inspectElement(params.x, params.y);
        });
    }
    
    if (isContentProtectionOn) {
        settingsWindow.setContentProtection(true);
    }
    
    windowPool.set('settings', settingsWindow);
    console.log('[WindowManager] ✅ Settings window created');
}

// ============================================================================
// EXPORTS
// ============================================================================

// Content protection toggle
function setContentProtection(enabled) {
    isContentProtectionOn = enabled;
    windowPool.forEach(window => {
        if (window && !window.isDestroyed()) {
            window.setContentProtection(enabled);
        }
    });
}

module.exports = {
    createWindows,
    windowPool,
    updateChildWindowLayouts,
    showSettingsWindow,
    hideSettingsWindow,
    cancelHideSettingsWindow,
    moveWindowStep,
    resizeHeaderWindow,
    handleHeaderAnimationFinished,
    getHeaderPosition,
    moveHeaderTo,
    adjustWindowHeight,
    setContentProtection
};
