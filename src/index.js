// Development reloader (commented out in production)
// try {
//     const reloader = require('electron-reloader');
//     reloader(module, {
//     });
// } catch (err) {
// }

require('dotenv').config();

// Handle Windows installer events
// Commented out as it may cause issues on macOS
// if (require('electron-squirrel-startup')) {
//     process.exit(0);
// }

// Import Electron modules and Clueless services
const { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, session } = require('electron');
const { createWindows } = require('./window/windowManager.js');
const listenService = require('./features/listen/listenService');
const listenIPCHandlers = require('./features/listen/ipcHandlers');
const { initializeFirebase } = require('./features/common/services/firebaseClient');
const databaseInitializer = require('./features/common/services/databaseInitializer');
const authService = require('./features/common/services/authService');
const path = require('node:path');
const express = require('express');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const askIPCHandlers = require('./features/ask/ipcHandlers');
const modelStateService = require('./features/common/services/modelStateService');
const featureBridge = require('./bridge/featureBridge');
const windowBridge = require('./bridge/windowBridge');
const splashService = require('./services/SplashService');

// Import new configuration and infrastructure services
const configService = require('./services/ConfigService');
const encryptionService = require('./services/EncryptionService');
const settingsStoreService = require('./features/settings/settingsService');

// Global variables
let WEB_PORT = 3000;
let isShuttingDown = false; // Flag to prevent infinite shutdown loop

// Make modelStateService globally available
global.modelStateService = modelStateService;

// Import and initialize OllamaService
const ollamaService = require('./features/common/services/ollamaService');

// Native deep link handling - cross-platform compatible
let pendingDeepLinkUrl = null;

function setupProtocolHandling() {
    // Protocol registration - must be done before app is ready
    try {
        if (!app.isDefaultProtocolClient('halo')) {
            const success = app.setAsDefaultProtocolClient('halo');
            if (success) {
                console.log('[Protocol] Successfully set as default protocol client for halo://');
            } else {
                console.warn('[Protocol] Failed to set as default protocol client - this may affect deep linking');
            }
        } else {
            console.log('[Protocol] Already registered as default protocol client for halo://');
        }
    } catch (error) {
        console.error('[Protocol] Error during protocol registration:', error);
    }

    // Handle protocol URLs on Windows/Linux
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('[Protocol] Second instance command line:', commandLine);
        
        focusMainWindow();
        
        let protocolUrl = null;
        
        // Search through all command line arguments for a valid protocol URL
        for (const arg of commandLine) {
            if (arg && typeof arg === 'string' && arg.startsWith('halo://')) {
                // Clean up the URL by removing problematic characters
                const cleanUrl = arg.replace(/[\\₩]/g, '');
                
                // Additional validation for Windows
                if (process.platform === 'win32') {
                    // On Windows, ensure the URL doesn't contain file path indicators
                    if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                        protocolUrl = cleanUrl;
                        break;
                    }
                } else {
                    protocolUrl = cleanUrl;
                    break;
                }
            }
        }
        
        if (protocolUrl) {
            console.log('[Protocol] Valid URL found from second instance:', protocolUrl);
            handleCustomUrl(protocolUrl);
        } else {
            console.log('[Protocol] No valid protocol URL found in command line arguments');
            console.log('[Protocol] Command line args:', commandLine);
        }
    });

    // Handle protocol URLs on macOS
    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('[Protocol] Received URL via open-url:', url);
        
        if (!url || !url.startsWith('halo://')) {
            console.warn('[Protocol] Invalid URL format:', url);
            return;
        }

        if (app.isReady()) {
            handleCustomUrl(url);
        } else {
            pendingDeepLinkUrl = url;
            console.log('[Protocol] App not ready, storing URL for later');
        }
    });
}

function focusMainWindow() {
    const { windowPool } = require('./window/windowManager.js');
    if (windowPool) {
        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            if (header.isMinimized()) header.restore();
            header.focus();
            return true;
        }
    }
    
    // Fallback: focus any available window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        const mainWindow = windows[0];
        if (!mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            return true;
        }
    }
    
    return false;
}

// Handle Windows command line arguments for protocol URLs
if (process.platform === 'win32') {
    for (const arg of process.argv) {
        if (arg && typeof arg === 'string' && arg.startsWith('halo://')) {
            // Clean up the URL by removing problematic characters
            const cleanUrl = arg.replace(/[\\₩]/g, '');
            
            if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                console.log('[Protocol] Found protocol URL in initial arguments:', cleanUrl);
                pendingDeepLinkUrl = cleanUrl;
                break;
            }
        }
    }
    
    console.log('[Protocol] Initial process.argv:', process.argv);
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// Setup protocol after single instance lock
setupProtocolHandling();

