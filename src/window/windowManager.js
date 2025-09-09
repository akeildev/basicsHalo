const { BrowserWindow, globalShortcut, screen, app, shell } = require('electron');
const WindowLayoutManager = require('./windowLayoutManager');
const SmoothMovementManager = require('./smoothMovementManager');
const windowStateService = require('../services/windowStateService');
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

// Debounced reflow on display changes
let displayReflowTimer = null;
let displayUpdateTimer = null;
let cachedDisplays = [];
function reflowAllWindows() {
    try {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        // Clamp header if out of bounds
        const headerBounds = header.getBounds();
        const clamped = layoutManager && layoutManager.calculateClampedPosition
            ? layoutManager.calculateClampedPosition(header, { x: headerBounds.x, y: headerBounds.y })
            : null;
        if (clamped && (clamped.x !== headerBounds.x || clamped.y !== headerBounds.y)) {
            header.setPosition(clamped.x, clamped.y);
        }

        // Build visibility map
        const visibility = {};
        const names = ['ask', 'listen', 'settings'];
        names.forEach(name => {
            const win = windowPool.get(name);
            if (win && !win.isDestroyed() && win.isVisible()) visibility[name] = true;
        });

        if (Object.keys(visibility).length === 0) return;

        const newLayout = layoutManager && layoutManager.calculateFeatureWindowLayout
            ? layoutManager.calculateFeatureWindowLayout(visibility, header.getBounds())
            : {};
        Object.keys(newLayout).forEach(name => {
            const win = windowPool.get(name);
            if (!win || win.isDestroyed()) return;
            const bounds = newLayout[name];
            win.setBounds(bounds);
        });
    } catch (e) {
        if (!app.isPackaged) console.warn('[WindowManager] Reflow error:', e.message);
    }
}

// ----------------------------------------------------------------------------
// DISPLAY MANAGEMENT
// ----------------------------------------------------------------------------

function getCurrentDisplay(window) {
    try {
        if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();
        const b = window.getBounds();
        const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        return screen.getDisplayNearestPoint(center);
    } catch {
        return screen.getPrimaryDisplay();
    }
}

function handleDisplayConfigurationChange() {
    cachedDisplays = screen.getAllDisplays();
    reflowAllWindows();
    updateChildWindowLayouts(true);
}

function handleDisplayRemoval(removedDisplayId) {
    const remainingDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    const windowsToMigrate = [];
    windowPool.forEach((win, name) => {
        if (!win || win.isDestroyed()) return;
        const current = getCurrentDisplay(win);
        if (!current) return;
        const stillExists = remainingDisplays.find(d => d.id === current.id);
        if (!stillExists) {
            windowsToMigrate.push({ win, name, originalBounds: win.getBounds() });
        }
    });

    windowsToMigrate.forEach(({ win, originalBounds }) => {
        const target = chooseMigrationTarget(remainingDisplays, primaryDisplay);
        const nextPos = calculateMigrationPosition(originalBounds, target);
        const targetBounds = { ...originalBounds, x: nextPos.x, y: nextPos.y };
        if (movementManager && movementManager.moveWindow) {
            movementManager.moveWindow(win, targetBounds);
        } else {
            win.setBounds(targetBounds);
        }
        try {
            const displayId = target && target.id ? target.id : (screen.getPrimaryDisplay() || {}).id;
            const name = Array.from(windowPool.entries()).find(([, w]) => w === win)?.[0];
            if (name) windowStateService.updateWindowDisplay(name, displayId);
        } catch {}
    });

    setTimeout(() => updateChildWindowLayouts(true), 100);
}

function handleDisplayMetricsChange(changedDisplay, changedMetrics) {
    if (displayUpdateTimer) clearTimeout(displayUpdateTimer);
    displayUpdateTimer = setTimeout(() => {
        const affected = [];
        windowPool.forEach((win, name) => {
            if (!win || win.isDestroyed()) return;
            const d = getCurrentDisplay(win);
            if (d && changedDisplay && d.id === changedDisplay.id) affected.push({ win, name });
        });

        if (changedMetrics && (changedMetrics.includes('bounds') || changedMetrics.includes('workArea'))) {
            handleResolutionChange(affected, changedDisplay);
        }

        if (changedMetrics && changedMetrics.includes('scaleFactor')) {
            handleScaleFactorChange(affected, changedDisplay);
        }

        setTimeout(() => updateChildWindowLayouts(true), 100);
    }, 400);
}

