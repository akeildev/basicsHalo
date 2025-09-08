const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Loading preload script for Header window...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // IPC invoke methods
    invoke: (channel, ...args) => {
        console.log('[Preload] Invoking channel:', channel, 'with args:', args);
        return ipcRenderer.invoke(channel, ...args);
    },
    
    // IPC on methods (for receiving messages)
    on: (channel, callback) => {
        console.log('[Preload] Setting up listener for channel:', channel);
        ipcRenderer.on(channel, callback);
    },
    
    // Remove listeners
    removeAllListeners: (channel) => {
        console.log('[Preload] Removing all listeners for channel:', channel);
        ipcRenderer.removeAllListeners(channel);
    },
    
    // Window management specific
    requestWindowVisibility: (data) => {
        console.log('[Preload] Requesting window visibility:', data);
        return ipcRenderer.invoke('window:requestVisibility', data);
    },
    
    // Listening features
    startListening: () => {
        console.log('[Preload] Starting listening...');
        return ipcRenderer.invoke('listen:start');
    },
    stopListening: () => {
        console.log('[Preload] Stopping listening...');
        return ipcRenderer.invoke('listen:stop');
    },

    // Bridge messaging utilities
    relayToWindow: ({ target, channel, data }) => {
        console.log('[Preload] Relaying to window:', { target, channel, data });
        ipcRenderer.send('relay:to-window', { target, channel, data });
    },
    broadcast: (channel, data) => {
        console.log('[Preload] Broadcasting:', channel, data);
        ipcRenderer.send('broadcast', { channel, data });
    },

    // Shared state helpers
    getState: async (key) => {
        const value = await ipcRenderer.invoke('state:get', key);
        return value;
    },
    setState: async (key, value) => {
        return ipcRenderer.invoke('state:set', { key, value });
    }
});

console.log('[Preload] Preload script loaded successfully');
