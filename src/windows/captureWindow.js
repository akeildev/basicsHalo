const { BrowserWindow } = require('electron');
const path = require('path');

class CaptureWindow {
    constructor() {
        this.window = null;
        this.isReady = false;
    }

    create() {
        if (this.window) {
            console.log('[CaptureWindow] Window already exists');
            return this.window;
        }

        console.log('[CaptureWindow] Creating capture window...');
        
        this.window = new BrowserWindow({
            show: false, // Hidden - capture window should never be visible
            width: 800,
            height: 600,
            webPreferences: {
                preload: path.join(__dirname, '..', 'renderer', 'capture', 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false
            }
        });

        // Load the capture renderer
        const captureHtmlPath = path.join(__dirname, '..', 'renderer', 'capture', 'index.html');
        console.log('[CaptureWindow] Loading HTML from:', captureHtmlPath);
        this.window.loadFile(captureHtmlPath);

        // Handle window ready
        this.window.webContents.once('did-finish-load', () => {
            console.log('[CaptureWindow] Window loaded, waiting for controller initialization...');
            
            // Check for controller availability with retries
            const checkController = async () => {
                for (let i = 0; i < 20; i++) { // Check for up to 4 seconds
                    try {
                        const hasController = await this.window.webContents.executeJavaScript('!!window.__captureController');
                        if (hasController) {
                            this.isReady = true;
                            console.log('[CaptureWindow] ✅ Capture window ready with controller');
                            return;
                        }
                    } catch (error) {
                        console.log('[CaptureWindow] Controller check failed:', error.message);
                    }
                    
                    // Wait 200ms before next check
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Fallback: mark as ready even if controller check failed
                this.isReady = true;
                console.log('[CaptureWindow] ⚠️ Capture window ready (controller check timeout)');
            };
            
            checkController();

            // Open dev tools for debugging (remove in production)
            this.window.webContents.openDevTools({ mode: 'detach' });
        });
        
        // Log any console messages from the renderer
        this.window.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[CaptureWindow Console] ${message}`);
        });

        // Prevent window from being closed
        this.window.on('close', (e) => {
            e.preventDefault();
            console.log('[CaptureWindow] Close prevented - window stays alive');
        });

        // Handle crashes
        this.window.webContents.on('crashed', () => {
            console.error('[CaptureWindow] Renderer crashed! Recreating...');
            this.window = null;
            this.isReady = false;
            this.create();
        });

        return this.window;
    }

    async waitForReady() {
        if (this.isReady) return;
        
        return new Promise((resolve) => {
            const checkReady = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkReady);
                    resolve();
                }
            }, 100);
        });
    }

    async checkControllerAvailable() {
        if (!this.window) {
            return false;
        }
        
        try {
            return await this.window.webContents.executeJavaScript('!!window.__captureController');
        } catch (error) {
            console.log('[CaptureWindow] Controller check failed:', error.message);
            return false;
        }
    }

    async invoke(channel, ...args) {
        if (!this.window) {
            throw new Error('Capture window not created');
        }
        
        await this.waitForReady();
        
        // For stop operations, ensure controller is available
        if (channel === 'capture:stop') {
            const controllerAvailable = await this.checkControllerAvailable();
            if (!controllerAvailable) {
                console.log('[CaptureWindow] Controller not available for stop operation, waiting...');
                // Wait a bit more for controller to become available
                for (let i = 0; i < 10; i++) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    const available = await this.checkControllerAvailable();
                    if (available) {
                        console.log('[CaptureWindow] Controller became available');
                        break;
                    }
                }
            }
        }
        
        return new Promise((resolve, reject) => {
            // Create a unique response channel
            const responseChannel = `${channel}-response-${Date.now()}`;
            
            // Set up one-time listener for response
            const { ipcMain } = require('electron');
            ipcMain.once(responseChannel, (event, result) => {
                if (result.success) {
                    resolve(result.data);
                } else {
                    reject(new Error(result.error || 'Unknown error'));
                }
            });
            
            // Send the request with response channel
            this.window.webContents.send(channel, responseChannel, ...args);
            
            // Timeout after 15 seconds (increased for better reliability)
            setTimeout(() => {
                ipcMain.removeAllListeners(responseChannel);
                reject(new Error(`${channel} timed out`));
            }, 15000);
        });
    }

    send(channel, ...args) {
        if (!this.window) {
            console.error('[CaptureWindow] Window not created');
            return;
        }
        
        this.window.webContents.send(channel, ...args);
    }

    destroy() {
        if (this.window) {
            this.window.removeAllListeners('close');
            this.window.destroy();
            this.window = null;
            this.isReady = false;
            console.log('[CaptureWindow] Window destroyed');
        }
    }
}

module.exports = new CaptureWindow();