function handleResolutionChange(affectedWindows, display) {
    const workArea = display.workArea;
    affectedWindows.forEach(({ win }) => {
        const b = win.getBounds();
        const clampedX = Math.max(workArea.x, Math.min(b.x, workArea.x + workArea.width - b.width));
        const clampedY = Math.max(workArea.y, Math.min(b.y, workArea.y + workArea.height - b.height));
        if (clampedX !== b.x || clampedY !== b.y) {
            const targetBounds = { ...b, x: clampedX, y: clampedY };
            if (movementManager && movementManager.moveWindow) {
                movementManager.moveWindow(win, targetBounds);
            } else {
                win.setBounds(targetBounds);
            }
        }
    });
}

function handleScaleFactorChange(affectedWindows, _display) {
    // For DPI changes, rely on downstream reflow
    // NOP here; we trigger updateChildWindowLayouts after debounce
}

function chooseMigrationTarget(displays, primaryDisplay) {
    const primaryInList = displays.find(d => d.id === primaryDisplay.id);
    if (primaryInList) return primaryDisplay;
    let best = displays[0];
    let maxArea = 0;
    displays.forEach(d => {
        const area = d.workArea.width * d.workArea.height;
        if (area > maxArea) {
            maxArea = area;
            best = d;
        }
    });
    return best;
}

function calculateMigrationPosition(originalBounds, targetDisplay) {
    const workArea = targetDisplay.workArea;
    const centerX = workArea.x + (workArea.width / 2) - (originalBounds.width / 2);
    const centerY = workArea.y + (workArea.height / 2) - (originalBounds.height / 2);
    const clampedX = Math.max(workArea.x + 10, Math.min(centerX, workArea.x + workArea.width - originalBounds.width - 10));
    const clampedY = Math.max(workArea.y + 10, Math.min(centerY, workArea.y + workArea.height - originalBounds.height - 10));
    return { x: Math.round(clampedX), y: Math.round(clampedY) };
}

