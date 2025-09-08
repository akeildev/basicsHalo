const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    
    // Ask functionality
    askQuestion: (question) => ipcRenderer.invoke('feature:askQuestion', question),
    getAvailableModels: () => ipcRenderer.invoke('feature:getAvailableModels'),
    setCurrentModel: (model) => ipcRenderer.invoke('feature:setCurrentModel', model),
    getCurrentModel: () => ipcRenderer.invoke('feature:getCurrentModel'),
    
    // Chat history
    getChatHistory: () => ipcRenderer.invoke('feature:getChatHistory'),
    clearChatHistory: () => ipcRenderer.invoke('feature:clearChatHistory'),
    
    // Events
    onAnswerUpdate: (callback) => ipcRenderer.on('answer:update', callback),
    onModelChange: (callback) => ipcRenderer.on('model:change', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