// ============================================================================
// MAIN PROCESS LIFECYCLE MANAGEMENT
// ============================================================================

// Critical initialization order as described in the lesson:
// 1. Firebase (authentication)
// 2. Database (required by all services)
// 3. Authentication (validates user and loads preferences)
// 4. Model State (manages AI model availability)
// 5. Bridges (connect main and renderer processes)
// 6. Web Server (provides dashboard interface)
// 7. Windows (the UI that users interact with)

async function initializeServices() {
    console.log('[Lifecycle] Starting service initialization...');
    
    try {
        // 1. Initialize Firebase first for authentication
        console.log('[Lifecycle] Initializing Firebase...');
        await initializeFirebase();
        console.log('[Lifecycle] ✅ Firebase initialized');
        
        // 2. Initialize database (required by all other services)
        console.log('[Lifecycle] Initializing database...');
        await databaseInitializer.initialize();
        console.log('[Lifecycle] ✅ Database initialized');
        
        // 3. Initialize encryption and settings services
        console.log('[Lifecycle] Initializing encryption and settings...');
        const userId = 'default'; // Will be replaced with actual user ID after auth
        await encryptionService.initialize(userId);
        console.log('[Lifecycle] ✅ Encryption and settings initialized');
        
        // Register settings handlers with featureBridge
        featureBridge.registerHandler('settings', 'update', async (data) => {
            console.log('[Lifecycle] Settings update handler called with:', Object.keys(data));
            
            // Apply screen invisibility setting if changed
            if ('screenInvisibility' in data) {
                const windowManager = require('./window/windowManager');
                windowManager.setContentProtection(data.screenInvisibility);
                console.log(`[Lifecycle] Screen invisibility set to: ${data.screenInvisibility}`);
            }
            
            return await settingsStoreService.saveSettings(data);
        });
        featureBridge.registerHandler('settings', 'get', async (key) => {
            return await settingsStoreService.getSettings();
        });
        console.log('[Lifecycle] ✅ Settings handlers registered');
        
        // 4. Initialize authentication
        console.log('[Lifecycle] Initializing authentication...');
        // Authentication is handled by Firebase, just verify it's working
        console.log('[Lifecycle] ✅ Authentication ready');
        
        // 5. Initialize model state service
        console.log('[Lifecycle] Initializing model state...');
        await modelStateService.setCurrentModel('gpt-4');
        console.log('[Lifecycle] ✅ Model state initialized');
        
        // 5. Initialize bridges (already imported and will be set up)
        console.log('[Lifecycle] ✅ Bridges ready');
        
        // 6. Initialize screenshot bridge for Python agent
        console.log('[Lifecycle] Starting screenshot bridge...');
        try {
            const screenshotBridge = require('./services/screenshotBridge');
            await screenshotBridge.start();
            console.log('[Lifecycle] ✅ Screenshot bridge started');
        } catch (error) {
            console.error('[Lifecycle] ⚠️ Screenshot bridge failed to start:', error);
            // Non-critical service, continue initialization
        }
        
        // 7. Initialize web server
        console.log('[Lifecycle] Starting web server...');
        await startWebServer();
        console.log('[Lifecycle] ✅ Web server started');
        
        console.log('[Lifecycle] 🎉 All services initialized successfully!');
        
    } catch (error) {
        console.error('[Lifecycle] ❌ Service initialization failed:', error);
        // Implement defensive programming - show error but don't crash
        showInitializationError(error);
    }
}

async function startWebServer() {
    const app = express();
    
    app.get('/', (req, res) => {
        res.send(`
            <html>
                <head><title>Halo Dashboard</title></head>
                <body>
                    <h1>Halo Desktop Assistant</h1>
                    <p>Web dashboard is running on port ${WEB_PORT}</p>
                    <p>Status: Ready</p>
                </body>
            </html>
        `);
    });
    
    // Try to find an available port
    const net = require('net');
    
    function findAvailablePort(startPort) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            
            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    // Try next port
                    findAvailablePort(startPort + 1).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
        });
    }
    
    try {
        const availablePort = await findAvailablePort(WEB_PORT);
        WEB_PORT = availablePort; // Update global port variable
        
        return new Promise((resolve, reject) => {
            const server = app.listen(availablePort, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`[WebServer] Dashboard running on http://localhost:${availablePort}`);
                    resolve(server);
                }
            });
        });
    } catch (error) {
        console.warn('[WebServer] Could not start web server:', error.message);
        console.log('[WebServer] Continuing without web server...');
        return null; // Return null instead of throwing to allow app to continue
    }
}