function updateChildWindowLayouts(animated = true) {
    // if (movementManager.isAnimating) return;

    const visibleWindows = {};
    const listenWin = windowPool.get('listen');
    const askWin = windowPool.get('ask');
    const settingsWin = windowPool.get('settings');
    
    if (listenWin && !listenWin.isDestroyed() && listenWin.isVisible()) {
        visibleWindows.listen = true;
    }
    if (askWin && !askWin.isDestroyed() && askWin.isVisible()) {
        visibleWindows.ask = true;
    }
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
        visibleWindows.settings = true;
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
            console.log(`[WindowManager] Positioning ${windowName} at:`, layout);
            if (animated && movementManager) {
                // Use smooth movement if available
                movementManager.moveWindow(window, layout);
            } else {
                // Direct positioning
                window.setBounds(layout);
            }
        } else {
            console.warn(`[WindowManager] Cannot position ${windowName} - window not found or destroyed`);
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
        windowStateService.init(windowPool, layoutManager);
        
        // Create header window first
        await createHeaderWindow();
        
        // Create feature windows (but keep them hidden initially)
        await createListenWindow();
        await createAskWindow();
        await createSettingsWindow();
        
        // Set window pool in layout manager for advanced positioning
        layoutManager.setWindowPool(windowPool);
        
        // Register display change listeners
        cachedDisplays = screen.getAllDisplays();
        screen.on('display-added', () => {
            handleDisplayConfigurationChange();
        });
        screen.on('display-removed', (_e, display) => {
            handleDisplayRemoval(display && display.id);
        });
        screen.on('display-metrics-changed', (_e, display, changedMetrics) => {
            handleDisplayMetricsChange(display, changedMetrics);
        });

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
        show: false,  // Don't show immediately
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../../dist/renderer/header/preload.js')
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

    // Attempt restore (but force correct height for header)
    try {
        windowStateService.restoreWindowState('header', headerWindow);
        // Force correct header height (70px) - don't let saved state override this
        const currentBounds = headerWindow.getBounds();
        if (currentBounds.height !== 70) {
            headerWindow.setBounds({
                x: currentBounds.x,
                y: currentBounds.y,
                width: currentBounds.width,
                height: 70
            });
            console.log('[WindowManager] Corrected header height from', currentBounds.height, 'to 70');
        }
    } catch {}
    
    // Track header movement to reflow child windows
    let moveThrottleTimer = null;
    headerWindow.on('moved', () => {
        // Throttle updates to prevent glitchy movement
        if (!moveThrottleTimer) {
            updateChildWindowLayouts(false);
            moveThrottleTimer = setTimeout(() => {
                moveThrottleTimer = null;
            }, 16); // ~60fps throttle
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
    try { windowStateService.attachListeners('header', headerWindow); } catch {}
    console.log('[WindowManager] ✅ Header window created');
    console.log('[WindowManager] Header window bounds:', headerWindow.getBounds());
    
    // Show the header window after a small delay (only if not already visible)
    setTimeout(() => {
        if (!headerWindow.isVisible()) {
            headerWindow.show();
            console.log('[WindowManager] Header window shown');
        }
    }, 200);
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
            preload: path.join(__dirname, '../../dist/renderer/listen/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        listenWindow.setWindowButtonVisibility(false);
        listenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    
    // Apply liquid glass effect if supported
    if (shouldUseLiquidClueless && liquidGlass) {
        try {
            await liquidGlass.setWindowEffect(listenWindow, 'acrylic');
        } catch (error) {
            console.warn('[WindowManager] Could not apply liquid glass effect to listen window:', error);
        }
    }
    
    // Ensure the window is positioned correctly
    listenWindow.setBounds(listenLayout);
    console.log('[WindowManager] Listen window positioned at:', listenLayout);
    
    const listenHtmlPath = path.join(__dirname, '../../dist/renderer/listen/index.html');
    console.log('[WindowManager] Loading Listen window HTML from:', listenHtmlPath);
    await listenWindow.loadFile(listenHtmlPath);

    // Attempt restore (keep hidden by default unless requested later)
    try { windowStateService.restoreWindowState('listen', listenWindow); } catch {}
    
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
    try { windowStateService.attachListeners('listen', listenWindow); } catch {}
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
            preload: path.join(__dirname, '../../dist/renderer/ask/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        askWindow.setWindowButtonVisibility(false);
        askWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    
    // Apply liquid glass effect if supported
    if (shouldUseLiquidClueless && liquidGlass) {
        try {
            await liquidGlass.setWindowEffect(askWindow, 'acrylic');
        } catch (error) {
            console.warn('[WindowManager] Could not apply liquid glass effect to ask window:', error);
        }
    }
    
    // Ensure the window is positioned correctly
    askWindow.setBounds(askLayout);
    console.log('[WindowManager] Ask window positioned at:', askLayout);
    
    const askHtmlPath = path.join(__dirname, '../../dist/renderer/ask/index.html');
    console.log('[WindowManager] Loading Ask window HTML from:', askHtmlPath);
    await askWindow.loadFile(askHtmlPath);

    // Attempt restore
    try { windowStateService.restoreWindowState('ask', askWindow); } catch {}
    
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
    try { windowStateService.attachListeners('ask', askWindow); } catch {}
    console.log('[WindowManager] ✅ Ask window created');
}

async function createSettingsWindow() {
    console.log('[WindowManager] Creating settings window...');

    // Get header window bounds if available
    const headerWindow = windowPool.get('header');
    const headerBounds = headerWindow && !headerWindow.isDestroyed() ? headerWindow.getBounds() : null;
    const settingsLayout = layoutManager.calculateSettingsWindowLayout(headerBounds);

    console.log('[WindowManager] Settings layout calculated:', settingsLayout);
    
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
            preload: path.join(__dirname, '../../dist/renderer/settings/preload.js')
        }
    });
    
    // macOS-specific optimizations
    if (process.platform === 'darwin') {
        settingsWindow.setWindowButtonVisibility(false);
        settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    
    // Apply liquid glass effect if supported
    if (shouldUseLiquidClueless && liquidGlass) {
        try {
            await liquidGlass.setWindowEffect(settingsWindow, 'acrylic');
        } catch (error) {
            console.warn('[WindowManager] Could not apply liquid glass effect to settings window:', error);
        }
    }
    
    const settingsHtmlPath = path.join(__dirname, '../../dist/renderer/settings/index.html');
    const settingsPreloadPath = path.join(__dirname, '../../dist/renderer/settings/preload.js');
    console.log('[WindowManager] Loading Settings window HTML from:', settingsHtmlPath);
    console.log('[WindowManager] Settings window preload path:', settingsPreloadPath);

    // Check if files exist
    const fs = require('fs');
    console.log('[WindowManager] HTML file exists:', fs.existsSync(settingsHtmlPath));
    console.log('[WindowManager] Preload file exists:', fs.existsSync(settingsPreloadPath));

    await settingsWindow.loadFile(settingsHtmlPath);

    // Attempt restore
    try { windowStateService.restoreWindowState('settings', settingsWindow); } catch {}
    
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

    // Add event listeners for debugging
    settingsWindow.on('ready-to-show', () => {
        console.log('[WindowManager] Settings window ready to show');
    });

    settingsWindow.webContents.on('did-finish-load', () => {
        console.log('[WindowManager] Settings window HTML loaded');
    });

    settingsWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Settings Console] ${message}`);
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
    try { windowStateService.attachListeners('settings', settingsWindow); } catch {}
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
