/**
 * Enhanced Main Process with Service Registry Architecture
 * This file demonstrates the improved service architecture with proper lifecycle management
 */

require('dotenv').config();

// Handle Windows installer events
if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, dialog } = require('electron');
const serviceRegistry = require('./services/core/ServiceRegistry');

// Import services
const DatabaseService = require('./services/DatabaseService');
const AuthService = require('./services/AuthService');
const WindowService = require('./services/WindowService');

// Import existing services that need to be wrapped
const { initializeFirebase } = require('./features/common/services/firebaseClient');
const featureBridge = require('./bridge/featureBridge');
const windowBridge = require('./bridge/windowBridge');
const modelStateService = require('./features/common/services/modelStateService');
const ollamaService = require('./features/common/services/ollamaService');
const settingsService = require('./features/settings/settingsService');
const askService = require('./features/ask/askService');
const listenService = require('./features/listen/listenService');

// Create a wrapper for existing services
const BaseService = require('./services/core/BaseService');

class FirebaseServiceWrapper extends BaseService {
    constructor() {
        super('FirebaseService', { isCritical: false });
    }
    
    async onInitialize() {
        await initializeFirebase();
    }
}

class BridgeServiceWrapper extends BaseService {
    constructor(name, bridgeModule) {
        super(name, { isCritical: true });
        this.bridge = bridgeModule;
    }
    
    async onInitialize() {
        // Bridges are already initialized
        console.log(`[${this.name}] Bridge initialized`);
    }
}

class ModelStateServiceWrapper extends BaseService {
    constructor() {
        super('ModelStateService', { isCritical: false });
    }
    
    async onInitialize() {
        await modelStateService.initialize();
    }
}

class OllamaServiceWrapper extends BaseService {
    constructor() {
        super('OllamaService', { isCritical: false });
    }
    
    async onInitialize() {
        // Ollama initialization is handled later
        console.log('[OllamaService] Will initialize after app is ready');
    }
    
    async onStart() {
        // Start Ollama service if configured
        const shouldStart = await settingsService.getSetting('ollama_autostart');
        if (shouldStart) {
            await ollamaService.startService();
        }
    }
    
    async onStop() {
        await ollamaService.stopService();
    }
}

// Global state
let isShuttingDown = false;

/**
 * Register all services with the registry
 */
function registerServices() {
    console.log('[Main] Registering services...');
    
    // Register infrastructure services
    serviceRegistry.register('FirebaseService', new FirebaseServiceWrapper(), {
        isCritical: false,
        initPriority: 10
    });
    
    serviceRegistry.register('DatabaseService', DatabaseService, {
        isCritical: true,
        initPriority: 20
    });
    
    // Register auth service with dependency on database
    serviceRegistry.register('AuthService', AuthService, {
        isCritical: false,
        initPriority: 30,
        dependencies: ['DatabaseService', 'FirebaseService']
    });
    
    // Register model and settings services
    serviceRegistry.register('ModelStateService', new ModelStateServiceWrapper(), {
        isCritical: false,
        initPriority: 40,
        dependencies: ['DatabaseService']
    });
    
    // Register bridge services
    serviceRegistry.register('FeatureBridge', new BridgeServiceWrapper('FeatureBridge', featureBridge), {
        isCritical: true,
        initPriority: 50
    });
    
    serviceRegistry.register('WindowBridge', new BridgeServiceWrapper('WindowBridge', windowBridge), {
        isCritical: true,
        initPriority: 51
    });
    
    // Register AI services
    serviceRegistry.register('OllamaService', new OllamaServiceWrapper(), {
        isCritical: false,
        initPriority: 60,
        metadata: { autoStart: true }
    });
    
    // Register window service
    serviceRegistry.register('WindowService', WindowService, {
        isCritical: true,
        initPriority: 70,
        metadata: { autoStart: true }
    });
    
    console.log('[Main] All services registered');
}

/**
 * Setup protocol handling
 */
function setupProtocolHandling() {
    try {
        if (!app.isDefaultProtocolClient('halo')) {
            const success = app.setAsDefaultProtocolClient('halo');
            if (success) {
                console.log('[Protocol] Successfully registered halo:// protocol');
            } else {
                console.warn('[Protocol] Failed to register protocol');
            }
        }
    } catch (error) {
        console.error('[Protocol] Error during protocol registration:', error);
    }
}

/**
 * Initialize application
 */
