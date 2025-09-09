const { ipcMain, BrowserWindow } = require('electron');
const Store = require('electron-store');
const authService = require('../common/services/authService');
const { windowPool } = require('../../window/windowManager');

// Configuration constants for notifications
const NOTIFICATION_CONFIG = {
    RELEVANT_WINDOW_TYPES: ['settings', 'header'],
    DEBOUNCE_DELAY: 300,
};

// Default keybinds configuration per platform
const DEFAULT_KEYBINDS = {
    mac: {
        moveUp: 'Cmd+Up',
        moveDown: 'Cmd+Down',
        moveLeft: 'Cmd+Left',
        moveRight: 'Cmd+Right',
        toggleVisibility: 'Cmd+\\',
        toggleClickThrough: 'Cmd+M',
        nextStep: 'Cmd+Enter',
        manualScreenshot: 'Cmd+Shift+S',
        previousResponse: 'Cmd+[',
        nextResponse: 'Cmd+]',
        scrollUp: 'Cmd+Shift+Up',
        scrollDown: 'Cmd+Shift+Down',
    },
    windows: {
        moveUp: 'Ctrl+Up',
        moveDown: 'Ctrl+Down',
        moveLeft: 'Ctrl+Left',
        moveRight: 'Ctrl+Right',
        toggleVisibility: 'Ctrl+\\',
        toggleClickThrough: 'Ctrl+M',
        nextStep: 'Ctrl+Enter',
        manualScreenshot: 'Ctrl+Shift+S',
        previousResponse: 'Ctrl+[',
        nextResponse: 'Ctrl+]',
        scrollUp: 'Ctrl+Shift+Up',
        scrollDown: 'Ctrl+Shift+Down',
    }
};

// Initialize electron-store with configuration
const store = new Store({
    name: 'pickle-clueless-settings',
    defaults: {
        users: {}
    }
});

// Window targeting system for efficient notifications
class WindowNotificationManager {
    constructor() {
        this.pendingNotifications = new Map();
    }

    notifyRelevantWindows(event, data = null, options = {}) {
        const { 
            windowTypes = NOTIFICATION_CONFIG.RELEVANT_WINDOW_TYPES,
            debounce = NOTIFICATION_CONFIG.DEBOUNCE_DELAY 
        } = options;

        if (debounce > 0) {
            this.debounceNotification(event, () => {
                this.sendToTargetWindows(event, data, windowTypes);
            }, debounce);
        } else {
            this.sendToTargetWindows(event, data, windowTypes);
        }
    }

    sendToTargetWindows(event, data, windowTypes) {
        const relevantWindows = this.getRelevantWindows(windowTypes);
        if (relevantWindows.length === 0) {
            return;
        }
        relevantWindows.forEach(win => {
            try {
                if (data !== null && data !== undefined) {
                    win.webContents.send(event, data);
                } else {
                    win.webContents.send(event);
                }
            } catch {}
        });
    }

    getRelevantWindows(windowTypes) {
        const allWindows = BrowserWindow.getAllWindows();
        const relevant = [];
        allWindows.forEach(win => {
            if (win.isDestroyed()) return;
            for (const [name, pooled] of windowPool || []) {
                if (pooled === win && windowTypes.includes(name)) {
                    if (name === 'settings' || win.isVisible()) {
                        relevant.push(win);
                    }
                    break;
                }
            }
        });
        return relevant;
    }

    debounceNotification(key, fn, delay) {
        if (this.pendingNotifications.has(key)) {
            clearTimeout(this.pendingNotifications.get(key));
        }
        const id = setTimeout(() => {
            fn();
            this.pendingNotifications.delete(key);
        }, delay);
        this.pendingNotifications.set(key, id);
    }
}

const windowNotificationManager = new WindowNotificationManager();

function getDefaultSettings() {
    const isMac = process.platform === 'darwin';
    return {
        profile: 'school',
        language: 'en',
        screenshotInterval: '5000',
        imageQuality: '0.8',
        layoutMode: 'stacked',
        keybinds: isMac ? DEFAULT_KEYBINDS.mac : DEFAULT_KEYBINDS.windows,
        throttleTokens: 500,
        maxTokens: 2000,
        throttlePercent: 80,
        googleSearchEnabled: false,
        backgroundTransparency: 0.5,
        fontSize: 14,
        contentProtection: true
    };
}

class SettingsService {
    constructor() {
        this.currentSettings = null;
    }

    async getSettings() {
        try {
            const uid = authService.getCurrentUserId && authService.getCurrentUserId();
            const userSettingsKey = uid ? `users.${uid}` : 'users.default';
            const defaults = getDefaultSettings();
            const saved = store.get(userSettingsKey, {});
            this.currentSettings = { ...defaults, ...saved };
            return this.currentSettings;
        } catch (err) {
            console.error('[SettingsService] Error getting settings:', err);
            return getDefaultSettings();
        }
    }

    async saveSettings(settings) {
        try {
            const uid = authService.getCurrentUserId && authService.getCurrentUserId();
            const userSettingsKey = uid ? `users.${uid}` : 'users.default';
            const currentSaved = store.get(userSettingsKey, {});
            const merged = { ...currentSaved, ...settings };
            store.set(userSettingsKey, merged);
            this.currentSettings = merged;
            windowNotificationManager.notifyRelevantWindows('settings-updated', this.currentSettings);
            return { success: true };
        } catch (err) {
            console.error('[SettingsService] Error saving settings:', err);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new SettingsService();