function showInitializationError(error) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
        'Halo Initialization Error',
        `Failed to initialize Halo: ${error.message}\n\nSome features may not work properly.`
    );
}

async function gracefulShutdown() {
    if (isShuttingDown) {
        console.log('[Lifecycle] Shutdown already in progress, forcing exit...');
        process.exit(0);
    }
    
    isShuttingDown = true;
    console.log('[Lifecycle] Starting graceful shutdown...');
    
    try {
        // Save any unsaved data
        console.log('[Lifecycle] Saving data...');
        // Add data saving logic here when needed
        
        // Close active AI model connections
        console.log('[Lifecycle] Closing AI connections...');
        await listenService.stopListening();
        await listenService.stopTranscription();
        await listenService.cleanup();
        
        // Cleanup Ask service
        console.log('[Lifecycle] Cleaning up Ask service...');
        await askService.cleanup();
        
        // Stop audio recording sessions
        console.log('[Lifecycle] Stopping audio sessions...');
        // Audio cleanup logic here
        
        // Clean up database connections
        console.log('[Lifecycle] Cleaning up database...');
        // Database cleanup logic here
        
        // Stop screenshot bridge
        console.log('[Lifecycle] Stopping screenshot bridge...');
        try {
            const screenshotBridge = require('./services/screenshotBridge');
            screenshotBridge.stop();
        } catch (error) {
            console.error('[Lifecycle] Error stopping screenshot bridge:', error);
        }
        
        console.log('[Lifecycle] ✅ Graceful shutdown completed');
        
    } catch (error) {
        console.error('[Lifecycle] ❌ Error during shutdown:', error);
    } finally {
        // Force quit after timeout to prevent hanging
        setTimeout(() => {
            console.log('[Lifecycle] Force quitting after timeout...');
            process.exit(0);
        }, 5000);
    }
}

// ============================================================================
// LIFECYCLE EVENTS
// ============================================================================