async function initializeApp() {
    console.log('[Main] Initializing Halo application...');
    
    try {
        // Register all services
        registerServices();
        
        // Initialize all services in dependency order
        await serviceRegistry.initializeAll();
        
        // Start services that need to be started
        await serviceRegistry.startAll();
        
        // Make critical services globally available
        global.modelStateService = modelStateService;
        global.databaseService = serviceRegistry.get('DatabaseService');
        global.authService = serviceRegistry.get('AuthService');
        global.windowService = serviceRegistry.get('WindowService');
        
        console.log('[Main] Application initialized successfully');
        
        // Show health status
        const health = serviceRegistry.getHealthStatus();
        console.log('[Main] Health Status:', {
            healthy: health.healthy,
            summary: health.summary
        });
        
        // Background tasks
        setTimeout(() => {
            warmupModels();
        }, 5000);
        
    } catch (error) {
        console.error('[Main] Failed to initialize application:', error);
        
        dialog.showErrorBox(
            'Initialization Error',
            `Failed to initialize Halo: ${error.message}\n\nThe application will now exit.`
        );
        
        app.quit();
    }
}

/**
 * Warmup AI models in background
 */
async function warmupModels() {
    try {
        const ollamaService = serviceRegistry.get('OllamaService');
        if (ollamaService && ollamaService.isReady()) {
            console.log('[Main] Starting background model warmup...');
            // Model warmup logic here
        }
    } catch (error) {
        console.error('[Main] Model warmup error:', error);
    }
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown() {
    if (isShuttingDown) {
        console.log('[Main] Shutdown already in progress');
        return;
    }
    
    isShuttingDown = true;
    console.log('[Main] Starting graceful shutdown...');
    
    try {
        // Shutdown all services with 10 second timeout
        await serviceRegistry.shutdownAll(10000);
        
        console.log('[Main] Graceful shutdown complete');
    } catch (error) {
        console.error('[Main] Error during shutdown:', error);
    } finally {
        // Force quit after cleanup
        app.quit();
    }
}

/**
 * Setup application event handlers
 */
function setupAppHandlers() {
    // Handle app ready
    app.whenReady().then(async () => {
        console.log('[Main] Electron app ready');
        
        // Setup protocol handling
        setupProtocolHandling();
        
        // Initialize application
        await initializeApp();
    });
    
    // Handle all windows closed
    app.on('window-all-closed', () => {
        console.log('[Main] All windows closed');
        
        if (process.platform !== 'darwin') {
            handleShutdown();
        }
    });
    
    // Handle before quit
    app.on('before-quit', async (event) => {
        if (!isShuttingDown) {
            console.log('[Main] Before quit - starting shutdown');
            event.preventDefault();
            await handleShutdown();
        }
    });
    
    // Handle will quit
    app.on('will-quit', (event) => {
        if (!isShuttingDown) {
            console.log('[Main] Will quit - preventing premature exit');
            event.preventDefault();
            handleShutdown();
        }
    });
    
    // Handle activate (macOS)
    app.on('activate', () => {
        const windowService = serviceRegistry.get('WindowService');
        if (windowService && windowService.isReady()) {
            const windows = windowService.getAllWindows();
            if (windows.size === 0) {
                windowService.start();
            }
        }
    });
    
    // Handle second instance
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
        console.log('[Main] Another instance is already running');
        app.quit();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            console.log('[Main] Second instance attempted to start');
            
            // Focus existing windows
            const windowService = serviceRegistry.get('WindowService');
            if (windowService && windowService.isReady()) {
                windowService.showWindow('header');
            }
        });
    }
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('[Main] Uncaught exception:', error);
        
        dialog.showErrorBox(
            'Unexpected Error',
            `An unexpected error occurred: ${error.message}\n\nThe application will attempt to recover.`
        );
        
        // Attempt to recover by restarting affected services
        recoverFromError(error);
    });
    
    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
    });
}

/**
 * Attempt to recover from errors
 */
async function recoverFromError(error) {
    try {
        // Get health status
        const health = serviceRegistry.getHealthStatus();
        
        // Restart failed services
        for (const [name, status] of Object.entries(health.services)) {
            if (status.state === 'failed') {
                console.log(`[Main] Attempting to restart failed service: ${name}`);
                await serviceRegistry.restartService(name);
            }
        }
    } catch (recoveryError) {
        console.error('[Main] Recovery failed:', recoveryError);
        
        // If recovery fails, shutdown gracefully
        handleShutdown();
    }
}

/**
 * Service health monitoring
 */
function startHealthMonitoring() {
    setInterval(() => {
        const health = serviceRegistry.getHealthStatus();
        
        if (!health.healthy) {
            console.warn('[Main] Application health check failed:', health.summary);
            
            // Attempt to recover unhealthy services
            for (const [name, status] of Object.entries(health.services)) {
                if (status.state === 'failed' && status.isCritical) {
                    console.error(`[Main] Critical service failed: ${name}`);
                    // Could trigger recovery or alert here
                }
            }
        }
    }, 30000); // Check every 30 seconds
}

// Start the application
console.log('[Main] Starting Halo Desktop Application...');
setupAppHandlers();
startHealthMonitoring();

// Export for testing
module.exports = {
    serviceRegistry,
    initializeApp,
    handleShutdown
};