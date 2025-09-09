const { contextBridge, ipcRenderer } = require('electron');

console.log('[Settings Preload] Loading preload script for Settings window...');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    quitApplication: () => ipcRenderer.invoke('app:quit'),

    // Settings functionality
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
    getApiKey: (provider) => ipcRenderer.invoke('settings:getApiKey', provider),
    setApiKey: (provider, key) => ipcRenderer.invoke('settings:setApiKey', provider, key),

    // Model management
    getAvailableModels: () => ipcRenderer.invoke('settings:getAvailableModels'),
    setCurrentModel: (model) => ipcRenderer.invoke('settings:setCurrentModel', model),
    getCurrentModel: () => ipcRenderer.invoke('settings:getCurrentModel'),

    // Ollama integration
    getOllamaModels: () => ipcRenderer.invoke('settings:getOllamaModels'),
    pullOllamaModel: (modelName) => ipcRenderer.invoke('settings:pullOllamaModel', modelName),

    // Events
    onSettingsUpdate: (callback) => ipcRenderer.on('settings:update', callback),
    onApiKeyUpdate: (callback) => ipcRenderer.on('settings:apikey:update', callback),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

console.log('[Settings Preload] Preload script loaded successfully');
