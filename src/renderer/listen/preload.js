const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    
    // Listen functionality
    startListening: () => ipcRenderer.invoke('feature:startListening'),
    stopListening: () => ipcRenderer.invoke('feature:stopListening'),
    getListeningStatus: () => ipcRenderer.invoke('feature:getListeningStatus'),
    
    // Events
    onTranscriptionUpdate: (callback) => ipcRenderer.on('transcription:update', callback),
    onAudioLevelUpdate: (callback) => ipcRenderer.on('audio:levelUpdate', callback),
    onListeningStatusChange: (callback) => ipcRenderer.on('listening:statusChange', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
