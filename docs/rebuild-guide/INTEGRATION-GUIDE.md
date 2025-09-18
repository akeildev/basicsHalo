# Integration Guide - Bringing It All Together

## Pre-Integration Checklist

### User 1 (Backend) Must Have:
- [ ] Main process launches without errors
- [ ] All IPC handlers respond with correct format
- [ ] LiveKit service generates valid tokens
- [ ] Python agent starts and connects
- [ ] Settings persist correctly
- [ ] No hardcoded paths

### User 2 (Frontend) Must Have:
- [ ] UI builds without errors
- [ ] Preload script in correct location
- [ ] LiveKit client can connect
- [ ] All UI states handled
- [ ] Messages display correctly
- [ ] No console errors in production

## Integration Steps

### Step 1: Initial Merge (Both Users)

```bash
# Both users ensure latest code is pushed
git push origin backend-dev    # User 1
git push origin frontend-dev   # User 2

# Create integration branch
git checkout main
git pull origin main
git checkout -b integration/final

# Merge backend first
git merge backend-dev

# Merge frontend
git merge frontend-dev

# Resolve any conflicts (should be minimal if rules followed)
```

### Step 2: Update Main Process to Load UI (User 1 leads)

User 1 updates `src/main/index.js`:
```javascript
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 500,
        // ... existing config
    });
    
    // Change from dummy URL to actual renderer
    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    } else {
        // Development - build renderer first
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
}
```

### Step 3: Verify IPC Communication (Both)

Create `test-integration.js`:
```javascript
// Test IPC flow
const { app } = require('electron');

app.whenReady().then(async () => {
    console.log('Testing IPC integration...');
    
    // Import services
    const settings = require('./src/main/services/SettingsService');
    const livekit = require('./src/main/services/LiveKitService');
    
    // Test each service
    console.log('Settings:', settings.getAll());
    console.log('LiveKit ready:', await livekit.initialize());
    
    console.log('✅ Backend services OK');
});
```

### Step 4: End-to-End Voice Test

1. **Start the application:**
```bash
npm run build:renderer
npm start
```

2. **Test flow:**
- Click "Start Voice" button
- Check console for:
  - `[Backend] Voice start requested`
  - `[LiveKit] Generating token`
  - `[Agent] Starting`
  - `[Renderer] Connected to room`

3. **Verify each component:**
```javascript
// In renderer console
voiceOverlay.isActive  // Should be true
voiceOverlay.livekitClient.isConnected  // Should be true

// In main process console
livekit.isActive()  // Should be true
livekit.getRoomName()  // Should return room name
```

## Common Integration Issues

### Issue 1: Preload Script Not Found
```javascript
// Symptom: window.api is undefined

// Fix in main/index.js:
webPreferences: {
    preload: path.join(__dirname, '../renderer/preload.js')  // Dev
    // OR
    preload: path.join(__dirname, '../../dist/renderer/preload.js')  // Prod
}
```

### Issue 2: LiveKit Connection Fails
```javascript
// Symptom: LiveKit client can't connect

// Debug steps:
1. Check token generation:
   console.log('Token:', await livekit.generateToken('test-room'));

2. Verify Python agent starts:
   ps aux | grep python | grep voice_agent

3. Check environment variables:
   console.log(process.env.LIVEKIT_URL);
```

### Issue 3: IPC Response Mismatch
```javascript
// Symptom: Frontend expects different format

// Solution: Agree on standard format
// backend returns:
{
    success: boolean,
    data?: any,
    error?: string,
    code?: string
}

// frontend expects:
if (result.success) {
    // Use result.data
} else {
    // Show result.error
}
```

### Issue 4: Build Order Problems
```bash
# Always build in this order:
npm run build:renderer  # Frontend first
npm start              # Then start backend
```

## Performance Testing

### Memory Usage Check
```javascript
// Add to main process
setInterval(() => {
    const usage = process.memoryUsage();
    console.log('Memory:', {
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
        heap: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
    });
}, 10000);
```

### Response Time Testing
```javascript
// Add to renderer
async function testResponseTime() {
    const start = Date.now();
    const result = await window.api.startVoice();
    const time = Date.now() - start;
    console.log(`Voice start took ${time}ms`);
    return time < 2000; // Should be under 2 seconds
}
```

## Final Integration Checklist

### Functionality Tests
- [ ] App launches without errors
- [ ] Voice button starts/stops session
- [ ] LiveKit connects successfully
- [ ] Python agent responds
- [ ] Messages display correctly
- [ ] Mute button works
- [ ] Clear button works
- [ ] Settings persist across restarts

### Performance Tests
- [ ] Startup time < 3 seconds
- [ ] Voice connection < 2 seconds
- [ ] Memory usage < 200MB idle
- [ ] CPU usage < 5% idle
- [ ] Smooth animations (60fps)

### Error Handling Tests
- [ ] No internet connection handled
- [ ] Invalid API keys handled
- [ ] Microphone permission denied handled
- [ ] Python agent crash recovery
- [ ] LiveKit disconnection recovery

## Deployment Preparation

### 1. Clean up code (Both)
```bash
# Remove debug logs
grep -r "console.log" src/ | grep -v "// Production"

# Remove test files
rm test-*.js
rm test-*.html

# Clean dependencies
npm prune --production
```

### 2. Update package.json (User 1)
```json
{
  "scripts": {
    "start": "electron .",
    "build": "npm run build:renderer && electron-builder",
    "build:mac": "npm run build:renderer && electron-builder --mac",
    "build:win": "npm run build:renderer && electron-builder --win"
  }
}
```

### 3. Test production build (Both)
```bash
npm run build:mac  # or build:win
# Test the built app in dist/mac/
```

## Sign-off Checklist

### User 1 Confirms:
- [ ] All backend services working
- [ ] Python agent stable
- [ ] API keys secured
- [ ] Error handling complete
- [ ] Performance acceptable

### User 2 Confirms:
- [ ] UI polished and responsive
- [ ] All interactions smooth
- [ ] Error states handled
- [ ] Animations performant
- [ ] Cross-platform tested

### Both Confirm:
- [ ] Integration tests pass
- [ ] No console errors
- [ ] Memory leaks checked
- [ ] Documentation complete
- [ ] Ready for production

## Final Merge to Main

```bash
# After all tests pass
git checkout main
git merge integration/final
git push origin main

# Tag the release
git tag -a v0.1.0 -m "Initial release"
git push origin v0.1.0
```

## Post-Integration Support

### Monitoring
- Set up error logging service
- Monitor memory usage in production
- Track user issues

### Maintenance
- Regular dependency updates
- Security patches
- Performance improvements

### Future Features
- Additional MCP tools
- Voice customization
- Multi-language support
- Cloud sync

Congratulations! You've successfully built Voice Overlay as a team! 🎉