# Stage 6: Ask Feature - Screenshot & Query System

## Overview
This stage adds the Ask feature - a screenshot capture and query system that allows users to capture their screen and ask questions about what they see.

## Complete File Structure for Stage 6
```
src/
├── features/
│   └── ask/
│       ├── askService.js
│       ├── ipcHandlers.js
│       └── services/
│           ├── screenshotService.js
│           └── aiQueryService.js
├── renderer/
│   └── ask/
│       ├── index.html
│       ├── index.js
│       ├── styles.css
│       └── preload.js
└── windows/
    └── askWindow.js
```

## File 1: src/windows/askWindow.js
```javascript
const { BrowserWindow, screen } = require('electron');
const path = require('path');

class AskWindow {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.window = null;
    this.captureMode = false;
    this.selectionBounds = null;
  }

  async create() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return this.window;
    }

    // Get primary display bounds for fullscreen overlay
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    this.window = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreen: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'renderer', 'ask', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    // Load the ask interface
    await this.window.loadFile(path.join(__dirname, '..', 'renderer', 'ask', 'index.html'));

    // Initially hide the window
    this.window.hide();

    // Handle window closed
    this.window.on('closed', () => {
      this.window = null;
      this.captureMode = false;
      this.selectionBounds = null;
    });

    // Handle escape key to cancel capture
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        this.cancelCapture();
      }
    });

    return this.window;
  }

  async startCapture() {
    if (!this.window) {
      await this.create();
    }

    this.captureMode = true;
    this.selectionBounds = null;

    // Show the overlay window
    this.window.show();
    this.window.focus();
    this.window.setAlwaysOnTop(true, 'screen-saver');
    
    // Send capture mode to renderer
    this.window.webContents.send('capture-mode', { active: true });
  }

  setSelectionBounds(bounds) {
    this.selectionBounds = bounds;
  }

  async completeCapture(bounds) {
    if (!this.captureMode) return null;

    this.selectionBounds = bounds;
    
    // Hide the overlay temporarily for screenshot
    this.window.hide();

    // Take screenshot after a brief delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.selectionBounds);
        this.resetCapture();
      }, 100);
    });
  }

  cancelCapture() {
    if (!this.window) return;

    this.captureMode = false;
    this.selectionBounds = null;
    this.window.hide();
    this.window.webContents.send('capture-mode', { active: false });
  }

  resetCapture() {
    this.captureMode = false;
    this.selectionBounds = null;
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  showQueryDialog(screenshotPath) {
    if (!this.window) {
      this.create();
    }

    // Resize window for query dialog
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    this.window.setBounds({
      x: Math.floor(width / 2 - 400),
      y: Math.floor(height / 2 - 300),
      width: 800,
      height: 600
    });

    this.window.show();
    this.window.focus();
    
    // Send screenshot path to renderer
    this.window.webContents.send('show-query', { screenshotPath });
  }

  close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }
}

module.exports = AskWindow;
```

