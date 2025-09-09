const { desktopCapturer, session } = require('electron');
const { EventEmitter } = require('events');
const permissionService = require('../../listen/services/permissionService');

/**
 * DesktopCaptureService - Comprehensive desktop capture for Clueless Ask feature
 * Handles screenshot capture with platform-specific optimizations
 */
class DesktopCaptureService extends EventEmitter {
    constructor() {
        super();
        this.platform = process.platform;
        this.isInitialized = false;
        this.displayMediaHandlerSetup = false;
        
        // Capture configuration
        this.config = {
            defaultQuality: 70,
            maxWidth: 1920,
            maxHeight: 1080,
            minWidth: 640,
            minHeight: 480,
            thumbnailSize: {
                width: 1920,
                height: 1080
            },
            compression: {
                jpeg: 70,
                png: 9
            }
        };
        
        // Capture state
        this.captureState = {
            lastCapture: null,
            availableSources: [],
            primarySource: null,
            captureCount: 0,
            totalSize: 0
        };
        
        // Performance metrics
        this.metrics = {
            capturesPerformed: 0,
            totalCaptureTime: 0,
            averageCaptureTime: 0,
            lastCaptureTime: 0,
            errors: 0,
            lastError: null
        };
    }

    /**
     * Initialize the desktop capture service
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log('[DesktopCapture] Initializing desktop capture service...');
            
            // Initialize permission service
            await permissionService.initialize();
            
            // Setup platform-specific handlers
            await this._setupPlatformHandlers();
            
            // Get initial available sources
            await this._refreshAvailableSources();
            
            this.isInitialized = true;
            console.log('[DesktopCapture] ✅ Initialized successfully');
            
            this.emit('initialized');
            return true;
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Initialization failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Setup platform-specific handlers
     */
    async _setupPlatformHandlers() {
        try {
            switch (this.platform) {
                case 'win32':
                    await this._setupWindowsDisplayMediaHandler();
                    break;
                case 'darwin':
                    await this._setupMacOSHandlers();
                    break;
                case 'linux':
                    await this._setupLinuxHandlers();
                    break;
                default:
                    console.warn(`[DesktopCapture] Platform ${this.platform} not specifically supported`);
            }
        } catch (error) {
            console.warn('[DesktopCapture] Platform handler setup failed:', error.message);
        }
    }

