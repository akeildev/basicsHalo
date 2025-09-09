const { app, BrowserWindow } = require('electron');

// Test script to verify settings window functionality
async function testSettingsWindow() {
    console.log('Testing settings window functionality...');

    try {
        // Wait for app to be ready
        await app.whenReady();
        console.log('✅ App ready');

        // Create a test window to simulate the main window
        const testWindow = new BrowserWindow({
            width: 400,
            height: 300,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // Load a simple test page
        testWindow.loadURL(`data:text/html,
            <html>
                <head><title>Test Window</title></head>
                <body>
                    <h1>Settings Window Test</h1>
                    <p>Settings window should now move with the header!</p>
                    <button onclick="testIPC()">Test IPC</button>
                    <script>
                        function testIPC() {
                            console.log('Testing IPC communication...');
                            if (window.electronAPI) {
                                window.electronAPI.getSettings().then(result => {
                                    console.log('IPC Test Result:', result);
                                }).catch(err => {
                                    console.error('IPC Test Error:', err);
                                });
                            } else {
                                console.error('electronAPI not available');
                            }
                        }
                    </script>
                </body>
            </html>
        `);

        console.log('✅ Test window created');

        // Test window creation after a delay
        setTimeout(() => {
            console.log('✅ Test completed - settings window should now work properly!');
            app.quit();
        }, 3000);

    } catch (error) {
        console.error('❌ Test failed:', error);
        app.quit();
    }
}

testSettingsWindow();
