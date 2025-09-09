const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    showWindow: (windowName) => ipcRenderer.invoke('window:show', windowName),
    hideWindow: (windowName) => ipcRenderer.invoke('window:hide', windowName),
    
    // Listen functionality
    startListening: (options) => ipcRenderer.invoke('listen:start', options),
    stopListening: () => ipcRenderer.invoke('listen:stop'),
    getListeningStatus: () => ipcRenderer.invoke('listen:getStatus'),
    startTranscription: () => ipcRenderer.invoke('listen:startTranscription'),
    stopTranscription: () => ipcRenderer.invoke('listen:stopTranscription'),
    getMetrics: () => ipcRenderer.invoke('listen:getMetrics'),
    
    // Screen capture
    getScreenSources: (options) => ipcRenderer.invoke('screen:getSources', options),
    startScreenCapture: (sourceId, options) => ipcRenderer.invoke('screen:startCapture', sourceId, options),
    stopScreenCapture: () => ipcRenderer.invoke('screen:stopCapture'),
    
    // Permissions
    checkPermission: (permissionType) => ipcRenderer.invoke('permissions:check', permissionType),
    requestPermission: (permissionType) => ipcRenderer.invoke('permissions:request', permissionType),
    getAllPermissions: () => ipcRenderer.invoke('permissions:getAll'),
    requestAllPermissions: () => ipcRenderer.invoke('permissions:requestAll'),
    
    // Audio processing
    getAudioConfig: () => ipcRenderer.invoke('audio:getConfig'),
    updateAudioConfig: (config) => ipcRenderer.invoke('audio:updateConfig', config),
    getAudioMetrics: () => ipcRenderer.invoke('audio:getMetrics'),
    resetAudioProcessor: () => ipcRenderer.invoke('audio:reset'),
    updateEchoCancellation: (config) => ipcRenderer.invoke('audio:updateEchoCancellation', config),
    
    // Events
    onTranscriptionUpdate: (callback) => ipcRenderer.on('transcription:update', callback),
    onAudioLevelUpdate: (callback) => ipcRenderer.on('audio:levelUpdate', callback),
    onListeningStatusChange: (callback) => ipcRenderer.on('listening:statusChange', callback),
    onListenStatusUpdate: (callback) => ipcRenderer.on('listen:statusUpdate', callback),
    onListenTranscriptionComplete: (callback) => ipcRenderer.on('listen:transcriptionComplete', callback),
    onListenError: (callback) => ipcRenderer.on('listen:error', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
