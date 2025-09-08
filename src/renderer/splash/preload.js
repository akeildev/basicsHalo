const { contextBridge, ipcRenderer } = require('electron');

console.log('[Splash Preload] Loading splash preload script...');

// Expose protected methods for splash screen
contextBridge.exposeInMainWorld('electronAPI', {
    // Tell main process user clicked next
    goNext: () => {
        console.log('[Splash Preload] Sending splash:next to main process');
        ipcRenderer.send('splash:next');
    },
    
    // Auto-advance after animation (optional)
    autoAdvance: () => {
        console.log('[Splash Preload] Sending splash:auto-advance to main process');
        ipcRenderer.send('splash:auto-advance');
    },
    
    // Receive initialization progress from main process
    onProgress: (callback) => {
        ipcRenderer.on('splash:progress', (event, data) => {
            callback(data);
        });
    },
    
    // Remove listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

console.log('[Splash Preload] Splash preload script loaded successfully');