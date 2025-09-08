const BaseService = require('./core/BaseService');
const { safeStorage } = require('electron');
const crypto = require('crypto');

/**
 * Enhanced Authentication Service with dependency injection
 */
class AuthService extends BaseService {
    constructor() {
        super('AuthService', {
            isCritical: false,
            maxRetries: 3
        });
        
        this.currentUser = null;
        this.sessionToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        
        // Dependencies (injected later)
        this.databaseService = null;
        this.firebaseService = null;
        
        // Session management
        this.activeSessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }
    
    /**
     * Set service dependencies
     */
    setDependencies(dependencies) {
        this.databaseService = dependencies.DatabaseService;
        this.firebaseService = dependencies.FirebaseService;
    }
    
    /**
     * Initialize the authentication service
     */
    async onInitialize() {
        console.log('[AuthService] Initializing authentication...');
        
        // Validate dependencies
        if (!this.databaseService) {
            throw new Error('DatabaseService dependency not provided');
        }
        
        // Load stored credentials
        await this.loadStoredCredentials();
        
        // Setup session cleanup
        this.setupSessionCleanup();
        
        // Verify encryption is available
        if (!safeStorage.isEncryptionAvailable()) {
            console.warn('[AuthService] Encryption not available on this platform');
        }
        
        console.log('[AuthService] Authentication initialized');
    }
    
    /**
     * Start the authentication service
     */
    async onStart() {
        // Auto-login if credentials are available
        if (this.hasStoredCredentials()) {
            try {
                await this.autoLogin();
            } catch (error) {
                console.error('[AuthService] Auto-login failed:', error);
                // Clear invalid credentials
                await this.clearStoredCredentials();
            }
        }
        
        // Start token refresh timer
        this.startTokenRefresh();
        
        console.log('[AuthService] Authentication service started');
    }
    
    /**
     * Stop the authentication service
     */
    async onStop() {
        // Stop token refresh
        this.stopTokenRefresh();
        
        // Suspend active sessions
        await this.suspendActiveSessions();
        
        console.log('[AuthService] Authentication service stopped');
    }
    
    /**
     * Cleanup authentication resources
     */
    async onCleanup() {
        // Logout if logged in
        if (this.currentUser) {
            await this.logout();
        }
        
        // Clear all sessions
        this.activeSessions.clear();
        
        console.log('[AuthService] Authentication cleanup complete');
    }
    
    /**
     * Load stored credentials from database
     */
    async loadStoredCredentials() {
        try {
            const result = await this.databaseService.query(
                'SELECT value FROM settings WHERE key = ?',
                ['auth_credentials']
            );
            
            if (result && result[0]) {
                const encryptedData = result[0].value;
                
                // Decrypt if encryption is available
                if (safeStorage.isEncryptionAvailable()) {
                    const decrypted = safeStorage.decryptString(Buffer.from(encryptedData, 'base64'));
                    const credentials = JSON.parse(decrypted);
                    
                    this.refreshToken = credentials.refreshToken;
                    this.tokenExpiry = new Date(credentials.tokenExpiry);
                    
                    console.log('[AuthService] Stored credentials loaded');
                }
            }
        } catch (error) {
            console.error('[AuthService] Failed to load stored credentials:', error);
        }
    }
    
    /**
     * Save credentials to database
     */
    async saveCredentials() {
        try {
            const credentials = {
                refreshToken: this.refreshToken,
                tokenExpiry: this.tokenExpiry
            };
            
            let encryptedData;
            
            // Encrypt if available
            if (safeStorage.isEncryptionAvailable()) {
                const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
                encryptedData = encrypted.toString('base64');
            } else {
                // Fallback to base64 encoding (less secure)
                encryptedData = Buffer.from(JSON.stringify(credentials)).toString('base64');
            }
            
            await this.databaseService.query(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                ['auth_credentials', encryptedData]
            );
            
            console.log('[AuthService] Credentials saved');
        } catch (error) {
            console.error('[AuthService] Failed to save credentials:', error);
        }
    }
    
    /**
     * Clear stored credentials
     */
    async clearStoredCredentials() {
        try {
            await this.databaseService.query(
                'DELETE FROM settings WHERE key = ?',
                ['auth_credentials']
            );
            
            this.refreshToken = null;
            this.tokenExpiry = null;
            
            console.log('[AuthService] Stored credentials cleared');
        } catch (error) {
            console.error('[AuthService] Failed to clear credentials:', error);
        }
    }
    
    /**
     * Check if stored credentials exist
     */
    hasStoredCredentials() {
        return this.refreshToken && this.tokenExpiry && this.tokenExpiry > new Date();
    }
    
    /**
     * Auto-login with stored credentials
     */
    async autoLogin() {
        if (!this.hasStoredCredentials()) {
            throw new Error('No valid stored credentials');
        }
        
        console.log('[AuthService] Attempting auto-login...');
        
        // Refresh the token
        const newToken = await this.refreshAuthToken(this.refreshToken);
        
        // Get user info
        const userInfo = await this.getUserInfo(newToken);
        
        this.currentUser = userInfo;
        this.sessionToken = newToken;
        
        console.log('[AuthService] Auto-login successful');
    }
    
    /**
     * Login user
     */
    async login(email, password) {
        console.log('[AuthService] Logging in user...');
        
        try {
            // Authenticate with Firebase if available
            if (this.firebaseService && this.firebaseService.isReady()) {
                const result = await this.firebaseService.signIn(email, password);
                
                this.currentUser = result.user;
                this.sessionToken = result.token;
                this.refreshToken = result.refreshToken;
                this.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
                
                // Save credentials
                await this.saveCredentials();
                
                // Create session
                await this.createSession(result.user.uid);
                
                console.log('[AuthService] Login successful');
                return result;
            } else {
                // Fallback to local authentication
                return await this.localLogin(email, password);
            }
        } catch (error) {
            console.error('[AuthService] Login failed:', error);
            throw error;
        }
    }
    