    /**
     * Setup Windows display media handler for loopback audio
     */
    async _setupWindowsDisplayMediaHandler() {
        try {
            if (this.displayMediaHandlerSetup) {
                return;
            }
            
            console.log('[DesktopCapture] Setting up Windows display media handler...');
            
            // Setup native loopback audio capture for Windows
            session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
                console.log('[DesktopCapture] Display media request received');
                
                desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                    if (sources.length > 0) {
                        // Grant access to the first screen found with loopback audio
                        callback({ 
                            video: sources[0], 
                            audio: 'loopback' 
                        });
                        console.log('[DesktopCapture] Display media access granted');
                    } else {
                        callback({ video: null, audio: null });
                        console.warn('[DesktopCapture] No screen sources available for display media');
                    }
                }).catch((error) => {
                    console.error('[DesktopCapture] Display media handler error:', error);
                    callback({ video: null, audio: null });
                });
            });
            
            this.displayMediaHandlerSetup = true;
            console.log('[DesktopCapture] ✅ Windows display media handler setup complete');
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Windows display media handler setup failed:', error);
            throw error;
        }
    }

    /**
     * Setup macOS-specific handlers
     */
    async _setupMacOSHandlers() {
        try {
            console.log('[DesktopCapture] Setting up macOS handlers...');
            
            // Check screen recording permission
            const hasPermission = await permissionService.hasPermission('screen');
            if (!hasPermission) {
                console.warn('[DesktopCapture] ⚠️ Screen recording permission not granted on macOS');
            }
            
            console.log('[DesktopCapture] ✅ macOS handlers setup complete');
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ macOS handlers setup failed:', error);
            throw error;
        }
    }

    /**
     * Setup Linux-specific handlers
     */
    async _setupLinuxHandlers() {
        try {
            console.log('[DesktopCapture] Setting up Linux handlers...');
            
            // Linux typically doesn't require special setup
            console.log('[DesktopCapture] ✅ Linux handlers setup complete');
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Linux handlers setup failed:', error);
            throw error;
        }
    }

    /**
     * Refresh available screen sources
     */
    async _refreshAvailableSources() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: this.config.thumbnailSize,
                fetchWindowIcons: true
            });
            
            this.captureState.availableSources = sources;
            this.captureState.primarySource = sources.find(s => s.name.includes('Screen')) || sources[0];
            
            console.log(`[DesktopCapture] Found ${sources.length} available sources`);
            
        } catch (error) {
            console.error('[DesktopCapture] Error refreshing sources:', error);
            this.captureState.availableSources = [];
            this.captureState.primarySource = null;
        }
    }

    /**
     * Capture screenshot of the current screen
     */
    async captureScreenshot(options = {}) {
        try {
            const startTime = Date.now();
            
            // Check screen recording permission
            const hasPermission = await permissionService.hasPermission('screen');
            if (!hasPermission) {
                throw new Error('Screen recording permission not granted');
            }
            
            // Merge configuration
            const config = {
                ...this.config,
                ...options
            };
            
            console.log('[DesktopCapture] Capturing screenshot...');
            
            // Get available sources
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: config.maxWidth,
                    height: config.maxHeight
                }
            });

            if (sources.length === 0) {
                throw new Error('No screen sources available');
            }
            
            // Select source (primary screen or specified)
            const source = options.sourceId ? 
                sources.find(s => s.id === options.sourceId) : 
                sources[0];
                
            if (!source) {
                throw new Error(`Screen source not found: ${options.sourceId}`);
            }
            
            // Capture screenshot with error handling
            if (!source.thumbnail) {
                throw new Error('Source thumbnail not available');
            }
            
            // Use quality from options or default
            const quality = config.quality || config.compression.jpeg || 70;
            const buffer = source.thumbnail.toJPEG(quality);
            const base64 = buffer.toString('base64');
            const size = source.thumbnail.getSize();
            
            // Update metrics
            const captureTime = Date.now() - startTime;
            this._updateMetrics(captureTime, buffer.length);
            
            // Update capture state
            this.captureState.lastCapture = {
                timestamp: Date.now(),
                source: source.name,
                size: size,
                dataSize: buffer.length,
                base64: base64
            };
            
            const result = {
                success: true,
                base64,
                width: size.width,
                height: size.height,
                source: {
                    id: source.id,
                    name: source.name
                },
                metadata: {
                    captureTime,
                    dataSize: buffer.length,
                    quality: quality,
                    timestamp: Date.now()
                }
            };
            
            console.log(`[DesktopCapture] ✅ Screenshot captured (${size.width}x${size.height}, ${captureTime}ms)`);
            this.emit('screenshotCaptured', result);
            
            return result;
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Screenshot capture failed:', error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
            this.emit('error', error);
            
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Get available screen sources
     */
    async getAvailableSources(options = {}) {
        try {
            console.log('[DesktopCapture] Getting available sources...');
            
            const sources = await desktopCapturer.getSources({
                types: options.types || ['screen', 'window'],
                thumbnailSize: options.thumbnailSize || this.config.thumbnailSize,
                fetchWindowIcons: options.fetchWindowIcons !== false
            });
            
            const formattedSources = sources.map(source => ({
                id: source.id,
                name: source.name,
                type: source.name.includes('Screen') ? 'screen' : 'window',
                thumbnail: source.thumbnail.toDataURL(),
                display_id: source.display_id,
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null
            }));
            
            // Update state
            this.captureState.availableSources = sources;
            this.captureState.primarySource = sources.find(s => s.name.includes('Screen')) || sources[0];
            
            console.log(`[DesktopCapture] Found ${formattedSources.length} sources`);
            
            return {
                success: true,
                sources: formattedSources,
                primarySource: this.captureState.primarySource ? {
                    id: this.captureState.primarySource.id,
                    name: this.captureState.primarySource.name
                } : null
            };
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Get sources failed:', error);
            return {
                success: false,
                error: error.message,
                sources: []
            };
        }
    }

    /**
     * Capture specific screen source
     */
    async captureSource(sourceId, options = {}) {
        try {
            console.log(`[DesktopCapture] Capturing source: ${sourceId}`);
            
            // Get available sources
            const sourcesResult = await this.getAvailableSources();
            if (!sourcesResult.success) {
                throw new Error('Failed to get available sources');
            }
            
            const source = sourcesResult.sources.find(s => s.id === sourceId);
            if (!source) {
                throw new Error(`Source not found: ${sourceId}`);
            }
            
            // Capture with specific source
            return await this.captureScreenshot({
                ...options,
                sourceId: sourceId
            });
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Source capture failed:', error);
            return {
                success: false,
                error: error.message,
                sourceId
            };
        }
    }

    /**
     * Setup display media handler (Windows)
     */
    async setupDisplayMediaHandler() {
        try {
            if (this.platform !== 'win32') {
                return {
                    success: false,
                    error: 'Display media handler only supported on Windows'
                };
            }
            
            await this._setupWindowsDisplayMediaHandler();
            
            return {
                success: true,
                message: 'Display media handler setup complete'
            };
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Display media handler setup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update capture metrics
     */
    _updateMetrics(captureTime, dataSize) {
        this.metrics.capturesPerformed++;
        this.metrics.totalCaptureTime += captureTime;
        this.metrics.averageCaptureTime = this.metrics.totalCaptureTime / this.metrics.capturesPerformed;
        this.metrics.lastCaptureTime = captureTime;
        this.captureState.captureCount++;
        this.captureState.totalSize += dataSize;
    }

    /**
     * Get capture metrics
     */
    getCaptureMetrics() {
        return {
            ...this.metrics,
            captureState: {
                ...this.captureState,
                lastCapture: this.captureState.lastCapture ? {
                    timestamp: this.captureState.lastCapture.timestamp,
                    source: this.captureState.lastCapture.source,
                    size: this.captureState.lastCapture.size,
                    dataSize: this.captureState.lastCapture.dataSize
                } : null
            },
            config: this.config,
            platform: this.platform,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Update capture configuration
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        
        console.log('[DesktopCapture] Configuration updated:', this.config);
        this.emit('configUpdated', this.config);
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            capturesPerformed: 0,
            totalCaptureTime: 0,
            averageCaptureTime: 0,
            lastCaptureTime: 0,
            errors: 0,
            lastError: null
        };
        
        this.captureState.captureCount = 0;
        this.captureState.totalSize = 0;
        
        console.log('[DesktopCapture] Metrics reset');
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            platform: this.platform,
            displayMediaHandlerSetup: this.displayMediaHandlerSetup,
            availableSourcesCount: this.captureState.availableSources.length,
            hasPrimarySource: !!this.captureState.primarySource,
            lastCapture: this.captureState.lastCapture ? {
                timestamp: this.captureState.lastCapture.timestamp,
                source: this.captureState.lastCapture.source
            } : null,
            metrics: this.metrics
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('[DesktopCapture] Cleaning up...');
            
            // Remove display media handler if set up
            if (this.displayMediaHandlerSetup && this.platform === 'win32') {
                try {
                    session.defaultSession.setDisplayMediaRequestHandler(null);
                } catch (error) {
                    console.warn('[DesktopCapture] Error removing display media handler:', error.message);
                }
            }
            
            // Clear state
            this.captureState = {
                lastCapture: null,
                availableSources: [],
                primarySource: null,
                captureCount: 0,
                totalSize: 0
            };
            
            // Remove all listeners
            this.removeAllListeners();
            
            // Reset state
            this.isInitialized = false;
            this.displayMediaHandlerSetup = false;
            
            console.log('[DesktopCapture] ✅ Cleanup complete');
            
        } catch (error) {
            console.error('[DesktopCapture] ❌ Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new DesktopCaptureService();
