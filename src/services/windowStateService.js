const fs = require('fs');
const path = require('node:path');
const { app, screen } = require('electron');

// Simple per-window debouncers
const debounceTimers = new Map();

let stateFilePath = null;
let cachedState = null;
let windowPoolRef = null;
let layoutManagerRef = null;

function init(windowPool, layoutManager) {
    windowPoolRef = windowPool;
    layoutManagerRef = layoutManager;
    try {
        const dir = app.getPath('userData');
        stateFilePath = path.join(dir, 'window-state.json');
    } catch {
        stateFilePath = null;
    }
    // Prime cache
    loadState();
}

function loadState() {
    if (cachedState) return cachedState;
    if (!stateFilePath) {
        cachedState = {};
        return cachedState;
    }
    try {
        if (fs.existsSync(stateFilePath)) {
            const raw = fs.readFileSync(stateFilePath, 'utf8');
            cachedState = JSON.parse(raw || '{}');
        } else {
            cachedState = {};
        }
    } catch {
        cachedState = {};
    }
    return cachedState;
}

function writeState(stateObj) {
    if (!stateFilePath) return;
    try {
        fs.writeFileSync(stateFilePath, JSON.stringify(stateObj, null, 2), 'utf8');
    } catch {
        // ignore
    }
}

function debounce(name, fn, delay = 300) {
    if (debounceTimers.has(name)) clearTimeout(debounceTimers.get(name));
    const t = setTimeout(() => {
        debounceTimers.delete(name);
        fn();
    }, delay);
    debounceTimers.set(name, t);
}

function getDisplayIdForWindow(win) {
    try {
        const d = screen.getDisplayNearestPoint(centerOf(win));
        return d ? d.id : (screen.getPrimaryDisplay() ? screen.getPrimaryDisplay().id : null);
    } catch {
        return null;
    }
}

function centerOf(win) {
    const b = win.getBounds();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function saveWindowState(name, win) {
    if (!win || win.isDestroyed()) return;
    const state = loadState();
    debounce(`save-${name}`, () => {
        try {
            const b = win.getBounds();
            state[name] = {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                displayId: getDisplayIdForWindow(win),
                lastUpdatedAt: Date.now()
            };
            writeState(state);
        } catch {
            // ignore
        }
    }, 300);
}

function restoreWindowState(name, win) {
    if (!win || win.isDestroyed()) return false;
    const state = loadState();
    const rec = state[name];
    if (!rec) return false;
    try {
        const displays = screen.getAllDisplays();
        let target = rec.displayId ? displays.find(d => d.id === rec.displayId) : null;
        if (!target) target = screen.getPrimaryDisplay();
        const work = target.workArea;
        const width = rec.width || win.getBounds().width;
        const height = rec.height || win.getBounds().height;
        const x = clamp(rec.x, work.x, work.x + work.width - width);
        const y = clamp(rec.y, work.y, work.y + work.height - height);
        win.setBounds({ x, y, width, height });
        return true;
    } catch {
        return false;
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function updateWindowDisplay(name, displayId) {
    const state = loadState();
    if (!state[name]) state[name] = {};
    state[name].displayId = displayId;
    state[name].lastUpdatedAt = Date.now();
    writeState(state);
}

function attachListeners(name, win) {
    if (!win || win.isDestroyed()) return;
    const save = () => saveWindowState(name, win);
    win.on('moved', save);
    win.on('resized', save);
    win.on('show', save);
    win.on('hide', save);
    win.on('closed', () => saveWindowState(name, win));
}

module.exports = {
    init,
    loadState,
    saveWindowState,
    restoreWindowState,
    updateWindowDisplay,
    attachListeners
};


