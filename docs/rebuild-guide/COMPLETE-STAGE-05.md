# Complete Stage 5: Settings Window - Full Configuration Management

## Overview
Building on Stage 4's IPC system, we now add a complete settings window with persistent storage, theme management, and all configuration options for Halo.

## New Files in Stage 5
```
halo-rebuild/
├── [Stage 1-4 files...]
└── src/
    ├── renderer/
    │   └── settings/
    │       ├── index.html          (NEW - 498 lines)
    │       ├── styles.css           (NEW - 687 lines)
    │       └── renderer.js          (NEW - 823 lines)
    ├── features/
    │   └── settings/
    │       ├── settingsService.js  (NEW - 456 lines)
    │       └── settingsStore.js    (NEW - 312 lines)
    ├── services/
    │   └── encryptionService.js    (NEW - 189 lines)
    └── config/
        └── defaultSettings.js       (NEW - 145 lines)
```

## Complete Implementation

### Step 1: Create Settings Window HTML

**File: `src/renderer/settings/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'">
  <title>Halo Settings</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="settings-container">
    <!-- Header -->
    <div class="settings-header">
      <div class="header-left">
        <h2 class="settings-title">Settings</h2>
      </div>
      <div class="header-right">
        <button class="icon-btn" id="close-btn" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Main Content -->
    <div class="settings-content">
      <!-- Sidebar Navigation -->
      <nav class="settings-nav">
        <button class="nav-item active" data-section="general">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M1 12h6m6 0h6m-13.22 4.22l-4.24 4.24m16.92 0l-4.24-4.24"></path>
          </svg>
          <span>General</span>
        </button>
        
        <button class="nav-item" data-section="appearance">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"></path>
          </svg>
          <span>Appearance</span>
        </button>
        
        <button class="nav-item" data-section="ai">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>AI Models</span>
        </button>
        
        <button class="nav-item" data-section="voice">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"></path>
            <path d="M19 10v2a7 7 0 01-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          <span>Voice</span>
        </button>
        
        <button class="nav-item" data-section="shortcuts">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"></path>
          </svg>
          <span>Shortcuts</span>
        </button>
        
        <button class="nav-item" data-section="privacy">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0110 0v4"></path>
          </svg>
          <span>Privacy</span>
        </button>
        
        <button class="nav-item" data-section="advanced">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Advanced</span>
        </button>
        
        <button class="nav-item" data-section="about">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>About</span>
        </button>
      </nav>
      
      <!-- Settings Sections -->
      <div class="settings-sections">
        <!-- General Section -->
        <section class="settings-section active" id="general-section">
          <h3 class="section-title">General Settings</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Launch at startup</span>
              <span class="label-description">Start Halo when your computer starts</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="launch-at-startup">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Show in menu bar</span>
              <span class="label-description">Keep Halo accessible from the menu bar</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="show-in-menubar" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Auto-hide header</span>
              <span class="label-description">Hide header window when not in use</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="auto-hide-header">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Language</span>
              <span class="label-description">Choose your preferred language</span>
            </label>
            <select class="setting-select" id="language-select">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </section>
        
        <!-- Appearance Section -->
        <section class="settings-section" id="appearance-section">
          <h3 class="section-title">Appearance</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Theme</span>
              <span class="label-description">Choose your color theme</span>
            </label>
            <div class="theme-selector">
              <button class="theme-option active" data-theme="dark">
                <div class="theme-preview dark"></div>
                <span>Dark</span>
              </button>
              <button class="theme-option" data-theme="light">
                <div class="theme-preview light"></div>
                <span>Light</span>
              </button>
              <button class="theme-option" data-theme="auto">
                <div class="theme-preview auto"></div>
                <span>Auto</span>
              </button>
            </div>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Accent color</span>
              <span class="label-description">Customize the accent color</span>
            </label>
            <div class="color-picker">
              <input type="color" id="accent-color" value="#667eea">
              <span class="color-value">#667eea</span>
            </div>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Window opacity</span>
              <span class="label-description">Adjust window transparency</span>
            </label>
            <div class="slider-container">
              <input type="range" id="window-opacity" min="50" max="100" value="95">
              <span class="slider-value">95%</span>
            </div>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Animations</span>
              <span class="label-description">Enable smooth animations</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="enable-animations" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>
        
        <!-- AI Models Section -->
        <section class="settings-section" id="ai-section">
          <h3 class="section-title">AI Models</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Primary AI Model</span>
              <span class="label-description">Choose your default AI assistant</span>
            </label>
            <select class="setting-select" id="ai-model-select">
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
              <option value="gemini-pro">Gemini Pro</option>
              <option value="local">Local Model</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">OpenAI API Key</span>
              <span class="label-description">Your OpenAI API key for GPT models</span>
            </label>
            <div class="input-group">
              <input type="password" class="setting-input" id="openai-api-key" placeholder="sk-...">
              <button class="input-btn" onclick="togglePasswordVisibility('openai-api-key')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Temperature</span>
              <span class="label-description">Control AI response creativity (0 = focused, 1 = creative)</span>
            </label>
            <div class="slider-container">
              <input type="range" id="ai-temperature" min="0" max="100" value="70">
              <span class="slider-value">0.7</span>
            </div>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Max tokens</span>
              <span class="label-description">Maximum response length</span>
            </label>
            <input type="number" class="setting-input" id="max-tokens" value="2048" min="100" max="4096">
          </div>
        </section>
        
        <!-- Voice Section -->
        <section class="settings-section" id="voice-section">
          <h3 class="section-title">Voice Settings</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Enable voice input</span>
              <span class="label-description">Use your microphone to talk to Halo</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="enable-voice" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Microphone</span>
              <span class="label-description">Select your input device</span>
            </label>
            <select class="setting-select" id="microphone-select">
              <option value="default">System Default</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Voice activation</span>
              <span class="label-description">Activate with "Hey Halo"</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="voice-activation">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Speech-to-text service</span>
              <span class="label-description">Choose transcription service</span>
            </label>
            <select class="setting-select" id="stt-service">
              <option value="deepgram">Deepgram</option>
              <option value="whisper">OpenAI Whisper</option>
              <option value="google">Google Speech</option>
              <option value="system">System Default</option>
            </select>
          </div>
        </section>
        
        <!-- Shortcuts Section -->
        <section class="settings-section" id="shortcuts-section">
          <h3 class="section-title">Keyboard Shortcuts</h3>
          
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-name">Show/Hide Halo</span>
                <span class="shortcut-description">Toggle main window visibility</span>
              </div>
              <input type="text" class="shortcut-input" value="Cmd+Shift+H" readonly>
            </div>
            
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-name">Start listening</span>
                <span class="shortcut-description">Activate voice input</span>
              </div>
              <input type="text" class="shortcut-input" value="Cmd+Shift+L" readonly>
            </div>
            
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-name">Take screenshot</span>
                <span class="shortcut-description">Capture and ask about screen</span>
              </div>
              <input type="text" class="shortcut-input" value="Cmd+Shift+S" readonly>
            </div>
            
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-name">Open settings</span>
                <span class="shortcut-description">Open this settings window</span>
              </div>
              <input type="text" class="shortcut-input" value="Cmd+," readonly>
            </div>
          </div>
        </section>
        
        <!-- Privacy Section -->
        <section class="settings-section" id="privacy-section">
          <h3 class="section-title">Privacy & Security</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Screen recording permission</span>
              <span class="label-description">Required for screenshot features</span>
            </label>
            <button class="setting-btn" id="request-screen-permission">Grant Permission</button>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Store conversation history</span>
              <span class="label-description">Save your conversations locally</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="store-history" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Analytics</span>
              <span class="label-description">Help improve Halo with anonymous usage data</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="enable-analytics">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Clear all data</span>
              <span class="label-description">Remove all stored data and reset settings</span>
            </label>
            <button class="setting-btn danger" id="clear-data">Clear Data</button>
          </div>
        </section>
        
        <!-- Advanced Section -->
        <section class="settings-section" id="advanced-section">
          <h3 class="section-title">Advanced Settings</h3>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Developer mode</span>
              <span class="label-description">Enable developer tools and logging</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="dev-mode">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Log level</span>
              <span class="label-description">Set logging verbosity</span>
            </label>
            <select class="setting-select" id="log-level">
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info" selected>Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Export settings</span>
              <span class="label-description">Save your settings to a file</span>
            </label>
            <button class="setting-btn" id="export-settings">Export</button>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <span class="label-text">Import settings</span>
              <span class="label-description">Load settings from a file</span>
            </label>
            <button class="setting-btn" id="import-settings">Import</button>
          </div>
        </section>
        
        <!-- About Section -->
        <section class="settings-section" id="about-section">
          <h3 class="section-title">About Halo</h3>
          
          <div class="about-content">
            <div class="about-logo">
              <svg width="80" height="80" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="aboutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#aboutGradient)" stroke-width="3"/>
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#aboutGradient)" stroke-width="2" opacity="0.7"/>
                <circle cx="50" cy="50" r="25" fill="none" stroke="url(#aboutGradient)" stroke-width="2" opacity="0.4"/>
                <circle cx="50" cy="50" r="10" fill="url(#aboutGradient)"/>
              </svg>
            </div>
            
            <h2 class="about-title">Halo Desktop Assistant</h2>
            <p class="about-version">Version 0.1.0</p>
            <p class="about-description">
              Your intelligent desktop companion powered by advanced AI
            </p>
            
            <div class="about-info">
              <div class="info-row">
                <span class="info-label">Electron:</span>
                <span class="info-value" id="electron-version">-</span>
              </div>
              <div class="info-row">
                <span class="info-label">Node:</span>
                <span class="info-value" id="node-version">-</span>
              </div>
              <div class="info-row">
                <span class="info-label">Chrome:</span>
                <span class="info-value" id="chrome-version">-</span>
              </div>
            </div>
            
            <div class="about-actions">
              <button class="setting-btn" onclick="openWebsite()">Website</button>
              <button class="setting-btn" onclick="checkForUpdates()">Check for Updates</button>
            </div>
            
            <p class="about-copyright">
              © 2024 Pickle Team. All rights reserved.
            </p>
          </div>
        </section>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="settings-footer">
      <button class="btn-secondary" id="reset-btn">Reset to Defaults</button>
      <div class="footer-actions">
        <button class="btn-secondary" id="cancel-btn">Cancel</button>
        <button class="btn-primary" id="save-btn">Save Changes</button>
      </div>
    </div>
  </div>
  
  <script src="renderer.js"></script>
</body>
</html>
```

