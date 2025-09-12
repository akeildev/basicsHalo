# Stage 2: Window Management System

## Goal
Add a sophisticated window management system that can handle multiple windows with a window pool.

## What We're Building
- Window Manager module to create and manage windows
- Window Pool to track all windows
- Ability to create different types of windows
- Window positioning and state management

## Step 1: Create Window Manager Module

Create `src/window/windowManager.js`:

```javascript
const { BrowserWindow, screen } = require('electron');
const path = require('path');

// Window pool to keep track of all windows
const windowPool = new Map();

// Window configurations
const windowConfigs = {
  main: {
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    title: 'Halo Desktop Assistant',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  },
  header: {
    width: 300,
    height: 60,
    minWidth: 200,
    minHeight: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  },
  popup: {
    width: 400,
    height: 500,
    minWidth: 300,
    minHeight: 400,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  }
};

/**
 * Create a new window with the specified configuration
 * @param {string} name - The name/identifier for the window
 * @param {string} type - The type of window configuration to use
 * @param {object} customConfig - Optional custom configuration to override defaults
 * @returns {BrowserWindow} The created window
 */
function createWindow(name, type = 'main', customConfig = {}) {
  console.log(`[WindowManager] Creating window: ${name} (type: ${type})`);
  
  // Check if window already exists
  if (windowPool.has(name)) {
    console.log(`[WindowManager] Window ${name} already exists, focusing it`);
    const existingWindow = windowPool.get(name);
    if (!existingWindow.isDestroyed()) {
      existingWindow.focus();
      return existingWindow;
    }
    // Window was destroyed, remove from pool
    windowPool.delete(name);
  }
  
  // Get base configuration
  const baseConfig = windowConfigs[type] || windowConfigs.main;
  const config = { ...baseConfig, ...customConfig };
  
  // Create the window
  const window = new BrowserWindow(config);
  
  // Add to window pool
  windowPool.set(name, window);
  
  // Handle window closed event
  window.on('closed', () => {
    console.log(`[WindowManager] Window ${name} closed`);
    windowPool.delete(name);
  });
  
  // Load content
  const htmlFile = customConfig.htmlFile || 'index.html';
  window.loadFile(path.join(__dirname, '..', htmlFile));
  
  console.log(`[WindowManager] Window ${name} created successfully`);
  return window;
}

/**
 * Get a window by name
 * @param {string} name - The name of the window
 * @returns {BrowserWindow|null} The window or null if not found
 */
function getWindow(name) {
  const window = windowPool.get(name);
  if (window && !window.isDestroyed()) {
    return window;
  }
  return null;
}

/**
 * Close a window by name
 * @param {string} name - The name of the window to close
 */
function closeWindow(name) {
  const window = windowPool.get(name);
  if (window && !window.isDestroyed()) {
    console.log(`[WindowManager] Closing window: ${name}`);
    window.close();
  }
}

/**
 * Close all windows
 */
function closeAllWindows() {
  console.log('[WindowManager] Closing all windows');
  windowPool.forEach((window, name) => {
    if (!window.isDestroyed()) {
      console.log(`[WindowManager] Closing window: ${name}`);
      window.close();
    }
  });
  windowPool.clear();
}

/**
 * Get all windows
 * @returns {Map} The window pool
 */
function getAllWindows() {
  return windowPool;
}

/**
 * Position a window relative to screen
 * @param {BrowserWindow} window - The window to position
 * @param {string} position - Position preset (center, top-right, etc.)
 */
function positionWindow(window, position = 'center') {
  if (!window || window.isDestroyed()) return;
  
  const { width, height } = window.getBounds();
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const { x: workAreaX, y: workAreaY } = display.workArea;
  
  let x, y;
  
  switch (position) {
    case 'center':
      x = workAreaX + Math.round((screenWidth - width) / 2);
      y = workAreaY + Math.round((screenHeight - height) / 2);
      break;
    case 'top-right':
      x = workAreaX + screenWidth - width - 20;
      y = workAreaY + 20;
      break;
    case 'top-left':
      x = workAreaX + 20;
      y = workAreaY + 20;
      break;
    case 'bottom-right':
      x = workAreaX + screenWidth - width - 20;
      y = workAreaY + screenHeight - height - 20;
      break;
    case 'bottom-left':
      x = workAreaX + 20;
      y = workAreaY + screenHeight - height - 20;
      break;
    default:
      // Use provided position as {x, y} object
      if (typeof position === 'object' && position.x !== undefined && position.y !== undefined) {
        x = position.x;
        y = position.y;
      } else {
        // Default to center
        x = workAreaX + Math.round((screenWidth - width) / 2);
        y = workAreaY + Math.round((screenHeight - height) / 2);
      }
  }
  
  window.setPosition(x, y);
  console.log(`[WindowManager] Positioned window at ${x}, ${y}`);
}

/**
 * Create multiple windows at once
 * @param {Array} windowSpecs - Array of window specifications [{name, type, config, position}]
 */
function createWindows(windowSpecs) {
  console.log(`[WindowManager] Creating ${windowSpecs.length} windows`);
  const windows = [];
  
  windowSpecs.forEach(spec => {
    const window = createWindow(spec.name, spec.type, spec.config || {});
    if (spec.position) {
      positionWindow(window, spec.position);
    }
    windows.push(window);
  });
  
  return windows;
}

module.exports = {
  createWindow,
  getWindow,
  closeWindow,
  closeAllWindows,
  getAllWindows,
  positionWindow,
  createWindows,
  windowPool,
  windowConfigs
};
```

