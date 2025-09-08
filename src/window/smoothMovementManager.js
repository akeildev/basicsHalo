class SmoothMovementManager {
    constructor() {
        this.animations = new Map();
        this.animationId = null;
    }

    animateWindow(window, targetBounds, duration = 300) {
        if (!window || window.isDestroyed()) {
            return Promise.resolve();
        }

        const currentBounds = window.getBounds();
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function (ease-out)
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                const newBounds = {
                    x: Math.round(currentBounds.x + (targetBounds.x - currentBounds.x) * easeOut),
                    y: Math.round(currentBounds.y + (targetBounds.y - currentBounds.y) * easeOut),
                    width: Math.round(currentBounds.width + (targetBounds.width - currentBounds.width) * easeOut),
                    height: Math.round(currentBounds.height + (targetBounds.height - currentBounds.height) * easeOut)
                };
                
                if (!window.isDestroyed()) {
                    window.setBounds(newBounds);
                }
                
                if (progress < 1) {
                    this.animationId = requestAnimationFrame(animate);
                } else {
                    this.animationId = null;
                    resolve();
                }
            };
            
            animate();
        });
    }

    stopAllAnimations() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.animations.clear();
    }

    fadeIn(window, duration = 200) {
        if (!window || window.isDestroyed()) {
            return Promise.resolve();
        }

        window.setOpacity(0);
        window.show();
        
        return new Promise((resolve) => {
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                if (!window.isDestroyed()) {
                    window.setOpacity(progress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            animate();
        });
    }

    fadeOut(window, duration = 200) {
        if (!window || window.isDestroyed()) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const startTime = Date.now();
            const startOpacity = window.getOpacity();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                if (!window.isDestroyed()) {
                    window.setOpacity(startOpacity * (1 - progress));
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    if (!window.isDestroyed()) {
                        window.hide();
                    }
                    resolve();
                }
            };
            
            animate();
        });
    }
}

module.exports = SmoothMovementManager;