### Step 2: Create Settings Window Styles

**File: `src/renderer/settings/styles.css`**
```css
/* Settings Window Styles */
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --bg-hover: rgba(255, 255, 255, 0.05);
  --bg-active: rgba(255, 255, 255, 0.1);
  
  --text-primary: #ffffff;
  --text-secondary: #a8b2d1;
  --text-tertiary: #64748b;
  
  --border-color: rgba(255, 255, 255, 0.1);
  --border-active: rgba(102, 126, 234, 0.5);
  
  --accent-primary: #667eea;
  --accent-secondary: #764ba2;
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #f87171;
  
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: transparent;
  color: var(--text-primary);
  user-select: none;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

/* Settings Container */
.settings-container {
  width: 100%;
  height: 100vh;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Settings Header */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Settings Content */
.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Settings Navigation */
.settings-nav {
  width: 200px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 4px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Settings Sections */
.settings-sections {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.settings-section {
  display: none;
  animation: fadeIn 0.3s ease-out;
}

.settings-section.active {
  display: block;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--text-primary);
}

/* Setting Groups */
.setting-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-group:last-child {
  border-bottom: none;
}

.setting-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.label-description {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-tertiary);
  transition: var(--transition);
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: var(--transition);
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background: var(--accent-primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

/* Select Dropdown */
.setting-select {
  min-width: 150px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition);
}

.setting-select:hover {
  border-color: var(--border-active);
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Input Fields */
.setting-input {
  min-width: 200px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  transition: var(--transition);
}

.setting-input:hover {
  border-color: var(--border-active);
}

.setting-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-btn {
  padding: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.input-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Buttons */
.setting-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.setting-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-active);
}

.setting-btn.danger {
  color: var(--error);
  border-color: var(--error);
}

.setting-btn.danger:hover {
  background: var(--error);
  color: white;
}

/* Theme Selector */
.theme-selector {
  display: flex;
  gap: 12px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
}

.theme-option:hover {
  background: var(--bg-hover);
}

.theme-option.active {
  border-color: var(--accent-primary);
}

.theme-preview {
  width: 60px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.theme-preview.dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.theme-preview.light {
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
}

.theme-preview.auto {
  background: linear-gradient(135deg, #1a1a2e 0%, #ffffff 50%, #f0f0f0 100%);
}

/* Color Picker */
.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker input[type="color"] {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.color-value {
  font-family: monospace;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Slider */
.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.slider-container input[type="range"] {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
}

.slider-value {
  min-width: 40px;
  text-align: right;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Shortcuts List */
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.shortcut-description {
  font-size: 12px;
  color: var(--text-tertiary);
}

.shortcut-input {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 12px;
  text-align: center;
  min-width: 120px;
}

/* About Section */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 0;
}

.about-logo {
  margin-bottom: 24px;
}

.about-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.about-version {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.about-description {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-bottom: 32px;
  max-width: 400px;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 32px;
}

.info-row {
  display: flex;
  gap: 12px;
  font-size: 14px;
}

.info-label {
  color: var(--text-tertiary);
}

.info-value {
  color: var(--text-secondary);
  font-family: monospace;
}

.about-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.about-copyright {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Settings Footer */
.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-active);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--bg-hover);
}
```

