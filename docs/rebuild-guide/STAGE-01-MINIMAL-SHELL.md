# Stage 1: Minimal Electron Shell

## Goal
Create the absolute minimum Electron application that runs and shows a window.

## What We're Building
- Basic Electron app structure
- Main process that creates a window
- Simple HTML page
- Package.json with minimal dependencies

## Step 1: Create Project Directory

```bash
mkdir halo-rebuild
cd halo-rebuild
```

## Step 2: Create package.json

Create `package.json`:

```json
{
  "name": "halo",
  "version": "0.1.0",
  "description": "Halo Desktop Assistant",
  "main": "src/index.js",
  "scripts": {
    "start": "electron ."
  },
  "keywords": [],
  "author": "Pickle Team",
  "license": "GPL-3.0",
  "devDependencies": {
    "electron": "^30.5.1"
  }
}
```

## Step 3: Install Electron

```bash
npm install
```

## Step 4: Create Main Process

Create `src/index.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('[Main] Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('[Main] Window created');
}

app.whenReady().then(() => {
  console.log('[Main] App is ready');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Main] Electron app starting...');
```

## Step 5: Create Preload Script

Create `src/preload.js`:

```javascript
const { contextBridge } = require('electron');

console.log('[Preload] Loading preload script...');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

console.log('[Preload] Preload script loaded');
```

## Step 6: Create HTML Page

Create `src/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Halo Desktop Assistant</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    }
    
    h1 {
      font-size: 48px;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    
    p {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    
    .version-info {
      margin-top: 30px;
      padding: 20px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    
    .version-info div {
      margin: 5px 0;
    }
    
    .status {
      margin-top: 20px;
      padding: 10px 20px;
      background: #4CAF50;
      border-radius: 25px;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎉 Halo</h1>
    <p>Desktop Assistant</p>
    <p>Stage 1: Minimal Shell</p>
    
    <div class="status">
      ✅ Running Successfully
    </div>
    
    <div class="version-info">
      <div>Platform: <span id="platform">Loading...</span></div>
      <div>Electron: <span id="electron-version">Loading...</span></div>
      <div>Node: <span id="node-version">Loading...</span></div>
      <div>Chrome: <span id="chrome-version">Loading...</span></div>
    </div>
  </div>

  <script>
    // Display version information
    if (window.electronAPI) {
      document.getElementById('platform').textContent = window.electronAPI.platform;
      document.getElementById('electron-version').textContent = window.electronAPI.versions.electron;
      document.getElementById('node-version').textContent = window.electronAPI.versions.node;
      document.getElementById('chrome-version').textContent = window.electronAPI.versions.chrome;
      
      console.log('Halo Desktop Assistant - Stage 1');
      console.log('Platform:', window.electronAPI.platform);
      console.log('Versions:', window.electronAPI.versions);
    } else {
      console.error('electronAPI not available');
    }
  </script>
</body>
</html>
```

## Step 7: Test the Application

```bash
npm start
```

## ✅ Success Criteria

You should see:
1. A window opens with a purple gradient background
2. "Halo Desktop Assistant" title
3. Green "Running Successfully" status badge
4. Version information displayed
5. Console logs showing the startup sequence

## 🎯 What We Accomplished

- ✅ Basic Electron app structure
- ✅ Main process with window creation
- ✅ Preload script for secure context bridging
- ✅ HTML page with styling
- ✅ Version information display
- ✅ Console logging for debugging

## 📁 Current File Structure

```
halo-rebuild/
├── package.json
├── package-lock.json
├── node_modules/
└── src/
    ├── index.js      # Main process
    ├── preload.js    # Preload script
    └── index.html    # Renderer page
```

## 🐛 Troubleshooting

If the app doesn't start:
1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check for error messages in terminal
4. Verify all files are in correct locations

## 📝 Key Concepts Introduced

1. **Main Process**: Controls the application lifecycle
2. **Renderer Process**: Displays the UI (HTML)
3. **Preload Script**: Safely exposes APIs to renderer
4. **Context Isolation**: Security feature preventing direct Node.js access
5. **Process Communication**: Foundation for IPC (coming in Stage 5)

## 🚀 Next Stage

Ready for Stage 2? We'll add:
- Window management system
- Multiple windows support
- Window pool concept
- Window state tracking

Continue to `STAGE-02-WINDOW-MANAGEMENT.md` when ready!

---

**Remember**: This is our foundation. Every feature we add will build upon this minimal shell. Keep this code - we'll be adding to it, not replacing it!