## Step 2: Update Main Process to Use Window Manager

Update `src/index.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const windowManager = require('./window/windowManager');

// Keep a global reference to prevent garbage collection
global.windowManager = windowManager;

function initializeApp() {
  console.log('[Main] Initializing application...');
  
  // Create main window
  const mainWindow = windowManager.createWindow('main', 'main', {
    htmlFile: 'index.html'
  });
  
  // Position it in the center
  windowManager.positionWindow(mainWindow, 'center');
  
  // Create a header window (frameless, always on top)
  setTimeout(() => {
    const headerWindow = windowManager.createWindow('header', 'header', {
      htmlFile: 'header.html'
    });
    windowManager.positionWindow(headerWindow, 'top-right');
  }, 1000);
  
  console.log('[Main] Application initialized');
}

app.whenReady().then(() => {
  console.log('[Main] App is ready');
  initializeApp();

  app.on('activate', () => {
    // On macOS, re-create windows when dock icon is clicked
    if (windowManager.getAllWindows().size === 0) {
      initializeApp();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[Main] App is quitting...');
  windowManager.closeAllWindows();
});

console.log('[Main] Halo Desktop Assistant starting...');
```

## Step 3: Create Header Window HTML

Create `src/header.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Halo Header</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      color: white;
      height: 60px;
      display: flex;
      align-items: center;
      padding: 0 15px;
      border-radius: 10px;
      user-select: none;
      -webkit-app-region: drag; /* Make window draggable */
      overflow: hidden;
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    
    .logo {
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .controls {
      display: flex;
      gap: 10px;
      -webkit-app-region: no-drag; /* Make buttons clickable */
    }
    
    .control-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 16px;
    }
    
    .control-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }
    
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="header-content">
    <div class="logo">
      <div class="status-indicator"></div>
      <span>Halo</span>
    </div>
    <div class="controls">
      <button class="control-btn" onclick="toggleWindow('settings')" title="Settings">⚙️</button>
      <button class="control-btn" onclick="toggleWindow('ask')" title="Ask">💬</button>
      <button class="control-btn" onclick="toggleWindow('listen')" title="Listen">🎤</button>
    </div>
  </div>

  <script>
    // Placeholder functions - will be connected in Stage 5 (IPC)
    function toggleWindow(windowName) {
      console.log(`Toggle window: ${windowName}`);
      // IPC communication will be added in Stage 5
    }
    
    console.log('Header window loaded - Stage 2');
  </script>
</body>
</html>
```

## Step 4: Update Package Structure

Create the window directory:
```bash
mkdir -p src/window
```

## Step 5: Test the Application

```bash
npm start
```

## ✅ Success Criteria

You should see:
1. Main window opens (same as Stage 1)
2. After 1 second, a small header window appears in top-right
3. Header window is draggable
4. Header has control buttons (not functional yet)
5. Console shows window management logs

## 🎯 What We Accomplished

- ✅ Window Manager module with pool tracking
- ✅ Multiple window type configurations
- ✅ Window positioning system
- ✅ Frameless window support
- ✅ Always-on-top windows
- ✅ Draggable windows
- ✅ Window lifecycle management

## 📁 Updated File Structure

```
halo-rebuild/
├── package.json
├── node_modules/
└── src/
    ├── index.js          # Updated main process
    ├── preload.js        # Unchanged from Stage 1
    ├── index.html        # Unchanged from Stage 1
    ├── header.html       # New header window
    └── window/
        └── windowManager.js  # New window management module
```

## 🐛 Troubleshooting

If windows don't appear correctly:
1. Check console for error messages
2. Verify file paths are correct
3. On macOS, grant screen recording permissions if prompted
4. Try adjusting window positions if off-screen

## 📝 Key Concepts Introduced

1. **Window Pool**: Map structure tracking all windows
2. **Window Configurations**: Reusable window templates
3. **Frameless Windows**: Custom UI without OS chrome
4. **Always on Top**: Windows that stay above others
5. **App Region Drag**: Making custom windows draggable
6. **Window Positioning**: Smart placement on screen

## 🚀 Next Stage

Ready for Stage 3? We'll add:
- Professional splash screen
- Loading states
- Splash service
- Startup sequence

Continue to `STAGE-03-SPLASH-SCREEN.md` when ready!

---

**Progress Update**: We now have a multi-window system! The foundation is getting stronger. Each window can be managed independently, setting us up perfectly for the feature-rich stages ahead.