// Most important event - fires when Electron is ready to create windows
app.whenReady().then(async () => {
    console.log('[Lifecycle] App is ready, starting initialization...');
    
    // Initialize configuration service first
    console.log('[Lifecycle] Initializing configuration...');
    configService.initialize();
    
    // Initialize and show splash screen
    console.log('[Lifecycle] Initializing splash screen...');
    await splashService.initialize();
    
    // Setup callback for when splash is dismissed BEFORE starting it
    let windowsCreated = false;
    splashService.setOnNextCallback(async () => {
        if (windowsCreated) {
            console.log('[Lifecycle] Windows already created, skipping...');
            return;
        }
        windowsCreated = true;
        
        console.log('[Lifecycle] Transitioning from splash to main app...');
        
        // Add a small delay to ensure splash is fully dismissed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create main windows
        await createWindows();
        console.log('[Lifecycle] ✅ Windows created');
        
        // Apply screen invisibility setting if it was saved
        try {
            const settings = await settingsStoreService.getSettings();
            if (settings && settings.screenInvisibility) {
                const windowManager = require('./window/windowManager');
                windowManager.setContentProtection(true);
                console.log('[Lifecycle] Applied saved screen invisibility setting: enabled');
            }
        } catch (error) {
            console.error('[Lifecycle] Error applying screen invisibility setting:', error);
        }
        
        // Connect and initialize bridges
        const { windowPool } = require('./window/windowManager.js');
        windowBridge.setWindowPool(windowPool);
        try { windowBridge.initialize(); } catch {}
        try { (require('./bridge/featureBridge')).initialize(); } catch {}
        console.log('[Lifecycle] ✅ Bridges connected');

        // Initialize capture window for media capture
        console.log('[Lifecycle] Initializing capture window...');
        try {
            const captureWindow = require('./windows/captureWindow');
            captureWindow.create();
            await captureWindow.waitForReady();
            console.log('[Lifecycle] ✅ Capture window initialized');
        } catch (error) {
            console.error('[Lifecycle] ❌ Failed to initialize capture window:', error);
            // Continue without capture window - system audio will still work
        }
        
        // Request microphone permissions on macOS
        if (process.platform === 'darwin') {
            const { systemPreferences } = require('electron');
            console.log('[Lifecycle] Checking microphone permissions...');
            try {
                const micStatus = systemPreferences.getMediaAccessStatus('microphone');
                console.log('[Lifecycle] Microphone permission status:', micStatus);
                
                if (micStatus === 'not-determined') {
                    console.log('[Lifecycle] Requesting microphone access...');
                    const granted = await systemPreferences.askForMediaAccess('microphone');
                    console.log('[Lifecycle] Microphone access granted:', granted);
                }
            } catch (error) {
                console.error('[Lifecycle] Error checking microphone permissions:', error);
            }
        }
        
        // Initialize Listen Service and IPC handlers
        try {
            await listenService.initialize();
            
            // Register listen service handlers with featureBridge
            featureBridge.registerHandler('listen', 'start', async (data) => {
                return await listenService.startListening(data);
            });
            featureBridge.registerHandler('listen', 'stop', async (data) => {
                return await listenService.stopListening();
            });
            featureBridge.registerHandler('listen', 'status', async () => {
                return listenService.getStatus();
            });
            
            // Set up LiveKit event forwarding to listen window
            listenService.setCallback('onLiveKitEvent', (event, data) => {
                // Forward LiveKit events to the listen window
                const listenWindow = windowPool.get('listen');
                if (listenWindow && !listenWindow.isDestroyed()) {
                    listenWindow.webContents.send(`livekit:${event}`, data);
                }
            });
            
            // Handle LiveKit events from renderer process
            ipcMain.on('livekit:event', (event, { event: livekitEvent, data }) => {
                console.log(`[Main] LiveKit event from renderer: ${livekitEvent}`, data);
                // Forward to listen window if needed
                const listenWindow = windowPool.get('listen');
                if (listenWindow && !listenWindow.isDestroyed()) {
                    listenWindow.webContents.send(`livekit:${livekitEvent}`, data);
                }
            });
            
            // Forward status updates to listen window
            listenService.setCallback('onStatusUpdate', (status) => {
                const listenWindow = windowPool.get('listen');
                if (listenWindow && !listenWindow.isDestroyed()) {
                    listenWindow.webContents.send('listen:status', status);
                }
            });
            
            // Forward errors to listen window
            listenService.setCallback('onError', (error) => {
                const listenWindow = windowPool.get('listen');
                if (listenWindow && !listenWindow.isDestroyed()) {
                    listenWindow.webContents.send('listen:error', error);
                }
            });
            
            listenIPCHandlers.initialize();
            console.log('[Lifecycle] ✅ Listen Service initialized');
        } catch (error) {
            console.error('[Lifecycle] ❌ Listen Service initialization failed:', error);
        }
        
        // Initialize Ask Service and IPC handlers
        try {
            await askService.initialize();
            
            // Register ask service handlers with featureBridge
            featureBridge.registerHandler('ask', 'captureScreenshot', async (options) => {
                return await askService.captureScreenshot(options);
            });
            featureBridge.registerHandler('ask', 'getSources', async (options) => {
                return await askService.getAvailableSources(options);
            });
            
            askIPCHandlers.initialize();
            console.log('[Lifecycle] ✅ Ask Service initialized');
        } catch (error) {
            console.error('[Lifecycle] ❌ Ask Service initialization failed:', error);
        }
        
        // One-time layout update and periodic state saving
        try {
            const { updateChildWindowLayouts } = require('./window/windowManager.js');
            updateChildWindowLayouts(false);
        } catch {}
        
        try {
            const windowStateService = require('./services/windowStateService');
            setInterval(() => {
                try {
                    const header = windowPool.get('header');
                    const ask = windowPool.get('ask');
                    const listen = windowPool.get('listen');
                    const settingsWin = windowPool.get('settings');
                    if (header && !header.isDestroyed()) windowStateService.saveWindowState('header', header);
                    if (ask && !ask.isDestroyed()) windowStateService.saveWindowState('ask', ask);
                    if (listen && !listen.isDestroyed()) windowStateService.saveWindowState('listen', listen);
                    if (settingsWin && !settingsWin.isDestroyed()) windowStateService.saveWindowState('settings', settingsWin);
                } catch {}
            }, 30000);
        } catch {}

        // Dev/CLI: --restore-test prints current bounds of windows after creation
        try {
            if (process.argv && process.argv.includes('--restore-test')) {
                const logBounds = (name) => {
                    const win = windowPool.get(name);
                    if (win && !win.isDestroyed()) {
                        const b = win.getBounds();
                        console.log(`[RestoreTest] ${name}: x=${b.x} y=${b.y} w=${b.width} h=${b.height} vis=${win.isVisible()}`);
                    } else {
                        console.log(`[RestoreTest] ${name}: not available`);
                    }
                };
                console.log('[RestoreTest] --- Window bounds after creation ---');
                logBounds('header');
                logBounds('ask');
                logBounds('listen');
                logBounds('settings');
                console.log('[RestoreTest] -----------------------------------');
            }
        } catch {}
        
        // Close splash window
        splashService.closeSplash();
    });
    
    console.log('[Lifecycle] Starting splash screen...');
    await splashService.start();
    
    // Handle any pending deep link URL
    if (pendingDeepLinkUrl) {
        console.log('[Lifecycle] Processing pending deep link:', pendingDeepLinkUrl);
        handleCustomUrl(pendingDeepLinkUrl);
        pendingDeepLinkUrl = null;
    }
    
    // Initialize all services in the correct order (happens while splash is showing)
    await initializeServices();
    
    // Services are initialized, splash will wait for user to click "Get Started"
    console.log('[Lifecycle] Services initialized, waiting for user to click Get Started...');
});