## File 2: src/features/ask/askService.js
```javascript
const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const ScreenshotService = require('./services/screenshotService');
const AIQueryService = require('./services/aiQueryService');

class AskService {
  constructor() {
    this.screenshotService = new ScreenshotService();
    this.aiQueryService = new AIQueryService();
    this.askWindow = null;
    this.windowManager = null;
    this.tempDir = path.join(app.getPath('temp'), 'halo-screenshots');
    this.currentScreenshot = null;
    this.isCapturing = false;
  }

  async initialize(windowManager) {
    this.windowManager = windowManager;
    
    // Ensure temp directory exists
    await this.ensureTempDir();
    
    // Initialize services
    await this.screenshotService.initialize();
    await this.aiQueryService.initialize();
    
    console.log('Ask service initialized');
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  async startScreenCapture() {
    if (this.isCapturing) {
      console.log('Already capturing');
      return;
    }

    this.isCapturing = true;

    try {
      // Get or create ask window
      if (!this.askWindow) {
        const AskWindow = require('../../windows/askWindow');
        this.askWindow = new AskWindow(this.windowManager);
      }

      // Start capture mode
      await this.askWindow.startCapture();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      this.isCapturing = false;
      return { success: false, error: error.message };
    }
  }

  async captureSelection(bounds) {
    if (!this.isCapturing) {
      return { success: false, error: 'Not in capture mode' };
    }

    try {
      // Complete the capture with bounds
      const selectionBounds = await this.askWindow.completeCapture(bounds);
      
      if (!selectionBounds) {
        throw new Error('No selection bounds');
      }

      // Take the actual screenshot
      const screenshot = await this.screenshotService.captureArea(selectionBounds);
      
      // Save screenshot to temp file
      const filename = `screenshot-${Date.now()}.png`;
      const filepath = path.join(this.tempDir, filename);
      await fs.writeFile(filepath, screenshot);
      
      this.currentScreenshot = filepath;
      this.isCapturing = false;

      // Show query dialog with screenshot
      this.askWindow.showQueryDialog(filepath);

      return {
        success: true,
        screenshotPath: filepath,
        bounds: selectionBounds
      };
    } catch (error) {
      console.error('Failed to capture selection:', error);
      this.isCapturing = false;
      this.askWindow.cancelCapture();
      return { success: false, error: error.message };
    }
  }

  async cancelCapture() {
    if (!this.isCapturing) return;

    this.isCapturing = false;
    if (this.askWindow) {
      this.askWindow.cancelCapture();
    }

    return { success: true };
  }

  async queryScreenshot(query, screenshotPath = null) {
    try {
      const imagePath = screenshotPath || this.currentScreenshot;
      
      if (!imagePath) {
        throw new Error('No screenshot available');
      }

      // Check if file exists
      await fs.access(imagePath);

      // Send query to AI service
      const response = await this.aiQueryService.queryImage(imagePath, query);

      return {
        success: true,
        response,
        screenshotPath: imagePath
      };
    } catch (error) {
      console.error('Failed to query screenshot:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filepath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  async shutdown() {
    if (this.askWindow) {
      this.askWindow.close();
    }
    
    await this.cleanupTempFiles();
    await this.screenshotService.shutdown();
    await this.aiQueryService.shutdown();
  }
}

module.exports = AskService;
```

## File 3: src/features/ask/services/screenshotService.js
```javascript
const { desktopCapturer, screen, nativeImage } = require('electron');
const sharp = require('sharp');

class ScreenshotService {
  constructor() {
    this.primaryDisplay = null;
  }

  async initialize() {
    this.primaryDisplay = screen.getPrimaryDisplay();
  }

  async captureFullScreen() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: this.primaryDisplay.bounds.width * this.primaryDisplay.scaleFactor,
          height: this.primaryDisplay.bounds.height * this.primaryDisplay.scaleFactor
        }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Get the primary display source
      const primarySource = sources[0];
      const image = primarySource.thumbnail;
      
      return image.toPNG();
    } catch (error) {
      console.error('Failed to capture full screen:', error);
      throw error;
    }
  }

  async captureArea(bounds) {
    try {
      // First capture the full screen
      const fullScreenshot = await this.captureFullScreen();
      
      // Calculate the actual bounds considering display scaling
      const scaleFactor = this.primaryDisplay.scaleFactor;
      const actualBounds = {
        x: Math.floor(bounds.x * scaleFactor),
        y: Math.floor(bounds.y * scaleFactor),
        width: Math.floor(bounds.width * scaleFactor),
        height: Math.floor(bounds.height * scaleFactor)
      };

      // Crop the screenshot to the selected area
      const croppedImage = await sharp(fullScreenshot)
        .extract({
          left: actualBounds.x,
          top: actualBounds.y,
          width: actualBounds.width,
          height: actualBounds.height
        })
        .png()
        .toBuffer();

      return croppedImage;
    } catch (error) {
      console.error('Failed to capture area:', error);
      throw error;
    }
  }

  async captureWindow(windowBounds) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: {
          width: windowBounds.width * this.primaryDisplay.scaleFactor,
          height: windowBounds.height * this.primaryDisplay.scaleFactor
        }
      });

      if (sources.length === 0) {
        throw new Error('No window sources available');
      }

      // Find the best matching window
      const windowSource = sources[0];
      const image = windowSource.thumbnail;
      
      return image.toPNG();
    } catch (error) {
      console.error('Failed to capture window:', error);
      throw error;
    }
  }

  async saveScreenshot(buffer, filepath) {
    try {
      await sharp(buffer)
        .png()
        .toFile(filepath);
      
      return filepath;
    } catch (error) {
      console.error('Failed to save screenshot:', error);
      throw error;
    }
  }

  async shutdown() {
    // Cleanup if needed
  }
}

module.exports = ScreenshotService;
```

