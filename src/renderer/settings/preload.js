const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    
    // Settings functionality
    getSettings: () => ipcRenderer.invoke('feature:getSettings'),
    updateSettings: (settings) => ipcRenderer.invoke('feature:updateSettings', settings),
    getApiKey: (provider) => ipcRenderer.invoke('feature:getApiKey', provider),
    setApiKey: (provider, key) => ipcRenderer.invoke('feature:setApiKey', provider, key),
    
    // Model management
    getAvailableModels: () => ipcRenderer.invoke('feature:getAvailableModels'),
    setCurrentModel: (model) => ipcRenderer.invoke('feature:setCurrentModel', model),
    getCurrentModel: () => ipcRenderer.invoke('feature:getCurrentModel'),
    
    // Ollama integration
    getOllamaModels: () => ipcRenderer.invoke('feature:getOllamaModels'),
    pullOllamaModel: (modelName) => ipcRenderer.invoke('feature:pullOllamaModel', modelName),
    
    // Events
    onSettingsUpdate: (callback) => ipcRenderer.on('settings:update', callback),
    onApiKeyUpdate: (callback) => ipcRenderer.on('apikey:update', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
