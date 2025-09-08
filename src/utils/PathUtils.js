const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

/**
 * PathUtils - Cross-platform path management utilities
 * Provides consistent path resolution across Windows, macOS, and Linux
 */
class PathUtils {
    /**
     * Get the application data directory
     * @param {string} subPath - Optional subdirectory
     * @returns {string} Full path
     */
    static getUserDataPath(subPath = '') {
        const userDataPath = app.getPath('userData');
        return subPath ? path.join(userDataPath, subPath) : userDataPath;
    }

    /**
     * Get the logs directory
     * @param {string} fileName - Optional log file name
     * @returns {string} Full path
     */
    static getLogsPath(fileName = '') {
        const logsPath = app.getPath('logs');
        return fileName ? path.join(logsPath, fileName) : logsPath;
    }

    /**
     * Get the temp directory
     * @param {string} subPath - Optional subdirectory
     * @returns {string} Full path
     */
    static getTempPath(subPath = '') {
        const tempPath = app.getPath('temp');
        const appTemp = path.join(tempPath, 'halo');
        
        // Create app-specific temp directory
        this.ensureDirectoryExists(appTemp);
        
        return subPath ? path.join(appTemp, subPath) : appTemp;
    }

    /**
     * Get the database path
     * @param {string} dbName - Database file name
     * @returns {string} Full path to database file
     */
    static getDatabasePath(dbName = 'halo.db') {
        const dbDir = this.getUserDataPath('databases');
        this.ensureDirectoryExists(dbDir);
        return path.join(dbDir, dbName);
    }

    /**
     * Get the configuration directory
     * @param {string} fileName - Optional config file name
     * @returns {string} Full path
     */
    static getConfigPath(fileName = '') {
        const configDir = this.getUserDataPath('config');
        this.ensureDirectoryExists(configDir);
        return fileName ? path.join(configDir, fileName) : configDir;
    }

    /**
     * Get the cache directory
     * @param {string} subPath - Optional subdirectory
     * @returns {string} Full path
     */
    static getCachePath(subPath = '') {
        const cacheDir = this.getUserDataPath('cache');
        this.ensureDirectoryExists(cacheDir);
        return subPath ? path.join(cacheDir, subPath) : cacheDir;
    }

    /**
     * Get the downloads directory
     * @param {string} fileName - Optional file name
     * @returns {string} Full path
     */
    static getDownloadsPath(fileName = '') {
        const downloadsPath = app.getPath('downloads');
        return fileName ? path.join(downloadsPath, fileName) : downloadsPath;
    }

    /**
     * Get the documents directory
     * @param {string} subPath - Optional subdirectory
     * @returns {string} Full path
     */
    static getDocumentsPath(subPath = '') {
        const documentsPath = app.getPath('documents');
        const appDocs = path.join(documentsPath, 'Halo');
        
        // Create app-specific documents directory
        this.ensureDirectoryExists(appDocs);
        
        return subPath ? path.join(appDocs, subPath) : appDocs;
    }

    /**
     * Get the resources path (for bundled assets)
     * @param {string} resourcePath - Resource file path
     * @returns {string} Full path
     */
    static getResourcePath(resourcePath = '') {
        if (app.isPackaged) {
            // In production, resources are in the app.asar or resources folder
            return path.join(process.resourcesPath, 'app', resourcePath);
        } else {
            // In development, resources are in the project root
            return path.join(__dirname, '..', '..', resourcePath);
        }
    }

    /**
     * Get the assets path
     * @param {string} assetPath - Asset file path
     * @returns {string} Full path
     */
    static getAssetPath(assetPath = '') {
        return this.getResourcePath(path.join('assets', assetPath));
    }