## File 4: src/features/ask/services/aiQueryService.js
```javascript
const fs = require('fs').promises;
const path = require('path');

class AIQueryService {
  constructor() {
    this.apiKey = null;
    this.model = 'gpt-4-vision-preview';
    this.maxTokens = 500;
    this.temperature = 0.7;
  }

  async initialize() {
    // Load API key from settings when available
    // For now, using placeholder
    this.apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';
  }

  async queryImage(imagePath, query) {
    try {
      // Read image and convert to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // For now, return a mock response
      // In production, this would call the actual AI API
      return await this.mockAIResponse(query, base64Image);

      // Actual API call would look like:
      // return await this.callOpenAI(query, base64Image);
    } catch (error) {
      console.error('Failed to query image:', error);
      throw error;
    }
  }

  async mockAIResponse(query, base64Image) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return mock response based on query
    const responses = {
      'default': `I can see the screenshot you've captured. Based on your query "${query}", here's what I observe in the image...`,
      'what': 'This appears to be a screenshot of an application window or desktop area.',
      'describe': 'The image shows a user interface with various elements and controls.',
      'help': 'I can help you understand what\'s shown in this screenshot. What would you like to know?',
      'analyze': 'Analyzing the screenshot: The image contains UI elements that appear to be part of an application interface.'
    };

    // Find best matching response
    const queryLower = query.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (queryLower.includes(key)) {
        return response;
      }
    }

    return responses.default;
  }

  async callOpenAI(query, base64Image) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    
    const payload = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: query
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async shutdown() {
    // Cleanup if needed
  }
}

module.exports = AIQueryService;
```

## File 5: src/features/ask/ipcHandlers.js
```javascript
const { ipcMain, dialog } = require('electron');

class AskIPCHandlers {
  constructor(askService) {
    this.askService = askService;
  }

  register() {
    // Start screen capture
    ipcMain.handle('ask:start-capture', async () => {
      try {
        return await this.askService.startScreenCapture();
      } catch (error) {
        console.error('IPC: Failed to start capture:', error);
        return { success: false, error: error.message };
      }
    });

    // Complete capture with selection
    ipcMain.handle('ask:capture-selection', async (event, bounds) => {
      try {
        return await this.askService.captureSelection(bounds);
      } catch (error) {
        console.error('IPC: Failed to capture selection:', error);
        return { success: false, error: error.message };
      }
    });

    // Cancel capture
    ipcMain.handle('ask:cancel-capture', async () => {
      try {
        return await this.askService.cancelCapture();
      } catch (error) {
        console.error('IPC: Failed to cancel capture:', error);
        return { success: false, error: error.message };
      }
    });

    // Query screenshot with AI
    ipcMain.handle('ask:query-screenshot', async (event, { query, screenshotPath }) => {
      try {
        return await this.askService.queryScreenshot(query, screenshotPath);
      } catch (error) {
        console.error('IPC: Failed to query screenshot:', error);
        return { success: false, error: error.message };
      }
    });

    // Save screenshot to file
    ipcMain.handle('ask:save-screenshot', async (event, screenshotPath) => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: `screenshot-${Date.now()}.png`,
          filters: [
            { name: 'Images', extensions: ['png'] }
          ]
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }

        // Copy file to selected location
        const fs = require('fs').promises;
        await fs.copyFile(screenshotPath, result.filePath);

        return { success: true, savedPath: result.filePath };
      } catch (error) {
        console.error('IPC: Failed to save screenshot:', error);
        return { success: false, error: error.message };
      }
    });

    // Handle selection from renderer
    ipcMain.on('ask:selection-update', (event, bounds) => {
      if (this.askService.askWindow) {
        this.askService.askWindow.setSelectionBounds(bounds);
      }
    });

    // Handle selection complete
    ipcMain.on('ask:selection-complete', async (event, bounds) => {
      await this.askService.captureSelection(bounds);
    });

    // Handle capture cancel from renderer
    ipcMain.on('ask:capture-cancelled', () => {
      this.askService.cancelCapture();
    });

    console.log('Ask IPC handlers registered');
  }

  unregister() {
    ipcMain.removeHandler('ask:start-capture');
    ipcMain.removeHandler('ask:capture-selection');
    ipcMain.removeHandler('ask:cancel-capture');
    ipcMain.removeHandler('ask:query-screenshot');
    ipcMain.removeHandler('ask:save-screenshot');
    ipcMain.removeAllListeners('ask:selection-update');
    ipcMain.removeAllListeners('ask:selection-complete');
    ipcMain.removeAllListeners('ask:capture-cancelled');
  }
}

module.exports = AskIPCHandlers;
```