### Step 3: Create Settings Window JavaScript

**File: `src/renderer/settings/renderer.js`**
```javascript
// Settings Window Renderer
console.log('[Settings] Initializing settings window...');

// Settings state
let settings = {};
let hasChanges = false;
let originalSettings = {};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Settings] DOM loaded');
  
  // Load current settings
  await loadSettings();
  
  // Setup navigation
  setupNavigation();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup form change detection
  setupChangeDetection();
  
  // Initialize platform-specific features
  initializePlatform();
  
  console.log('[Settings] Settings window initialized');
});

// Load settings from backend
async function loadSettings() {
  console.log('[Settings] Loading settings...');
  
  try {
    if (window.electronAPI && window.electronAPI.feature) {
      const result = await window.electronAPI.feature.request('settings', 'get');
      if (result.success) {
        settings = result.data;
        originalSettings = JSON.parse(JSON.stringify(settings));
        applySettingsToUI(settings);
        console.log('[Settings] Settings loaded:', settings);
      }
    }
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
    showNotification('Failed to load settings', 'error');
  }
}

// Apply settings to UI
function applySettingsToUI(settings) {
  // General settings
  setToggle('launch-at-startup', settings.general?.launchAtStartup);
  setToggle('show-in-menubar', settings.general?.showInMenubar);
  setToggle('auto-hide-header', settings.general?.autoHideHeader);
  setValue('language-select', settings.general?.language || 'en');
  
  // Appearance settings
  setTheme(settings.appearance?.theme || 'dark');
  setValue('accent-color', settings.appearance?.accentColor || '#667eea');
  setSlider('window-opacity', settings.appearance?.windowOpacity || 95);
  setToggle('enable-animations', settings.appearance?.enableAnimations);
  
  // AI settings
  setValue('ai-model-select', settings.ai?.model || 'gpt-4');
  setValue('openai-api-key', settings.ai?.openaiApiKey || '');
  setSlider('ai-temperature', (settings.ai?.temperature || 0.7) * 100);
  setValue('max-tokens', settings.ai?.maxTokens || 2048);
  
  // Voice settings
  setToggle('enable-voice', settings.voice?.enabled);
  setValue('microphone-select', settings.voice?.microphone || 'default');
  setToggle('voice-activation', settings.voice?.voiceActivation);
  setValue('stt-service', settings.voice?.sttService || 'deepgram');
  
  // Privacy settings
  setToggle('store-history', settings.privacy?.storeHistory);
  setToggle('enable-analytics', settings.privacy?.enableAnalytics);
  
  // Advanced settings
  setToggle('dev-mode', settings.advanced?.devMode);
  setValue('log-level', settings.advanced?.logLevel || 'info');
  
  // About section
  updateAboutInfo();
}

// Setup navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      
      // Update nav active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionId}-section`) {
          section.classList.add('active');
        }
      });
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Close button
  document.getElementById('close-btn')?.addEventListener('click', closeSettings);
  
  // Footer buttons
  document.getElementById('save-btn')?.addEventListener('click', saveSettings);
  document.getElementById('cancel-btn')?.addEventListener('click', closeSettings);
  document.getElementById('reset-btn')?.addEventListener('click', resetSettings);
  
  // Theme selector
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
      markAsChanged();
    });
  });
  
  // Color picker
  document.getElementById('accent-color')?.addEventListener('input', (e) => {
    updateAccentColor(e.target.value);
    markAsChanged();
  });
  
  // Sliders
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      updateSliderValue(e.target);
      markAsChanged();
    });
  });
  
  // Privacy actions
  document.getElementById('request-screen-permission')?.addEventListener('click', requestScreenPermission);
  document.getElementById('clear-data')?.addEventListener('click', clearAllData);
  
  // Advanced actions
  document.getElementById('export-settings')?.addEventListener('click', exportSettings);
  document.getElementById('import-settings')?.addEventListener('click', importSettings);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveSettings();
    }
  });
}

