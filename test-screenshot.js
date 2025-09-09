// Test file to verify screenshot capture functionality
const { ipcRenderer } = require('electron');

console.log('Testing screenshot capture...');

// Test direct IPC call
async function testScreenshot() {
    try {
        console.log('Attempting to capture screenshot via IPC...');
        const result = await ipcRenderer.invoke('ask:captureScreenshot', {
            quality: 80,
            maxWidth: 1920,  
            maxHeight: 1080
        });
        
        console.log('Screenshot result:', result);
        
        if (result && result.success) {
            console.log('✅ Screenshot captured successfully!');
            console.log('Screenshot data length:', result.screenshot ? result.screenshot.length : 0);
        } else {
            console.error('❌ Failed to capture screenshot:', result ? result.error : 'No result');
        }
    } catch (error) {
        console.error('❌ Error capturing screenshot:', error);
    }
}

// Run test after a short delay
setTimeout(testScreenshot, 2000);

console.log('Test script loaded. Will attempt screenshot in 2 seconds...');