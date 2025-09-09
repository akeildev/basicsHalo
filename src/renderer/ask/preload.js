const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    getBounds: (name) => ipcRenderer.invoke('window:getBounds', { name }),
    setBounds: (name, bounds) => ipcRenderer.invoke('window:setBounds', { name, bounds }),
    
    // Ask functionality
    askQuestion: (question, options) => ipcRenderer.invoke('ask:question', question, options),
    setModel: (model) => ipcRenderer.invoke('ask:setModel', model),
    getModel: () => ipcRenderer.invoke('ask:getModel'),
    isProcessing: () => ipcRenderer.invoke('ask:isProcessing'),
    
    // Processing history
    getHistory: (limit) => ipcRenderer.invoke('ask:getHistory', limit),
    clearHistory: () => ipcRenderer.invoke('ask:clearHistory'),
    
    // Service status and metrics
    getStatus: () => ipcRenderer.invoke('ask:getStatus'),
    getMetrics: () => ipcRenderer.invoke('ask:getMetrics'),
    
    // Desktop capture functionality
    captureScreenshot: (options) => ipcRenderer.invoke('ask:captureScreenshot', options),
    getSources: (options) => ipcRenderer.invoke('ask:getSources', options),
    setupDisplayMediaHandler: () => ipcRenderer.invoke('ask:setupDisplayMediaHandler'),
    updateCaptureConfig: (config) => ipcRenderer.invoke('ask:updateCaptureConfig', config),
    getCaptureMetrics: () => ipcRenderer.invoke('ask:getCaptureMetrics'),
    resetCaptureMetrics: () => ipcRenderer.invoke('ask:resetCaptureMetrics'),
    
    // Events
    onScreenshotCaptured: (callback) => ipcRenderer.on('ask:screenshotCaptured', callback),
    onError: (callback) => ipcRenderer.on('ask:error', callback),
    onConfigUpdated: (callback) => ipcRenderer.on('ask:configUpdated', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