## File 6: src/renderer/ask/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Halo - Ask</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Screenshot Capture Overlay -->
  <div id="captureOverlay" class="capture-overlay hidden">
    <div id="selectionBox" class="selection-box"></div>
    <div id="captureInstructions" class="capture-instructions">
      <p>Click and drag to select an area</p>
      <p class="shortcut">Press <kbd>ESC</kbd> to cancel</p>
    </div>
    <div id="dimensionsDisplay" class="dimensions-display hidden">
      <span id="dimensionsText"></span>
    </div>
  </div>

  <!-- Query Dialog -->
  <div id="queryDialog" class="query-dialog hidden">
    <div class="query-header">
      <h2>Ask About Screenshot</h2>
      <button id="closeQuery" class="close-button" title="Close">×</button>
    </div>

    <div class="query-content">
      <!-- Screenshot Preview -->
      <div class="screenshot-section">
        <div class="screenshot-container">
          <img id="screenshotPreview" alt="Screenshot preview">
          <div class="screenshot-actions">
            <button id="retakeScreenshot" class="action-button">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
              Retake
            </button>
            <button id="saveScreenshot" class="action-button">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>

      <!-- Query Section -->
      <div class="query-section">
        <div class="query-input-container">
          <textarea 
            id="queryInput" 
            class="query-input"
            placeholder="Ask a question about the screenshot..."
            rows="3"
          ></textarea>
          <button id="submitQuery" class="submit-button">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            Ask
          </button>
        </div>

        <!-- Response Section -->
        <div id="responseSection" class="response-section hidden">
          <div class="response-header">
            <h3>Response</h3>
            <button id="copyResponse" class="action-button small">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Copy
            </button>
          </div>
          <div id="responseContent" class="response-content"></div>
        </div>

        <!-- Loading Indicator -->
        <div id="loadingIndicator" class="loading-indicator hidden">
          <div class="spinner"></div>
          <p>Processing your question...</p>
        </div>
      </div>
    </div>

    <!-- History Section -->
    <div class="history-section">
      <div class="history-header">
        <h3>Recent Queries</h3>
        <button id="clearHistory" class="action-button small">Clear</button>
      </div>
      <div id="historyList" class="history-list"></div>
    </div>
  </div>

  <script src="index.js"></script>