    /**
     * Get all application paths
     * @returns {Object} Object containing all paths
     */
    static getAllPaths() {
        return {
            userData: app.getPath('userData'),
            config: this.getConfigPath(),
            logs: app.getPath('logs'),
            temp: this.getTempPath(),
            cache: this.getCachePath(),
            desktop: app.getPath('desktop'),
            documents: this.getDocumentsPath(),
            downloads: app.getPath('downloads'),
            home: app.getPath('home'),
            appData: app.getPath('appData'),
            database: this.getDatabasePath(),
            resources: this.getResourcePath()
        };
    }

    /**
     * Ensure a directory exists, create if it doesn't
     * @param {string} dirPath - Directory path
     * @returns {boolean} True if directory exists or was created
     */
    static ensureDirectoryExists(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log('[PathUtils] Created directory:', dirPath);
            }
            return true;
        } catch (error) {
            console.error('[PathUtils] Failed to create directory:', dirPath, error);
            return false;
        }
    }

    /**
     * Check if a path exists
     * @param {string} pathToCheck - Path to check
     * @returns {boolean} True if path exists
     */
    static exists(pathToCheck) {
        return fs.existsSync(pathToCheck);
    }

    /**
     * Check if a path is a directory
     * @param {string} pathToCheck - Path to check
     * @returns {boolean} True if path is a directory
     */
    static isDirectory(pathToCheck) {
        try {
            return fs.statSync(pathToCheck).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Check if a path is a file
     * @param {string} pathToCheck - Path to check
     * @returns {boolean} True if path is a file
     */
    static isFile(pathToCheck) {
        try {
            return fs.statSync(pathToCheck).isFile();
        } catch {
            return false;
        }
    }

    /**
     * Get file size
     * @param {string} filePath - File path
     * @returns {number} File size in bytes, or -1 if error
     */
    static getFileSize(filePath) {
        try {
            return fs.statSync(filePath).size;
        } catch {
            return -1;
        }
    }

    /**
     * Clean up old files in a directory
     * @param {string} dirPath - Directory path
     * @param {number} maxAgeMs - Maximum age in milliseconds
     * @returns {number} Number of files deleted
     */
    static cleanOldFiles(dirPath, maxAgeMs) {
        let deletedCount = 0;
        
        try {
            const now = Date.now();
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isFile() && (now - stats.mtimeMs) > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            
            if (deletedCount > 0) {
                console.log(`[PathUtils] Cleaned ${deletedCount} old files from ${dirPath}`);
            }
        } catch (error) {
            console.error('[PathUtils] Error cleaning old files:', error);
        }
        
        return deletedCount;
    }

    /**
     * Get directory size (recursive)
     * @param {string} dirPath - Directory path
     * @returns {number} Total size in bytes
     */
    static getDirectorySize(dirPath) {
        let totalSize = 0;
        
        try {
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isFile()) {
                    totalSize += stats.size;
                } else if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(filePath);
                }
            }
        } catch (error) {
            console.error('[PathUtils] Error calculating directory size:', error);
        }
        
        return totalSize;
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted string
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Sanitize filename for cross-platform compatibility
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    static sanitizeFilename(filename) {
        // Remove or replace invalid characters
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/^\.+/, '')
            .substring(0, 255); // Max filename length
    }

    /**
     * Get platform-specific paths
     * @returns {Object} Platform-specific paths
     */
    static getPlatformPaths() {
        const platform = process.platform;
        
        switch (platform) {
            case 'win32':
                return {
                    startup: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
                    programFiles: process.env['ProgramFiles'] || 'C:\\Program Files',
                    system32: 'C:\\Windows\\System32'
                };
            
            case 'darwin':
                return {
                    applications: '/Applications',
                    library: path.join(os.homedir(), 'Library'),
                    launchAgents: path.join(os.homedir(), 'Library', 'LaunchAgents')
                };
            
            case 'linux':
                return {
                    applications: '/usr/share/applications',
                    autostart: path.join(os.homedir(), '.config', 'autostart'),
                    localBin: path.join(os.homedir(), '.local', 'bin')
                };
            
            default:
                return {};
        }
    }
}

module.exports = PathUtils;