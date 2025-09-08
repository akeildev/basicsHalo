class ShortcutsService {
    constructor() {
        this.shortcuts = new Map();
    }

    register(accelerator, callback) {
        this.shortcuts.set(accelerator, callback);
    }

    unregister(accelerator) {
        this.shortcuts.delete(accelerator);
    }

    unregisterAll() {
        this.shortcuts.clear();
    }

    getShortcuts() {
        return Array.from(this.shortcuts.keys());
    }
}

module.exports = new ShortcutsService();