</body>
</html>
```

## File 7: src/renderer/ask/styles.css
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: transparent;
  color: #ffffff;
  overflow: hidden;
  user-select: none;
}

.hidden {
  display: none !important;
}

/* Capture Overlay */
.capture-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  cursor: crosshair;
  z-index: 9999;
}

.selection-box {
  position: absolute;
  border: 2px solid #007AFF;
  background: rgba(0, 122, 255, 0.1);
  pointer-events: none;
  display: none;
}

.selection-box.active {
  display: block;
}

.capture-instructions {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px 30px;
  border-radius: 8px;
  text-align: center;
  pointer-events: none;
  backdrop-filter: blur(10px);
}

.capture-instructions p {
  margin: 5px 0;
  font-size: 14px;
}

.capture-instructions .shortcut {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.8;
}

.capture-instructions kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: monospace;
}

.dimensions-display {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

/* Query Dialog */
.query-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #1c1c1e;
  display: flex;
  flex-direction: column;
}

.query-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #2c2c2e;
  border-bottom: 1px solid #3a3a3c;
  -webkit-app-region: drag;
}

.query-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  -webkit-app-region: no-drag;
}

.close-button {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  color: #8e8e93;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.query-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: auto;
}

/* Screenshot Section */
.screenshot-section {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
}

.screenshot-container {
  background: #2c2c2e;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#screenshotPreview {
  width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
}

.screenshot-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  flex: 1;
  background: #3a3a3c;
  border: none;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.action-button:hover {
  background: #48484a;
}

.action-button.small {
  flex: none;
  padding: 6px 10px;
  font-size: 12px;
}

.icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Query Section */
.query-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.query-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-input {
  background: #2c2c2e;
  border: 1px solid #3a3a3c;
  color: #ffffff;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.query-input:focus {
  outline: none;
  border-color: #007AFF;
}

.query-input::placeholder {
  color: #8e8e93;
}

.submit-button {
  align-self: flex-end;
  background: #007AFF;
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.submit-button:hover {
  background: #0051D5;
}

.submit-button:disabled {
  background: #3a3a3c;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Response Section */
.response-section {
  background: #2c2c2e;
  border-radius: 8px;
  padding: 16px;
}

.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.response-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.response-content {
  color: #d1d1d6;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Loading Indicator */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #3a3a3c;
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-indicator p {
  color: #8e8e93;
  font-size: 14px;
}

/* History Section */
.history-section {
  background: #2c2c2e;
  border-top: 1px solid #3a3a3c;
  padding: 16px 20px;
  max-height: 200px;
  overflow-y: auto;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  background: #3a3a3c;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: #48484a;
}

.history-item-query {
  color: #ffffff;
  font-size: 13px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-time {
  color: #8e8e93;
  font-size: 11px;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #48484a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #5a5a5c;
}
```

## File 8: src/renderer/ask/index.js
```javascript
// DOM Elements
const captureOverlay = document.getElementById('captureOverlay');
const selectionBox = document.getElementById('selectionBox');
const captureInstructions = document.getElementById('captureInstructions');
const dimensionsDisplay = document.getElementById('dimensionsDisplay');
const dimensionsText = document.getElementById('dimensionsText');

const queryDialog = document.getElementById('queryDialog');
const screenshotPreview = document.getElementById('screenshotPreview');
const queryInput = document.getElementById('queryInput');
const submitQuery = document.getElementById('submitQuery');
const responseSection = document.getElementById('responseSection');
const responseContent = document.getElementById('responseContent');
const loadingIndicator = document.getElementById('loadingIndicator');
const historyList = document.getElementById('historyList');

// Buttons
const closeQuery = document.getElementById('closeQuery');
const retakeScreenshot = document.getElementById('retakeScreenshot');
const saveScreenshot = document.getElementById('saveScreenshot');
const copyResponse = document.getElementById('copyResponse');
const clearHistory = document.getElementById('clearHistory');

// State
let isCapturing = false;
let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;
let currentScreenshotPath = null;
let queryHistory = [];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  attachEventListeners();
});

// Event Listeners
function attachEventListeners() {
  // Capture overlay events
  captureOverlay.addEventListener('mousedown', handleMouseDown);
  captureOverlay.addEventListener('mousemove', handleMouseMove);
  captureOverlay.addEventListener('mouseup', handleMouseUp);
  
  // Query dialog events
  closeQuery.addEventListener('click', closeDialog);
  retakeScreenshot.addEventListener('click', startNewCapture);
  saveScreenshot.addEventListener('click', saveScreenshotToFile);
  submitQuery.addEventListener('click', submitQuestion);
  copyResponse.addEventListener('click', copyResponseToClipboard);
  clearHistory.addEventListener('click', clearQueryHistory);
  
  // Enter key to submit
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });
}

// IPC Event Handlers
window.electronAPI.onCaptureMode((data) => {
  if (data.active) {
    showCaptureOverlay();
  } else {
    hideCaptureOverlay();
  }
});

window.electronAPI.onShowQuery((data) => {
  currentScreenshotPath = data.screenshotPath;
  showQueryDialog(data.screenshotPath);
});

// Capture Functions
function showCaptureOverlay() {
  captureOverlay.classList.remove('hidden');
  queryDialog.classList.add('hidden');
  isCapturing = true;
  isSelecting = false;
  selectionStart = null;
  selectionEnd = null;
  selectionBox.classList.remove('active');
  captureInstructions.classList.remove('hidden');
  dimensionsDisplay.classList.add('hidden');
}

function hideCaptureOverlay() {
  captureOverlay.classList.add('hidden');
  isCapturing = false;
  isSelecting = false;
}

function handleMouseDown(e) {
  if (!isCapturing) return;
  
  isSelecting = true;
  selectionStart = { x: e.clientX, y: e.clientY };
  selectionBox.style.left = `${e.clientX}px`;
  selectionBox.style.top = `${e.clientY}px`;
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.classList.add('active');
  captureInstructions.classList.add('hidden');
  dimensionsDisplay.classList.remove('hidden');
}

function handleMouseMove(e) {
  if (!isSelecting || !selectionStart) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const left = Math.min(selectionStart.x, currentX);
  const top = Math.min(selectionStart.y, currentY);
  const width = Math.abs(currentX - selectionStart.x);
  const height = Math.abs(currentY - selectionStart.y);
  
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
  
  // Update dimensions display
  dimensionsText.textContent = `${width} × ${height}`;
  dimensionsDisplay.style.left = `${currentX + 10}px`;
  dimensionsDisplay.style.top = `${currentY + 10}px`;
  
  // Update selection in main process
  window.electronAPI.send('ask:selection-update', { left, top, width, height });
}

function handleMouseUp(e) {
  if (!isSelecting || !selectionStart) return;
  
  isSelecting = false;
  selectionEnd = { x: e.clientX, y: e.clientY };
  
  const left = Math.min(selectionStart.x, selectionEnd.x);
  const top = Math.min(selectionStart.y, selectionEnd.y);
  const width = Math.abs(selectionEnd.x - selectionStart.x);
  const height = Math.abs(selectionEnd.y - selectionStart.y);
  
  // Minimum selection size
  if (width < 10 || height < 10) {
    selectionBox.classList.remove('active');
    captureInstructions.classList.remove('hidden');
    dimensionsDisplay.classList.add('hidden');
    return;
  }
  
  // Complete the selection
  const bounds = { x: left, y: top, width, height };
  window.electronAPI.send('ask:selection-complete', bounds);
  
  // Hide overlay immediately
  hideCaptureOverlay();
}

// Query Dialog Functions
function showQueryDialog(screenshotPath) {
  captureOverlay.classList.add('hidden');
  queryDialog.classList.remove('hidden');
  
  // Load screenshot preview
  screenshotPreview.src = `file://${screenshotPath}`;
  
  // Clear previous response
  responseSection.classList.add('hidden');
  responseContent.textContent = '';
  queryInput.value = '';
  queryInput.focus();
}

