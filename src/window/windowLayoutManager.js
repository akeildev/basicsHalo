// Helper to get display nearest a window's center
function getCurrentDisplay(window) {
    try {
        const { screen } = require('electron');
        if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();
        const b = window.getBounds();
        const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        return screen.getDisplayNearestPoint(center);
    } catch {
        return null;
    }
}

class WindowLayoutManager {
    constructor() {
        this.screenBounds = null;
        this.windowSpacing = 4; // Reduced from 20 to minimize gaps
        this.windowPool = null; // Will be set by windowManager
        this.updateScreenBounds();
        
        // Listen for screen changes
        const { screen } = require('electron');
        screen.on('display-added', this.updateScreenBounds.bind(this));
        screen.on('display-removed', this.updateScreenBounds.bind(this));
        screen.on('display-metrics-changed', this.updateScreenBounds.bind(this));
    }
    
    setWindowPool(windowPool) {
        this.windowPool = windowPool;
    }

    updateScreenBounds() {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        this.screenBounds = primaryDisplay.workArea;
        console.log('[WindowLayoutManager] Screen bounds:', this.screenBounds);
    }

    // Decide layout strategy based on space around header
    determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY) {
        const headerRelX = headerBounds.x - workAreaX;
        const headerRelY = headerBounds.y - workAreaY;

        const spaceBelow = screenHeight - (headerRelY + headerBounds.height);
        const spaceAbove = headerRelY;
        const spaceLeft = headerRelX;
        const spaceRight = screenWidth - (headerRelX + headerBounds.width);

        if (spaceBelow >= 400) {
            return { name: 'below', primary: 'below', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (spaceAbove >= 400) {
            return { name: 'above', primary: 'above', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (relativeX < 0.3 && spaceRight >= 800) {
            return { name: 'right-side', primary: 'right', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else if (relativeX > 0.7 && spaceLeft >= 800) {
            return { name: 'left-side', primary: 'left', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else {
            return { name: 'adaptive', primary: spaceBelow > spaceAbove ? 'below' : 'above', secondary: spaceRight > spaceLeft ? 'right' : 'left' };
        }
    }

    calculateFeatureWindowLayout(visibility, headerBoundsOverride = null) {
        this.updateScreenBounds();

        const { screen } = require('electron');
        const header = this.windowPool && this.windowPool.get ? this.windowPool.get('header') : null;
        const headerBounds = headerBoundsOverride || (header && !header.isDestroyed() ? header.getBounds() : null);
        if (!headerBounds) return {};

        // Determine which display/work area to use
        let display;
        if (headerBoundsOverride) {
            const center = { x: headerBounds.x + headerBounds.width / 2, y: headerBounds.y + headerBounds.height / 2 };
            display = screen.getDisplayNearestPoint(center);
        } else {
            display = getCurrentDisplay(header) || screen.getPrimaryDisplay();
        }
        const { width: screenWidth, height: screenHeight, x: workAreaX, y: workAreaY } = display.workArea;

        const ask = this.windowPool && this.windowPool.get ? this.windowPool.get('ask') : null;
        const listen = this.windowPool && this.windowPool.get ? this.windowPool.get('listen') : null;
        const settings = this.windowPool && this.windowPool.get ? this.windowPool.get('settings') : null;

        const askVis = visibility && visibility.ask && ask && !ask.isDestroyed();
        const listenVis = visibility && visibility.listen && listen && !listen.isDestroyed();
        const settingsVis = visibility && visibility.settings && settings && !settings.isDestroyed();
        if (!askVis && !listenVis && !settingsVis) return {};

        const PAD = 4; // Reduced padding for tighter window grouping
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;
        const relativeX = headerCenterXRel / screenWidth;
        const relativeY = (headerBounds.y - workAreaY) / screenHeight;
        const strategy = this.determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY);

        const askB = askVis ? ask.getBounds() : null;
        const listenB = listenVis ? listen.getBounds() : null;
        const settingsB = settingsVis ? settings.getBounds() : null;

        const layout = {};

        // Handle different combinations of visible windows
        if (askVis && listenVis && settingsVis) {
            // All three windows visible - arrange in a row
            const totalWidth = askB.width + listenB.width + settingsB.width + 2 * PAD;
            let startX = headerCenterXRel - totalWidth / 2;

            // Ensure within bounds
            if (startX < PAD) startX = PAD;
            if (startX + totalWidth > screenWidth - PAD) startX = screenWidth - PAD - totalWidth;

            layout.ask = {
                x: Math.round(startX + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: askB.width,
                height: askB.height
            };
            layout.listen = {
                x: Math.round(startX + askB.width + PAD + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: listenB.width,
                height: listenB.height
            };
            layout.settings = {
                x: Math.round(startX + askB.width + listenB.width + 2 * PAD + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: settingsB.width,
                height: settingsB.height
            };
        } else if (askVis && listenVis) {
            // Start with ask centered under header; listen to the left
            let askXRel = headerCenterXRel - (askB.width / 2);
            let listenXRel = askXRel - listenB.width - PAD;

            // Left boundary collision
            if (listenXRel < PAD) {
                listenXRel = PAD;
                askXRel = listenXRel + listenB.width + PAD;
            }
            // Right boundary collision
            if (askXRel + askB.width > screenWidth - PAD) {
                askXRel = screenWidth - PAD - askB.width;
                listenXRel = askXRel - listenB.width - PAD;
            }

            if (strategy.primary === 'above') {
                const windowBottomAbs = headerBounds.y - PAD;
                layout.ask = {
                    x: Math.round(askXRel + workAreaX),
                    y: Math.round(windowBottomAbs - askB.height),
                    width: askB.width,
                    height: askB.height
                };
                layout.listen = {
                    x: Math.round(listenXRel + workAreaX),
                    y: Math.round(windowBottomAbs - listenB.height),
                    width: listenB.width,
                    height: listenB.height
                };
            } else {
                const yAbs = headerBounds.y + headerBounds.height + PAD;
                layout.ask = {
                    x: Math.round(askXRel + workAreaX),
                    y: Math.round(yAbs),
                    width: askB.width,
                    height: askB.height
                };
                layout.listen = {
                    x: Math.round(listenXRel + workAreaX),
                    y: Math.round(yAbs),
                    width: listenB.width,
                    height: listenB.height
                };
            }
        } else if (askVis && settingsVis) {
            // Ask and settings visible - center ask, settings to the right
            let askXRel = headerCenterXRel - (askB.width / 2);
            let settingsXRel = askXRel + askB.width + PAD;

            // Right boundary collision
            if (settingsXRel + settingsB.width > screenWidth - PAD) {
                settingsXRel = screenWidth - PAD - settingsB.width;
                askXRel = settingsXRel - askB.width - PAD;
            }

            layout.ask = {
                x: Math.round(askXRel + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: askB.width,
                height: askB.height
            };
            layout.settings = {
                x: Math.round(settingsXRel + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: settingsB.width,
                height: settingsB.height
            };
        } else if (listenVis && settingsVis) {
            // Listen and settings visible - center listen, settings to the right
            let listenXRel = headerCenterXRel - (listenB.width / 2);
            let settingsXRel = listenXRel + listenB.width + PAD;

            // Right boundary collision
            if (settingsXRel + settingsB.width > screenWidth - PAD) {
                settingsXRel = screenWidth - PAD - settingsB.width;
                listenXRel = settingsXRel - listenB.width - PAD;
            }

            layout.listen = {
                x: Math.round(listenXRel + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: listenB.width,
                height: listenB.height
            };
            layout.settings = {
                x: Math.round(settingsXRel + workAreaX),
                y: Math.round(headerBounds.y + headerBounds.height + PAD),
                width: settingsB.width,
                height: settingsB.height
            };
        } else {
            // Only one window visible
            const winName = askVis ? 'ask' : listenVis ? 'listen' : 'settings';
            const winB = askVis ? askB : listenVis ? listenB : settingsB;
            if (!winB) return {};

            let xRel = headerCenterXRel - winB.width / 2;
            xRel = Math.max(PAD, Math.min(screenWidth - winB.width - PAD, xRel));

            let yPos;
            if (strategy.primary === 'above') {
                yPos = (headerBounds.y - workAreaY) - PAD - winB.height;
            } else {
                yPos = (headerBounds.y - workAreaY) + headerBounds.height + PAD;
            }

            layout[winName] = {
                x: Math.round(xRel + workAreaX),
                y: Math.round(yPos + workAreaY),
                width: winB.width,
                height: winB.height
            };
        }

        return layout;
    }

    calculateListenWindowLayout(headerBounds = null, strategy = { name: 'below', primary: 'below' }, workArea = this.screenBounds) {
        this.updateScreenBounds();
        const width = 360; // Slightly wider for better readability
        const height = 220; // Increased height for less compressed look
        const minWidth = 320;
        const minHeight = 200;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, workArea.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, workArea.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            if (strategy.primary === 'below') {
                x = headerBounds.x;
                y = headerBounds.y + headerBounds.height + 4; // Reduced gap from 10 to 4
            } else if (strategy.primary === 'above') {
                x = headerBounds.x;
                y = headerBounds.y - finalHeight - 4; // Reduced gap
            } else if (strategy.primary === 'right') {
                x = headerBounds.x + headerBounds.width + 4; // Reduced gap
                y = headerBounds.y;
            } else {
                x = headerBounds.x - finalWidth - 4; // Reduced gap
                y = headerBounds.y;
            }
        } else {
            // Fallback positioning - bottom left
            x = workArea.x + this.windowSpacing;
            y = workArea.y + workArea.height - finalHeight - this.windowSpacing;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - finalWidth));
        y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - finalHeight));
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    calculateAskWindowLayout(headerBounds = null, strategy = { name: 'below', primary: 'below' }, workArea = this.screenBounds) {
        this.updateScreenBounds();
        const width = 400; // Reduced from 500 for more compact design
        const height = 480; // Reduced from 600 for modular appearance
        const minWidth = 350;
        const minHeight = 400;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, workArea.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, workArea.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            if (strategy.primary === 'below') {
                x = headerBounds.x + headerBounds.width - finalWidth;
                y = headerBounds.y + headerBounds.height + 4; // Reduced gap from 10 to 4
            } else if (strategy.primary === 'above') {
                x = headerBounds.x + headerBounds.width - finalWidth;
                y = headerBounds.y - finalHeight - 4; // Reduced gap
            } else if (strategy.primary === 'right') {
                x = headerBounds.x + headerBounds.width + 4; // Reduced gap
                y = headerBounds.y;
            } else {
                x = headerBounds.x - finalWidth - 4; // Reduced gap
                y = headerBounds.y;
            }
        } else {
            // Fallback positioning - top right
            x = workArea.x + workArea.width - finalWidth - this.windowSpacing;
            y = workArea.y + this.windowSpacing;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - finalWidth));
        y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - finalHeight));
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    calculateSettingsWindowLayout(headerBounds = null, strategy = { name: 'below', primary: 'below' }, workArea = this.screenBounds) {
        this.updateScreenBounds();
        const width = 420; // Reduced from 600
        const height = 500; // Reduced from 700 
        const minWidth = 380;
        const minHeight = 450;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, workArea.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, workArea.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            // Prefer below/above; align near right edge (settings button area)
            if (strategy.primary === 'below') {
                x = headerBounds.x + Math.max(0, headerBounds.width - finalWidth);
                y = headerBounds.y + headerBounds.height + 4; // Reduced gap from 10 to 4
            } else if (strategy.primary === 'above') {
                x = headerBounds.x + Math.max(0, headerBounds.width - finalWidth);
                y = headerBounds.y - finalHeight - 4; // Reduced gap
            } else if (strategy.primary === 'right') {
                x = headerBounds.x + headerBounds.width + 4; // Reduced gap
                y = headerBounds.y;
            } else {
                x = headerBounds.x - finalWidth - 4; // Reduced gap
                y = headerBounds.y;
            }
        } else {
            // Fallback positioning - center of screen
            x = workArea.x + (workArea.width - finalWidth) / 2;
            y = workArea.y + (workArea.height - finalHeight) / 2;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - finalWidth));
        y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - finalHeight));
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    calculateHeaderWindowLayout() {
        this.updateScreenBounds();
        const width = 400;
        const height = 70;
        
        // Ensure header fits on screen
        const finalWidth = Math.min(width, this.screenBounds.width - 2 * this.windowSpacing);
        const finalHeight = height;
        
        // Center horizontally, position at top
        const x = Math.max(this.screenBounds.x, Math.min(
            this.screenBounds.x + (this.screenBounds.width - finalWidth) / 2,
            this.screenBounds.x + this.screenBounds.width - finalWidth
        ));
        const y = this.screenBounds.y + this.windowSpacing;
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    // Settings anchored position near header button with clamping
    calculateSettingsWindowPosition() {
        try {
            const header = this.windowPool && this.windowPool.get ? this.windowPool.get('header') : null;
            const settings = this.windowPool && this.windowPool.get ? this.windowPool.get('settings') : null;
            if (!header || header.isDestroyed() || !settings || settings.isDestroyed()) return null;
            const headerBounds = header.getBounds();
            const settingsBounds = settings.getBounds();
            const display = getCurrentDisplay(header);
            const { x: workAreaX, y: workAreaY, width: screenWidth, height: screenHeight } = display.workArea;
            const PAD = 4; // Reduced from 5 to match other spacing
            const buttonPadding = 170;
            const x = headerBounds.x + headerBounds.width - settingsBounds.width + buttonPadding;
            const y = headerBounds.y + headerBounds.height + PAD;
            const clampedX = Math.max(workAreaX + 10, Math.min(workAreaX + screenWidth - settingsBounds.width - 10, x));
            const clampedY = Math.max(workAreaY + 10, Math.min(workAreaY + screenHeight - settingsBounds.height - 10, y));
            return { x: Math.round(clampedX), y: Math.round(clampedY) };
        } catch {
            return null;
        }
    }

    calculateHeaderResize(header, { width, height }) {
        if (!header) return null;
        const currentBounds = header.getBounds();
        const centerX = currentBounds.x + currentBounds.width / 2;
        const newX = Math.round(centerX - width / 2);
        const display = getCurrentDisplay(header);
        const { x: workAreaX, width: workAreaWidth } = display.workArea;
        const clampedX = Math.max(workAreaX, Math.min(workAreaX + workAreaWidth - width, newX));
        return { x: clampedX, y: currentBounds.y, width, height };
    }

    calculateClampedPosition(header, { x: newX, y: newY }) {
        const { screen } = require('electron');
        if (!header) return null;
        const targetDisplay = screen.getDisplayNearestPoint({ x: newX, y: newY });
        const { x: workAreaX, y: workAreaY, width, height } = targetDisplay.workArea;
        const headerBounds = header.getBounds();
        const clampedX = Math.max(workAreaX, Math.min(newX, workAreaX + width - headerBounds.width));
        const clampedY = Math.max(workAreaY, Math.min(newY, workAreaY + height - headerBounds.height));
        return { x: clampedX, y: clampedY };
    }

    calculateWindowHeightAdjustment(senderWindow, targetHeight) {
        if (!senderWindow) return null;
        const currentBounds = senderWindow.getBounds();
        const minHeight = senderWindow.getMinimumSize()[1];
        const maxHeight = senderWindow.getMaximumSize()[1];
        let adjustedHeight = Math.max(minHeight, targetHeight);
        if (maxHeight > 0) {
            adjustedHeight = Math.min(maxHeight, adjustedHeight);
        }
        return { ...currentBounds, height: adjustedHeight };
    }

    calculateStepMovePosition(header, direction) {
        if (!header) return null;
        const currentBounds = header.getBounds();
        const stepSize = 80;
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;
        switch (direction) {
            case 'left': targetX -= stepSize; break;
            case 'right': targetX += stepSize; break;
            case 'up': targetY -= stepSize; break;
            case 'down': targetY += stepSize; break;
        }
        return this.calculateClampedPosition(header, { x: targetX, y: targetY });
    }

    calculateEdgePosition(header, direction) {
        const { screen } = require('electron');
        if (!header) return null;
        const display = getCurrentDisplay(header) || screen.getPrimaryDisplay();
        const { workArea } = display;
        const currentBounds = header.getBounds();
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;
        switch (direction) {
            case 'left': targetX = workArea.x; break;
            case 'right': targetX = workArea.x + workArea.width - currentBounds.width; break;
            case 'up': targetY = workArea.y; break;
            case 'down': targetY = workArea.y + workArea.height - currentBounds.height; break;
        }
        return { x: targetX, y: targetY };
    }

    calculateShortcutSettingsWindowPosition() {
        const header = this.windowPool && this.windowPool.get ? this.windowPool.get('header') : null;
        const shortcutSettings = this.windowPool && this.windowPool.get ? this.windowPool.get('shortcut-settings') : null;
        if (!header || !shortcutSettings) return null;

        const headerBounds = header.getBounds();
        const shortcutBounds = shortcutSettings.getBounds();
        const display = getCurrentDisplay(header);
        const { workArea } = display;

        let newX = Math.round(headerBounds.x + (headerBounds.width / 2) - (shortcutBounds.width / 2));
        let newY = Math.round(headerBounds.y);

        newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - shortcutBounds.width));
        newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - shortcutBounds.height));

        return { x: newX, y: newY, width: shortcutBounds.width, height: shortcutBounds.height };
    }

    calculateNewPositionForDisplay(window, targetDisplayId) {
        const { screen } = require('electron');
        if (!window) return null;
        const targetDisplay = screen.getAllDisplays().find(d => d.id === targetDisplayId);
        if (!targetDisplay) return null;
        const currentBounds = window.getBounds();
        const currentDisplay = getCurrentDisplay(window);
        if (currentDisplay && currentDisplay.id === targetDisplay.id) return { x: currentBounds.x, y: currentBounds.y };
        const relativeX = (currentBounds.x - currentDisplay.workArea.x) / currentDisplay.workArea.width;
        const relativeY = (currentBounds.y - currentDisplay.workArea.y) / currentDisplay.workArea.height;
        const targetX = targetDisplay.workArea.x + targetDisplay.workArea.width * relativeX;
        const targetY = targetDisplay.workArea.y + targetDisplay.workArea.height * relativeY;
        const clampedX = Math.max(targetDisplay.workArea.x, Math.min(targetX, targetDisplay.workArea.x + targetDisplay.workArea.width - currentBounds.width));
        const clampedY = Math.max(targetDisplay.workArea.y, Math.min(targetY, targetDisplay.workArea.y + targetDisplay.workArea.height - currentBounds.height));
        return { x: Math.round(clampedX), y: Math.round(clampedY) };
    }

    boundsOverlap(bounds1, bounds2) {
        const margin = 10;
        return !(
            bounds1.x + bounds1.width + margin < bounds2.x ||
            bounds2.x + bounds2.width + margin < bounds1.x ||
            bounds1.y + bounds1.height + margin < bounds2.y ||
            bounds2.y + bounds2.height + margin < bounds1.y
        );
    }
}

module.exports = WindowLayoutManager;