// Setup change detection
function setupChangeDetection() {
  // Track all form inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('change', markAsChanged);
  });
}

// Mark settings as changed
function markAsChanged() {
  hasChanges = true;
  document.getElementById('save-btn')?.classList.add('has-changes');
}

// Save settings
async function saveSettings() {
  console.log('[Settings] Saving settings...');
  
  const newSettings = collectSettingsFromUI();
  
  try {
    if (window.electronAPI && window.electronAPI.feature) {
      const result = await window.electronAPI.feature.request('settings', 'set', newSettings);
      if (result.success) {
        settings = newSettings;
        originalSettings = JSON.parse(JSON.stringify(newSettings));
        hasChanges = false;
        document.getElementById('save-btn')?.classList.remove('has-changes');
        showNotification('Settings saved successfully', 'success');
        
        // Apply certain settings immediately
        applyImmediateSettings(newSettings);
      }
    }
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Collect settings from UI
function collectSettingsFromUI() {
  return {
    general: {
      launchAtStartup: getToggle('launch-at-startup'),
      showInMenubar: getToggle('show-in-menubar'),
      autoHideHeader: getToggle('auto-hide-header'),
      language: getValue('language-select')
    },
    appearance: {
      theme: getActiveTheme(),
      accentColor: getValue('accent-color'),
      windowOpacity: parseInt(getValue('window-opacity')),
      enableAnimations: getToggle('enable-animations')
    },
    ai: {
      model: getValue('ai-model-select'),
      openaiApiKey: getValue('openai-api-key'),
      temperature: parseInt(getValue('ai-temperature')) / 100,
      maxTokens: parseInt(getValue('max-tokens'))
    },
    voice: {
      enabled: getToggle('enable-voice'),
      microphone: getValue('microphone-select'),
      voiceActivation: getToggle('voice-activation'),
      sttService: getValue('stt-service')
    },
    privacy: {
      storeHistory: getToggle('store-history'),
      enableAnalytics: getToggle('enable-analytics')
    },
    advanced: {
      devMode: getToggle('dev-mode'),
      logLevel: getValue('log-level')
    }
  };
}

// Reset settings to defaults
async function resetSettings() {
  const confirmed = await confirmAction('Reset all settings to defaults?');
  if (!confirmed) return;
  
  try {
    if (window.electronAPI && window.electronAPI.feature) {
      const result = await window.electronAPI.feature.request('settings', 'reset');
      if (result.success) {
        await loadSettings();
        showNotification('Settings reset to defaults', 'success');
      }
    }
  } catch (error) {
    console.error('[Settings] Failed to reset settings:', error);
    showNotification('Failed to reset settings', 'error');
  }
}

// Close settings window
function closeSettings() {
  if (hasChanges) {
    confirmAction('You have unsaved changes. Close without saving?').then(confirmed => {
      if (confirmed) {
        window.electronAPI.window.hide('settings');
      }
    });
  } else {
    window.electronAPI.window.hide('settings');
  }
}

// Helper functions
function setToggle(id, value) {
  const element = document.getElementById(id);
  if (element) element.checked = !!value;
}

function getToggle(id) {
  const element = document.getElementById(id);
  return element ? element.checked : false;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : '';
}

function setSlider(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
    updateSliderValue(element);
  }
}

function updateSliderValue(slider) {
  const valueSpan = slider.parentElement.querySelector('.slider-value');
  if (valueSpan) {
    if (slider.id === 'ai-temperature') {
      valueSpan.textContent = (parseInt(slider.value) / 100).toFixed(1);
    } else {
      valueSpan.textContent = slider.value + '%';
    }
  }
}

function setTheme(theme) {
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function getActiveTheme() {
  const activeTheme = document.querySelector('.theme-option.active');
  return activeTheme ? activeTheme.dataset.theme : 'dark';
}

function updateAccentColor(color) {
  document.querySelector('.color-value').textContent = color;
  document.documentElement.style.setProperty('--accent-primary', color);
}

// Platform-specific initialization
function initializePlatform() {
  if (window.electronAPI && window.electronAPI.platform) {
    const platform = window.electronAPI.platform.is;
    document.body.classList.add(`platform-${platform}`);
    
    // Load available microphones
    loadMicrophones();
  }
}

// Load available microphones
async function loadMicrophones() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter(device => device.kind === 'audioinput');
    
    const select = document.getElementById('microphone-select');
    if (select) {
      select.innerHTML = '<option value="default">System Default</option>';
      microphones.forEach(mic => {
        const option = document.createElement('option');
        option.value = mic.deviceId;
        option.textContent = mic.label || `Microphone ${mic.deviceId.substr(0, 8)}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[Settings] Failed to load microphones:', error);
  }
}

// Update about info
function updateAboutInfo() {
  if (window.electronAPI) {
    document.getElementById('electron-version').textContent = window.electronAPI.versions?.electron || '-';
    document.getElementById('node-version').textContent = window.electronAPI.versions?.node || '-';
    document.getElementById('chrome-version').textContent = window.electronAPI.versions?.chrome || '-';
  }
}

// Request screen permission
async function requestScreenPermission() {
  try {
    const result = await window.electronAPI.feature.request('permissions', 'requestScreen');
    if (result.success) {
      showNotification('Screen recording permission granted', 'success');
    }
  } catch (error) {
    showNotification('Failed to request permission', 'error');
  }
}

// Clear all data
async function clearAllData() {
  const confirmed = await confirmAction('This will delete all data and reset the app. Continue?');
  if (!confirmed) return;
  
  try {
    const result = await window.electronAPI.feature.request('data', 'clearAll');
    if (result.success) {
      showNotification('All data cleared', 'success');
      setTimeout(() => {
        window.electronAPI.app.restart();
      }, 1000);
    }
  } catch (error) {
    showNotification('Failed to clear data', 'error');
  }
}

// Export settings
async function exportSettings() {
  try {
    const result = await window.electronAPI.dialog.showSave({
      title: 'Export Settings',
      defaultPath: 'halo-settings.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });
    
    if (!result.canceled) {
      const settingsJson = JSON.stringify(settings, null, 2);
      await window.electronAPI.fs.writeFile(result.filePath, settingsJson);
      showNotification('Settings exported successfully', 'success');
    }
  } catch (error) {
    showNotification('Failed to export settings', 'error');
  }
}

// Import settings
async function importSettings() {
  try {
    const result = await window.electronAPI.dialog.showOpen({
      title: 'Import Settings',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const fileContent = await window.electronAPI.fs.readFile(result.filePaths[0]);
      const importedSettings = JSON.parse(fileContent.data);
      
      // Apply imported settings
      applySettingsToUI(importedSettings);
      markAsChanged();
      showNotification('Settings imported successfully', 'success');
    }
  } catch (error) {
    showNotification('Failed to import settings', 'error');
  }
}

// Apply immediate settings
function applyImmediateSettings(settings) {
  // Apply theme
  if (settings.appearance?.theme) {
    document.body.className = `theme-${settings.appearance.theme}`;
  }
  
  // Apply accent color
  if (settings.appearance?.accentColor) {
    document.documentElement.style.setProperty('--accent-primary', settings.appearance.accentColor);
  }
  
  // Apply animations
  if (!settings.appearance?.enableAnimations) {
    document.documentElement.style.setProperty('--transition', 'none');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Implementation depends on notification system
  console.log(`[Settings] ${type}: ${message}`);
  
  // You can implement a toast notification here
  if (window.electronAPI && window.electronAPI.feature) {
    window.electronAPI.feature.emit('notification', 'show', { message, type });
  }
}

// Confirm action dialog
async function confirmAction(message) {
  if (window.electronAPI && window.electronAPI.dialog) {
    const result = await window.electronAPI.dialog.showMessage({
      type: 'question',
      buttons: ['Cancel', 'OK'],
      defaultId: 0,
      message
    });
    return result.response === 1;
  }
  return confirm(message);
}

// Toggle password visibility
window.togglePasswordVisibility = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
};

// Open website
window.openWebsite = function() {
  if (window.electronAPI && window.electronAPI.shell) {
    window.electronAPI.shell.openExternal('https://clueless.app');
  }
};

// Check for updates
window.checkForUpdates = function() {
  if (window.electronAPI && window.electronAPI.feature) {
    window.electronAPI.feature.request('updater', 'check').then(result => {
      if (result.success) {
        showNotification('Checking for updates...', 'info');
      }
    });
  }
};

console.log('[Settings] Settings renderer loaded');
```

### Step 4: Create Settings Service

**File: `src/features/settings/settingsService.js`**
```javascript
const { EventEmitter } = require('events');
const settingsStore = require('./settingsStore');
const encryptionService = require('../../services/encryptionService');
const defaultSettings = require('../../config/defaultSettings');
const { app } = require('electron');

class SettingsService extends EventEmitter {
    constructor() {
        super();
        this.settings = {};
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        console.log('[SettingsService] Initializing...');
        
        try {
            // Initialize encryption
            await encryptionService.initialize();
            
            // Load settings
            await this.loadSettings();
            
            // Register IPC handlers
            this.registerHandlers();
            
            // Apply startup settings
            await this.applyStartupSettings();
            
            this.initialized = true;
            console.log('[SettingsService] Initialized');
            
        } catch (error) {
            console.error('[SettingsService] Initialization failed:', error);
            throw error;
        }
    }
    
    async loadSettings() {
        try {
            const stored = await settingsStore.get();
            
            if (stored) {
                // Decrypt sensitive settings
                if (stored.ai?.openaiApiKey) {
                    stored.ai.openaiApiKey = await encryptionService.decrypt(stored.ai.openaiApiKey);
                }
                if (stored.ai?.anthropicApiKey) {
                    stored.ai.anthropicApiKey = await encryptionService.decrypt(stored.ai.anthropicApiKey);
                }
                
                this.settings = { ...defaultSettings.get(), ...stored };
            } else {
                this.settings = defaultSettings.get();
            }
            
            console.log('[SettingsService] Settings loaded');
            
        } catch (error) {
            console.error('[SettingsService] Failed to load settings:', error);
            this.settings = defaultSettings.get();
        }
    }
    
    async saveSettings(updates) {
        try {
            // Merge updates
            this.settings = { ...this.settings, ...updates };
            
            // Prepare for storage
            const toStore = { ...this.settings };
            
            // Encrypt sensitive settings
            if (toStore.ai?.openaiApiKey) {
                toStore.ai.openaiApiKey = await encryptionService.encrypt(toStore.ai.openaiApiKey);
            }
            if (toStore.ai?.anthropicApiKey) {
                toStore.ai.anthropicApiKey = await encryptionService.encrypt(toStore.ai.anthropicApiKey);
            }
            
            // Save to store
            await settingsStore.set(toStore);
            
            // Emit change event
            this.emit('changed', this.settings);
            
            console.log('[SettingsService] Settings saved');
            
            return true;
            
        } catch (error) {
            console.error('[SettingsService] Failed to save settings:', error);
            throw error;
        }
    }
    
    async resetSettings() {
        try {
            this.settings = defaultSettings.get();
            await settingsStore.clear();
            
            this.emit('reset', this.settings);
            
            console.log('[SettingsService] Settings reset to defaults');
            
            return true;
            
        } catch (error) {
            console.error('[SettingsService] Failed to reset settings:', error);
            throw error;
        }
    }
    
    get(path) {
        if (!path) return this.settings;
        
        const keys = path.split('.');
        let value = this.settings;
        
        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
        }
        
        return value;
    }
    
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        let target = this.settings;
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        target[lastKey] = value;
        
        return this.saveSettings(this.settings);
    }
    
    registerHandlers() {
        const featureBridge = require('../../bridge/featureBridge');
        
        featureBridge.registerHandler('settings', 'get', async (path) => {
            return this.get(path);
        });
        
        featureBridge.registerHandler('settings', 'set', async (data) => {
            if (typeof data === 'object') {
                return await this.saveSettings(data);
            } else {
                const { path, value } = data;
                return await this.set(path, value);
            }
        });
        
        featureBridge.registerHandler('settings', 'reset', async () => {
            return await this.resetSettings();
        });
        
        console.log('[SettingsService] Handlers registered');
    }
    
    async applyStartupSettings() {
        // Launch at startup
        if (this.settings.general?.launchAtStartup) {
            app.setLoginItemSettings({
                openAtLogin: true,
                openAsHidden: true
            });
        }
        
        // Other startup settings can be applied here
        
        console.log('[SettingsService] Startup settings applied');
    }
    
    // Specific setting getters for convenience
    getTheme() {
        return this.get('appearance.theme') || 'dark';
    }
    
    getAIModel() {
        return this.get('ai.model') || 'gpt-4';
    }
    
    getAPIKey(service) {
        switch (service) {
            case 'openai':
                return this.get('ai.openaiApiKey');
            case 'anthropic':
                return this.get('ai.anthropicApiKey');
            case 'google':
                return this.get('ai.googleApiKey');
            default:
                return null;
        }
    }
    
    isVoiceEnabled() {
        return this.get('voice.enabled') !== false;
    }
    
    getLogLevel() {
        return this.get('advanced.logLevel') || 'info';
    }
}

module.exports = new SettingsService();
```

### Step 5: Create Settings Store

**File: `src/features/settings/settingsStore.js`**
```javascript
const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class SettingsStore {
    constructor() {
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        this.cache = null;
    }
    
    async get() {
        try {
            // Return cached if available
            if (this.cache !== null) {
                return this.cache;
            }
            
            // Check if file exists
            try {
                await fs.access(this.settingsPath);
            } catch {
                return null;
            }
            
            // Read and parse
            const data = await fs.readFile(this.settingsPath, 'utf8');
            const settings = JSON.parse(data);
            
            // Cache it
            this.cache = settings;
            
            return settings;
            
        } catch (error) {
            console.error('[SettingsStore] Failed to read settings:', error);
            return null;
        }
    }
    
    async set(settings) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.settingsPath);
            await fs.mkdir(dir, { recursive: true });
            
            // Write settings
            const data = JSON.stringify(settings, null, 2);
            await fs.writeFile(this.settingsPath, data, 'utf8');
            
            // Update cache
            this.cache = settings;
            
            console.log('[SettingsStore] Settings saved to disk');
            
            return true;
            
        } catch (error) {
            console.error('[SettingsStore] Failed to write settings:', error);
            throw error;
        }
    }
    
    async clear() {
        try {
            await fs.unlink(this.settingsPath);
            this.cache = null;
            console.log('[SettingsStore] Settings cleared');
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('[SettingsStore] Failed to clear settings:', error);
                throw error;
            }
            return true;
        }
    }
    
    async backup() {
        try {
            const backupPath = this.settingsPath + '.backup';
            await fs.copyFile(this.settingsPath, backupPath);
            console.log('[SettingsStore] Settings backed up');
            return true;
        } catch (error) {
            console.error('[SettingsStore] Failed to backup settings:', error);
            return false;
        }
    }
    
    async restore() {
        try {
            const backupPath = this.settingsPath + '.backup';
            await fs.copyFile(backupPath, this.settingsPath);
            this.cache = null;
            console.log('[SettingsStore] Settings restored from backup');
            return true;
        } catch (error) {
            console.error('[SettingsStore] Failed to restore settings:', error);
            return false;
        }
    }
}

module.exports = new SettingsStore();
```

### Step 6: Create Encryption Service

**File: `src/services/encryptionService.js`**
```javascript
const crypto = require('crypto');
const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyPath = path.join(app.getPath('userData'), '.key');
        this.key = null;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Load or generate key
            this.key = await this.loadOrGenerateKey();
            this.initialized = true;
            console.log('[EncryptionService] Initialized');
        } catch (error) {
            console.error('[EncryptionService] Failed to initialize:', error);
            throw error;
        }
    }
    
    async loadOrGenerateKey() {
        try {
            // Try to load existing key
            const keyData = await fs.readFile(this.keyPath, 'utf8');
            return Buffer.from(keyData, 'hex');
        } catch {
            // Generate new key
            const key = crypto.randomBytes(32);
            await fs.writeFile(this.keyPath, key.toString('hex'), 'utf8');
            console.log('[EncryptionService] Generated new encryption key');
            return key;
        }
    }
    
    async encrypt(text) {
        if (!this.initialized) await this.initialize();
        if (!text) return text;
        
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('[EncryptionService] Encryption failed:', error);
            throw error;
        }
    }
    
    async decrypt(encryptedText) {
        if (!this.initialized) await this.initialize();
        if (!encryptedText) return encryptedText;
        
        try {
            const parts = encryptedText.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('[EncryptionService] Decryption failed:', error);
            throw error;
        }
    }
}

module.exports = new EncryptionService();
```

### Step 7: Create Default Settings

**File: `src/config/defaultSettings.js`**
```javascript
const defaultSettings = {
    general: {
        launchAtStartup: false,
        showInMenubar: true,
        autoHideHeader: false,
        language: 'en'
    },
    appearance: {
        theme: 'dark',
        accentColor: '#667eea',
        windowOpacity: 95,
        enableAnimations: true
    },
    ai: {
        model: 'gpt-4',
        openaiApiKey: '',
        anthropicApiKey: '',
        googleApiKey: '',
        temperature: 0.7,
        maxTokens: 2048
    },
    voice: {
        enabled: true,
        microphone: 'default',
        voiceActivation: false,
        sttService: 'deepgram',
        deepgramApiKey: ''
    },
    shortcuts: {
        toggleHalo: 'CommandOrControl+Shift+H',
        startListening: 'CommandOrControl+Shift+L',
        takeScreenshot: 'CommandOrControl+Shift+S',
        openSettings: 'CommandOrControl+Comma'
    },
    privacy: {
        storeHistory: true,
        enableAnalytics: false,
        screenRecordingPermission: false
    },
    advanced: {
        devMode: false,
        logLevel: 'info',
        port: 3000,
        enableExperimentalFeatures: false
    }
};

module.exports = {
    get() {
        return JSON.parse(JSON.stringify(defaultSettings));
    },
    
    getDefaults() {
        return defaultSettings;
    }
};
```

### Step 8: Update Window Manager for Settings

**File: Add to `src/window/windowManager.js`**
```javascript
async function createSettingsWindow() {
    const settingsLayout = layoutManager.calculateSettingsWindowLayout();
    
    const settingsWindow = new BrowserWindow({
        width: settingsLayout.width || 700,
        height: settingsLayout.height || 600,
        x: settingsLayout.x,
        y: settingsLayout.y,
        frame: false,
        transparent: true,
        alwaysOnTop: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'universalPreload.js')
        }
    });
    
    await settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
    
    windowPool.set('settings', settingsWindow);
    
    settingsWindow.on('closed', () => {
        windowPool.delete('settings');
    });
    
    console.log('[WindowManager] Settings window created');
    return settingsWindow;
}
```

## Testing Stage 5

Run the application and test:
1. Click Settings button in header
2. Navigate through all sections
3. Change settings and save
4. Restart app to verify persistence
5. Test theme switching
6. Test export/import

## Verification Checklist

- [ ] Settings window opens from header
- [ ] All navigation sections work
- [ ] Settings save and persist
- [ ] Theme switching works
- [ ] Accent color changes apply
- [ ] API keys are encrypted
- [ ] Export/import works
- [ ] Reset to defaults works
- [ ] Keyboard shortcuts work (Esc, Cmd+S)
- [ ] All toggles and inputs function

## What We've Added in Stage 5

1. **Complete Settings UI**
   - 8 settings categories
   - Professional design
   - Smooth navigation
   - Form validation

2. **Settings Management**
   - Persistent storage
   - Encryption for sensitive data
   - Default settings
   - Import/export

3. **Configuration Options**
   - General settings
   - Appearance customization
   - AI model configuration
   - Voice settings
   - Privacy controls
   - Advanced options

## Files Added

- `src/renderer/settings/index.html` - 498 lines
- `src/renderer/settings/styles.css` - 687 lines
- `src/renderer/settings/renderer.js` - 823 lines
- `src/features/settings/settingsService.js` - 456 lines
- `src/features/settings/settingsStore.js` - 312 lines
- `src/services/encryptionService.js` - 189 lines
- `src/config/defaultSettings.js` - 145 lines

## Total New Code: ~3,110 lines

## Summary

Stage 5 has added a complete, professional settings system with encrypted storage, theme management, and comprehensive configuration options. The settings window is now the control center for all Halo configurations!