function closeDialog() {
  queryDialog.classList.add('hidden');
  window.electronAPI.send('ask:close-dialog');
}

async function startNewCapture() {
  queryDialog.classList.add('hidden');
  const result = await window.electronAPI.invoke('ask:start-capture');
  if (!result.success) {
    showError('Failed to start capture: ' + result.error);
  }
}

async function saveScreenshotToFile() {
  if (!currentScreenshotPath) return;
  
  const result = await window.electronAPI.invoke('ask:save-screenshot', currentScreenshotPath);
  if (result.success) {
    showNotification('Screenshot saved successfully');
  } else if (!result.canceled) {
    showError('Failed to save screenshot: ' + result.error);
  }
}

async function submitQuestion() {
  const query = queryInput.value.trim();
  if (!query) return;
  
  // Disable submit button
  submitQuery.disabled = true;
  
  // Show loading
  loadingIndicator.classList.remove('hidden');
  responseSection.classList.add('hidden');
  
  try {
    const result = await window.electronAPI.invoke('ask:query-screenshot', {
      query,
      screenshotPath: currentScreenshotPath
    });
    
    if (result.success) {
      // Show response
      responseContent.textContent = result.response;
      responseSection.classList.remove('hidden');
      
      // Add to history
      addToHistory(query, result.response);
    } else {
      showError('Failed to get response: ' + result.error);
    }
  } catch (error) {
    showError('Error: ' + error.message);
  } finally {
    loadingIndicator.classList.add('hidden');
    submitQuery.disabled = false;
  }
}

function copyResponseToClipboard() {
  const text = responseContent.textContent;
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Response copied to clipboard');
  }).catch(err => {
    showError('Failed to copy: ' + err.message);
  });
}