// Graceful shutdown when user attempts to quit
app.on('before-quit', async (event) => {
    console.log('[Lifecycle] before-quit event triggered');
    
    // Prevent default quit behavior
    event.preventDefault();
    
    // Start graceful shutdown
    await gracefulShutdown();
});

// Handle when all windows are closed
app.on('window-all-closed', () => {
    console.log('[Lifecycle] All windows closed');
    
    // On macOS, applications typically stay running even when all windows are closed
    if (process.platform !== 'darwin') {
        console.log('[Lifecycle] Non-macOS platform, quitting app');
        app.quit();
    } else {
        console.log('[Lifecycle] macOS platform, keeping app running in dock');
    }
});

// macOS-specific: Recreate windows when app is activated from dock
app.on('activate', async () => {
    console.log('[Lifecycle] App activated (macOS)');
    
    // Recreate windows if none exist
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
        console.log('[Lifecycle] No windows exist, recreating...');
        await createWindows();
        
        // Apply screen invisibility setting to newly created windows
        try {
            const settings = await settingsStoreService.getSettings();
            if (settings && settings.screenInvisibility) {
                const windowManager = require('./window/windowManager');
                windowManager.setContentProtection(true);
                console.log('[Lifecycle] Applied saved screen invisibility setting to recreated windows');
            }
        } catch (error) {
            console.error('[Lifecycle] Error applying screen invisibility setting:', error);
        }
    } else {
        // Focus existing windows
        const header = windows.find(w => w.getTitle().includes('Header'));
        if (header && !header.isDestroyed()) {
            header.focus();
        }
    }
});

// Handle uncaught exceptions with defensive programming
process.on('uncaughtException', (error) => {
    console.error('[Lifecycle] Uncaught exception:', error);
    
    // Show error to user but don't crash
    const { dialog } = require('electron');
    dialog.showErrorBox(
        'Halo Error',
        `An unexpected error occurred: ${error.message}\n\nThe application will continue running.`
    );
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Lifecycle] Unhandled promise rejection:', reason);
    console.error('[Lifecycle] Promise:', promise);
});

// ============================================================================
// DEEP LINK HANDLING
// ============================================================================

function handleCustomUrl(url) {
    console.log('[Protocol] Handling custom URL:', url);
    
    // Parse the URL and handle different actions
    try {
        const urlObj = new URL(url);
        const action = urlObj.hostname;
        const params = new URLSearchParams(urlObj.search);
        
        console.log('[Protocol] Action:', action);
        console.log('[Protocol] Params:', Object.fromEntries(params));
        
        // Handle different protocol actions
        switch (action) {
            case 'auth':
                console.log('[Protocol] Handling authentication callback');
                // Handle authentication callback
                break;
            case 'settings':
                console.log('[Protocol] Opening settings');
                // Open settings window
                break;
            case 'listen':
                console.log('[Protocol] Starting listen mode');
                // Start listening mode
                break;
            default:
                console.log('[Protocol] Unknown action:', action);
        }
        
    } catch (error) {
        console.error('[Protocol] Error parsing URL:', error);
    }
}
