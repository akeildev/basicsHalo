const BaseService = require('./core/BaseService');
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');

/**
 * Enhanced Database Service with lifecycle management
 */
class DatabaseService extends BaseService {
    constructor() {
        super('DatabaseService', {
            isCritical: true,
            maxRetries: 3
        });
        
        this.db = null;
        this.dbPath = null;
        this.isConnected = false;
        this.activeTransactions = 0;
        this.queryStats = {
            total: 0,
            errors: 0,
            avgTime: 0
        };
    }
    
    /**
     * Initialize the database service
     */
    async onInitialize() {
        console.log('[DatabaseService] Initializing database...');
        
        // Setup database path
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'halo.db');
        
        // Ensure database exists
        await this.ensureDatabaseExists();
        
        // Initialize SQLite connection with retry logic
        await this.retryWithBackoff(async () => {
            await this.connectToDatabase();
        });
        
        // Setup database schema
        await this.setupSchema();
        
        // Verify database integrity
        await this.verifyIntegrity();
        
        console.log('[DatabaseService] Database initialized successfully');
    }
    
    /**
     * Start the database service
     */
    async onStart() {
        // Start maintenance tasks
        this.startMaintenanceTasks();
        
        // Warm up connection pool
        await this.warmupConnectionPool();
        
        console.log('[DatabaseService] Database service started');
    }
    
    /**
     * Stop the database service
     */
    async onStop() {
        // Stop maintenance tasks
        this.stopMaintenanceTasks();
        
        // Wait for active transactions to complete
        await this.waitForActiveTransactions();
        
        console.log('[DatabaseService] Database service stopped');
    }
    
    /**
     * Cleanup database resources
     */
    async onCleanup() {
        if (this.db) {
            try {
                // Clean up expired sessions
                await this.cleanupExpiredSessions();
                
                // Optimize database
                await this.optimizeDatabase();
                
                // Close database connection
                await this.closeDatabase();
                
            } catch (error) {
                console.error('[DatabaseService] Cleanup error:', error);
            }
        }
        
        console.log('[DatabaseService] Database cleanup complete');
    }
    
    /**
     * Ensure database file exists
     */
    async ensureDatabaseExists() {
        const dbDir = path.dirname(this.dbPath);
        
        // Ensure directory exists
        await fs.ensureDir(dbDir);
        
        // Check if database exists
        const exists = await fs.pathExists(this.dbPath);
        
        if (!exists) {
            console.log('[DatabaseService] Creating new database...');
            
            // Try to copy template database
            const templatePath = this.getTemplatePath();
            if (await fs.pathExists(templatePath)) {
                await fs.copy(templatePath, this.dbPath);
                console.log('[DatabaseService] Database created from template');
            } else {
                // Create empty database
                await this.createEmptyDatabase();
                console.log('[DatabaseService] Empty database created');
            }
        }
    }
    
    /**
     * Connect to database
     */
    async connectToDatabase() {
        const sqlite3 = require('sqlite3').verbose();
        const { open } = require('sqlite');
        
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        
        // Track connection
        this.trackConnection(this.db);
        
        // Enable foreign keys
        await this.db.run('PRAGMA foreign_keys = ON');
        
        // Set journal mode for better performance
        await this.db.run('PRAGMA journal_mode = WAL');
        
        this.isConnected = true;
        console.log('[DatabaseService] Connected to database');
    }
    
    /**
     * Setup database schema
     */
    async setupSchema() {
        // Create tables if they don't exist
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            );
            
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT,
                message TEXT,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
        `);
    }
    
    /**
     * Verify database integrity
     */
    async verifyIntegrity() {
        const result = await this.db.get('PRAGMA integrity_check');
        
        if (result.integrity_check !== 'ok') {
            throw new Error('Database integrity check failed');
        }
        
        console.log('[DatabaseService] Database integrity verified');
    }
    
    /**
     * Start maintenance tasks
     */
    startMaintenanceTasks() {
        // Cleanup expired sessions every hour
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions().catch(error => {
                console.error('[DatabaseService] Session cleanup error:', error);
            });
        }, 60 * 60 * 1000);
        
        this.trackInterval(cleanupInterval);
        
        // Optimize database every 24 hours
        const optimizeInterval = setInterval(() => {
            this.optimizeDatabase().catch(error => {
                console.error('[DatabaseService] Optimization error:', error);
            });
        }, 24 * 60 * 60 * 1000);
        
        this.trackInterval(optimizeInterval);
    }
    
    /**
     * Stop maintenance tasks
     */
    stopMaintenanceTasks() {
        // Intervals are automatically cleared by BaseService
    }
    
    /**
     * Warm up connection pool
     */
    async warmupConnectionPool() {
        // Execute a simple query to warm up the connection
        await this.db.get('SELECT 1');
    }
    
    /**
     * Wait for active transactions to complete
     */
    async waitForActiveTransactions(timeout = 5000) {
        const startTime = Date.now();
        
        while (this.activeTransactions > 0) {
            if (Date.now() - startTime > timeout) {
                console.warn('[DatabaseService] Timeout waiting for transactions');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        const result = await this.db.run(
            'DELETE FROM sessions WHERE expires_at < datetime("now")'
        );
        
        if (result.changes > 0) {
            console.log(`[DatabaseService] Cleaned up ${result.changes} expired sessions`);
        }
    }
    
    /**
     * Optimize database
     */
    async optimizeDatabase() {
        await this.db.run('VACUUM');
        await this.db.run('ANALYZE');
        console.log('[DatabaseService] Database optimized');
    }
    
    /**
     * Close database connection
     */
    async closeDatabase() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.isConnected = false;
            console.log('[DatabaseService] Database connection closed');
        }
    }
    
    /**
     * Create empty database
     */
    async createEmptyDatabase() {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(this.dbPath);
        
        await new Promise((resolve, reject) => {
            db.close(err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    /**
     * Get template database path
     */
    getTemplatePath() {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'database', 'template.db');
        } else {
            return path.join(__dirname, '../../database/template.db');
        }
    }
    
    /**
     * Execute a query with tracking
     */
    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        
        this.activeTransactions++;
        this.queryStats.total++;
        
        const startTime = Date.now();
        
        try {
            const result = await this.db.all(sql, params);
            
            // Update stats
            const queryTime = Date.now() - startTime;
            this.queryStats.avgTime = 
                (this.queryStats.avgTime * (this.queryStats.total - 1) + queryTime) / 
                this.queryStats.total;
            
            return result;
            
        } catch (error) {
            this.queryStats.errors++;
            throw error;
            
        } finally {
            this.activeTransactions--;
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        
        return {
            ...baseStatus,
            database: {
                path: this.dbPath,
                connected: this.isConnected,
                activeTransactions: this.activeTransactions,
                queryStats: { ...this.queryStats }
            }
        };
    }
}

// Export singleton instance
module.exports = new DatabaseService();