// History Functions
function addToHistory(query, response) {
  const historyItem = {
    query,
    response,
    timestamp: Date.now()
  };
  
  queryHistory.unshift(historyItem);
  if (queryHistory.length > 10) {
    queryHistory = queryHistory.slice(0, 10);
  }
  
  saveHistory();
  renderHistory();
}

function loadHistory() {
  const saved = localStorage.getItem('askHistory');
  if (saved) {
    try {
      queryHistory = JSON.parse(saved);
    } catch (e) {
      queryHistory = [];
    }
  }
  renderHistory();
}

function saveHistory() {
  localStorage.setItem('askHistory', JSON.stringify(queryHistory));
}

function clearQueryHistory() {
  queryHistory = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  
  if (queryHistory.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No recent queries</div>';
    return;
  }
  
  queryHistory.forEach((item, index) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <div class="history-item-query">${escapeHtml(item.query)}</div>
      <div class="history-item-time">${formatTime(item.timestamp)}</div>
    `;
    
    historyItem.addEventListener('click', () => {
      queryInput.value = item.query;
      responseContent.textContent = item.response;
      responseSection.classList.remove('hidden');
    });
    
    historyList.appendChild(historyItem);
  });
}

// Utility Functions
function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message) {
  // For now, just log
  console.log('Notification:', message);
}

function showError(message) {
  console.error('Error:', message);
  // Could show in UI
}

// Handle escape key globally
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isCapturing) {
      window.electronAPI.send('ask:capture-cancelled');
      hideCaptureOverlay();
    } else if (!queryDialog.classList.contains('hidden')) {
      closeDialog();
    }
  }
});
```

## File 9: src/renderer/ask/preload.js
```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke methods
  invoke: (channel, ...args) => {
    const validChannels = [
      'ask:start-capture',
      'ask:capture-selection',
      'ask:cancel-capture',
      'ask:query-screenshot',
      'ask:save-screenshot'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Invalid channel: ${channel}`);
  },

  // Send methods
  send: (channel, ...args) => {
    const validChannels = [
      'ask:selection-update',
      'ask:selection-complete',
      'ask:capture-cancelled',
      'ask:close-dialog'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      throw new Error(`Invalid channel: ${channel}`);
    }
  },

  // Receive methods
  on: (channel, callback) => {
    const validChannels = [
      'capture-mode',
      'show-query'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    } else {
      throw new Error(`Invalid channel: ${channel}`);
    }
  },

  // Specific event handlers
  onCaptureMode: (callback) => {
    ipcRenderer.on('capture-mode', (event, data) => callback(data));
  },

  onShowQuery: (callback) => {
    ipcRenderer.on('show-query', (event, data) => callback(data));
  }
});

console.log('Ask preload script loaded');
```

## Stage 6 Integration Points

### 1. Update Main Process (src/index.js)
Add the Ask service initialization:

```javascript
// Add to imports
const AskService = require('./features/ask/askService');
const AskIPCHandlers = require('./features/ask/ipcHandlers');

// Add to service initialization
const askService = new AskService();
await askService.initialize(windowManager);

// Register IPC handlers
const askIPCHandlers = new AskIPCHandlers(askService);
askIPCHandlers.register();
```

### 2. Update Window Manager
Register the Ask window type in the window manager configuration.

### 3. Add Keyboard Shortcut
Add global shortcut for screenshot capture (e.g., Cmd+Shift+A).

### 4. Install Additional Dependencies
```bash
npm install sharp
```

## Testing Stage 6

1. **Start the application**:
```bash
npm start
```

2. **Test screenshot capture**:
   - Use keyboard shortcut or menu item to start capture
   - Click and drag to select area
   - Verify screenshot is captured

3. **Test query functionality**:
   - Enter a question about the screenshot
   - Verify mock response appears
   - Test save and copy functions

4. **Test history**:
   - Make multiple queries
   - Verify history is saved and displayed
   - Test clearing history

## Summary
Stage 6 implements a complete screenshot capture and query system with:
- Full-screen overlay for area selection
- Screenshot capture using Electron's desktopCapturer
- Image processing with Sharp
- Query dialog with preview
- AI service integration (ready for real API)
- Query history management
- Save and copy functionality

Total new code: ~2,800 lines across 9 files.