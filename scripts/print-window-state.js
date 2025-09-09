const fs = require('fs');
const path = require('node:path');

function main() {
    try {
        // Allow userData path override via env for testing
        const userData = process.env.CLUEL_USER_DATA || path.join(require('os').homedir(), 'Library', 'Application Support', 'clueless');
        const file = path.join(userData, 'window-state.json');
        if (!fs.existsSync(file)) {
            console.error('[print-window-state] No window-state.json found at', file);
            process.exit(1);
        }
        const raw = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(raw || '{}');
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('[print-window-state] Error:', e.message);
        process.exit(1);
    }
}

if (require.main === module) main();


