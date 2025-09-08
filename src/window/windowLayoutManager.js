class WindowLayoutManager {
    constructor() {
        this.screenBounds = null;
        this.windowSpacing = 20;
        this.updateScreenBounds();
        
        // Listen for screen changes
        const { screen } = require('electron');
        screen.on('display-added', this.updateScreenBounds.bind(this));
        screen.on('display-removed', this.updateScreenBounds.bind(this));
        screen.on('display-metrics-changed', this.updateScreenBounds.bind(this));
    }

    updateScreenBounds() {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        this.screenBounds = primaryDisplay.workArea;
        console.log('[WindowLayoutManager] Screen bounds:', this.screenBounds);
    }

    calculateFeatureWindowLayout(visibleWindows, headerBounds = null) {
        this.updateScreenBounds();
        
        // Calculate layouts with header position if available
        const layouts = {
            listen: this.calculateListenWindowLayout(headerBounds),
            ask: this.calculateAskWindowLayout(headerBounds),
            settings: this.calculateSettingsWindowLayout(headerBounds)
        };

        // Filter to only include visible windows
        const visibleLayouts = {};
        Object.keys(visibleWindows).forEach(windowName => {
            if (layouts[windowName]) {
                visibleLayouts[windowName] = layouts[windowName];
            }
        });

        return visibleLayouts;
    }

    calculateListenWindowLayout(headerBounds = null) {
        this.updateScreenBounds();
        const width = 400;
        const height = 400;
        const minWidth = 300;
        const minHeight = 300;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, this.screenBounds.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, this.screenBounds.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            // Position below header, aligned to the left side
            x = headerBounds.x;
            y = headerBounds.y + headerBounds.height + 10; // 10px gap below header
        } else {
            // Fallback positioning - bottom left
            x = this.screenBounds.x + this.windowSpacing;
            y = this.screenBounds.y + this.screenBounds.height - finalHeight - this.windowSpacing;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(this.screenBounds.x, Math.min(x, this.screenBounds.x + this.screenBounds.width - finalWidth));
        y = Math.max(this.screenBounds.y, Math.min(y, this.screenBounds.y + this.screenBounds.height - finalHeight));
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    calculateAskWindowLayout(headerBounds = null) {
        this.updateScreenBounds();
        const width = 500;
        const height = 600;
        const minWidth = 400;
        const minHeight = 400;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, this.screenBounds.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, this.screenBounds.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            // Position below header, aligned to the right side
            x = headerBounds.x + headerBounds.width - finalWidth;
            y = headerBounds.y + headerBounds.height + 10; // 10px gap below header
        } else {
            // Fallback positioning - top right
            x = this.screenBounds.x + this.screenBounds.width - finalWidth - this.windowSpacing;
            y = this.screenBounds.y + this.windowSpacing;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(this.screenBounds.x, Math.min(x, this.screenBounds.x + this.screenBounds.width - finalWidth));
        y = Math.max(this.screenBounds.y, Math.min(y, this.screenBounds.y + this.screenBounds.height - finalHeight));
        
        return { x, y, width: finalWidth, height: finalHeight };
    }

    calculateSettingsWindowLayout(headerBounds = null) {
        this.updateScreenBounds();
        const width = 600;
        const height = 700;
        const minWidth = 400;
        const minHeight = 500;
        
        // Clamp dimensions
        const finalWidth = Math.max(minWidth, Math.min(width, this.screenBounds.width - 2 * this.windowSpacing));
        const finalHeight = Math.max(minHeight, Math.min(height, this.screenBounds.height - 2 * this.windowSpacing));
        
        let x, y;
        
        if (headerBounds) {
            // Position below header, centered horizontally with header
            x = headerBounds.x + (headerBounds.width - finalWidth) / 2;
            y = headerBounds.y + headerBounds.height + 10; // 10px gap below header
        } else {
            // Fallback positioning - center of screen
            x = this.screenBounds.x + (this.screenBounds.width - finalWidth) / 2;
            y = this.screenBounds.y + (this.screenBounds.height - finalHeight) / 2;
        }
        
        // Ensure window stays within screen bounds
        x = Math.max(this.screenBounds.x, Math.min(x, this.screenBounds.x + this.screenBounds.width - finalWidth));
        y = Math.max(this.screenBounds.y, Math.min(y, this.screenBounds.y + this.screenBounds.height - finalHeight));
        
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
}

module.exports = WindowLayoutManager;