    /**
     * Local login fallback
     */
    async localLogin(email, password) {
        // Simple local authentication (for development)
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        
        const result = await this.databaseService.query(
            'SELECT * FROM users WHERE email = ? AND password_hash = ?',
            [email, passwordHash]
        );
        
        if (result && result[0]) {
            const user = result[0];
            
            this.currentUser = user;
            this.sessionToken = this.generateToken();
            this.tokenExpiry = new Date(Date.now() + 3600000);
            
            await this.createSession(user.id);
            
            return { user, token: this.sessionToken };
        }
        
        throw new Error('Invalid credentials');
    }
    
    /**
     * Logout user
     */
    async logout() {
        console.log('[AuthService] Logging out user...');
        
        try {
            // End session
            if (this.currentUser) {
                await this.endSession(this.currentUser.uid || this.currentUser.id);
            }
            
            // Clear credentials
            await this.clearStoredCredentials();
            
            // Clear state
            this.currentUser = null;
            this.sessionToken = null;
            this.refreshToken = null;
            this.tokenExpiry = null;
            
            console.log('[AuthService] Logout successful');
        } catch (error) {
            console.error('[AuthService] Logout error:', error);
        }
    }
    
    /**
     * Create user session
     */
    async createSession(userId) {
        const sessionId = this.generateSessionId();
        const expiresAt = new Date(Date.now() + this.sessionTimeout);
        
        await this.databaseService.query(
            'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
            [sessionId, userId, expiresAt.toISOString()]
        );
        
        this.activeSessions.set(userId, {
            id: sessionId,
            userId,
            createdAt: new Date(),
            expiresAt,
            lastActivity: new Date()
        });
        
        // Setup session timeout
        const timeout = setTimeout(() => {
            this.endSession(userId).catch(console.error);
        }, this.sessionTimeout);
        
        this.trackTimer(timeout);
        
        console.log(`[AuthService] Session created for user ${userId}`);
    }
    
    /**
     * End user session
     */
    async endSession(userId) {
        const session = this.activeSessions.get(userId);
        
        if (session) {
            await this.databaseService.query(
                'DELETE FROM sessions WHERE id = ?',
                [session.id]
            );
            
            this.activeSessions.delete(userId);
            
            console.log(`[AuthService] Session ended for user ${userId}`);
        }
    }
    
    /**
     * Setup session cleanup interval
     */
    setupSessionCleanup() {
        const interval = setInterval(() => {
            this.cleanupExpiredSessions().catch(console.error);
        }, 5 * 60 * 1000); // Every 5 minutes
        
        this.trackInterval(interval);
    }
    
    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        const now = new Date();
        
        for (const [userId, session] of this.activeSessions.entries()) {
            if (session.expiresAt < now) {
                await this.endSession(userId);
            }
        }
    }
    
    /**
     * Suspend active sessions
     */
    async suspendActiveSessions() {
        for (const [userId] of this.activeSessions.entries()) {
            await this.endSession(userId);
        }
    }
    
    /**
     * Start token refresh timer
     */
    startTokenRefresh() {
        if (this.tokenExpiry) {
            const refreshTime = this.tokenExpiry.getTime() - Date.now() - 5 * 60 * 1000; // 5 minutes before expiry
            
            if (refreshTime > 0) {
                const timer = setTimeout(() => {
                    this.refreshCurrentToken().catch(console.error);
                }, refreshTime);
                
                this.trackTimer(timer);
            }
        }
    }
    
    /**
     * Stop token refresh timer
     */
    stopTokenRefresh() {
        // Timers are automatically cleared by BaseService
    }
    
    /**
     * Refresh current token
     */
    async refreshCurrentToken() {
        if (this.refreshToken) {
            try {
                this.sessionToken = await this.refreshAuthToken(this.refreshToken);
                this.tokenExpiry = new Date(Date.now() + 3600000);
                
                await this.saveCredentials();
                
                // Schedule next refresh
                this.startTokenRefresh();
                
                console.log('[AuthService] Token refreshed');
            } catch (error) {
                console.error('[AuthService] Token refresh failed:', error);
                await this.logout();
            }
        }
    }
    
    /**
     * Refresh authentication token
     */
    async refreshAuthToken(refreshToken) {
        // Implementation depends on auth provider
        if (this.firebaseService && this.firebaseService.isReady()) {
            return await this.firebaseService.refreshToken(refreshToken);
        }
        
        // Fallback to generating new token
        return this.generateToken();
    }
    
    /**
     * Get user info
     */
    async getUserInfo(token) {
        // Implementation depends on auth provider
        if (this.firebaseService && this.firebaseService.isReady()) {
            return await this.firebaseService.getUserInfo(token);
        }
        
        // Return current user
        return this.currentUser;
    }
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Generate auth token
     */
    generateToken() {
        return crypto.randomBytes(32).toString('base64');
    }
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser && !!this.sessionToken;
    }
    
    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        
        return {
            ...baseStatus,
            auth: {
                authenticated: this.isAuthenticated(),
                user: this.currentUser ? this.currentUser.email : null,
                activeSessions: this.activeSessions.size,
                tokenExpiry: this.tokenExpiry,
                encryptionAvailable: safeStorage.isEncryptionAvailable()
            }
        };
    }
}

// Export singleton instance
module.exports = new AuthService();