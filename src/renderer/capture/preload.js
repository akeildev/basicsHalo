const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Listen for ready event from renderer
window.addEventListener('captureReady', () => {
    console.log('[Capture Preload] Received captureReady event');
    console.log('[Capture Preload] Controller available after ready event:', !!window.__captureController);
    // If controller just became available, mark the window as ready for main
    try {
        ipcRenderer.send('capture:status', { ready: true, controller: !!window.__captureController });
    } catch (e) {}
});

// Expose capture API to renderer
contextBridge.exposeInMainWorld('captureAPI', {
    // Get available sources
    getSources: async () => {
        try {
            const sources = await desktopCapturer.getSources({ 
                types: ['screen', 'window'] 
            });
            return sources.map(s => ({
                id: s.id,
                name: s.name,
                thumbnail: s.thumbnail.toDataURL()
            }));
        } catch (error) {
            console.error('[Capture Preload] Error getting sources:', error);
            return [];
        }
    },
    
    // Send audio data to main process
    sendAudioData: (type, data) => {
        ipcRenderer.send('capture:audio-data', { type, data });
    },
    
    // Send status updates
    sendStatus: (status) => {
        ipcRenderer.send('capture:status', status);
    },
    
    // Send errors
    sendError: (error) => {
        ipcRenderer.send('capture:error', error);
    }
});

// Handle capture control from main process
ipcRenderer.on('capture:start', async (event, responseChannel, options) => {
    console.log('[Capture Preload] Start capture requested:', options);

    try {
        // Enhanced controller availability check with retry logic
        const maxRetries = 10;
        const retryDelay = 200;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (window.__captureController) {
                console.log(`[Capture Preload] Controller available (attempt ${attempt + 1}), starting capture`);
                try {
                    const result = await window.__captureController.start(options);

                    // Ensure result is serializable before sending
                    let serializableResult;
                    try {
                        JSON.stringify(result);
                        serializableResult = result;
                        console.log('[Capture Preload] Controller result is serializable');
                    } catch (error) {
                        console.error('[Capture Preload] Controller result is NOT serializable:', error);
                        // Create safe fallback
                        serializableResult = {
                            success: true,
                            results: { screen: false, microphone: false }
                        };
                    }

                    ipcRenderer.send(responseChannel, { success: true, data: serializableResult });
                    return; // Success, exit the function
                } catch (error) {
                    console.error('[Capture Preload] Start capture error:', error);
                    ipcRenderer.send(responseChannel, { success: false, error: error.message });
                    return; // Error occurred, exit the function
                }
            }

            console.log(`[Capture Preload] Controller not available (attempt ${attempt + 1}/${maxRetries}), waiting...`);

            // Wait before next attempt (except on last attempt)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // If we get here, controller was never available
        console.error('[Capture Preload] Controller never became available after all retries');
        ipcRenderer.send(responseChannel, { success: false, error: 'Capture controller not available after retries' });

    } catch (error) {
        console.error('[Capture Preload] Start capture error:', error);
        ipcRenderer.send(responseChannel, { success: false, error: error.message });
    }
});

ipcRenderer.on('capture:stop', async (event, responseChannel) => {
    console.log('[Capture Preload] Stop capture requested');

    try {
        // Enhanced controller availability check with retry logic
        const maxRetries = 10;
        const retryDelay = 200;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (window.__captureController) {
                console.log(`[Capture Preload] Controller available (attempt ${attempt + 1}), stopping capture`);
                try {
                    const result = await window.__captureController.stop();

                    // Ensure result is serializable before sending
                    let serializableResult;
                    try {
                        JSON.stringify(result);
                        serializableResult = result;
                        console.log('[Capture Preload] Stop result is serializable');
                    } catch (error) {
                        console.error('[Capture Preload] Stop result is NOT serializable:', error);
                        // Create safe fallback
                        serializableResult = { success: true };
                    }

                    ipcRenderer.send(responseChannel, { success: true, data: serializableResult });
                    return; // Success, exit the function
                } catch (error) {
                    console.error('[Capture Preload] Stop capture error:', error);
                    ipcRenderer.send(responseChannel, { success: false, error: error.message });
                    return; // Error occurred, exit the function
                }
            }

            console.log(`[Capture Preload] Controller not available (attempt ${attempt + 1}/${maxRetries}), waiting...`);

            // Wait before next attempt (except on last attempt)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // If we get here, controller was never available
        console.error('[Capture Preload] Controller never became available after all retries');
        ipcRenderer.send(responseChannel, { success: false, error: 'Capture controller not available after retries' });

    } catch (error) {
        console.error('[Capture Preload] Stop capture error:', error);
        ipcRenderer.send(responseChannel, { success: false, error: error.message });
    }
});

ipcRenderer.on('capture:status', async (event, responseChannel) => {
    try {
        if (window.__captureController) {
            const status = await window.__captureController.getStatus();

            // Ensure status is serializable before sending
            let serializableStatus;
            try {
                JSON.stringify(status);
                serializableStatus = status;
                console.log('[Capture Preload] Status is serializable');
            } catch (error) {
                console.error('[Capture Preload] Status is NOT serializable:', error);
                // Create safe fallback
                serializableStatus = { microphone: false, screen: false };
            }

            ipcRenderer.send(responseChannel, { success: true, data: serializableStatus });
        } else {
            ipcRenderer.send(responseChannel, {
                success: true,
                data: { microphone: false, screen: false }
            });
        }
    } catch (error) {
        console.error('[Capture Preload] Status error:', error);
        ipcRenderer.send(responseChannel, { success: false, error: error.message });
    }
});

console.log('[Capture Preload] Preload script loaded');