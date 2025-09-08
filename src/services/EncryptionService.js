const crypto = require('crypto');
let keytar;

// Try to load keytar, but don't fail if it's not available
try {
    keytar = require('keytar');
} catch (error) {
    console.warn('[EncryptionService] Keytar not available, using in-memory key storage');
}

/**
 * EncryptionService - Provides secure encryption for sensitive data like API keys
 * Uses OS keychain for secure key storage when available
 */
class EncryptionService {
    constructor() {
        this.serviceName = 'com.pickle.clueless';
        this.accountName = 'encryption-key';
        this.algorithm = 'aes-256-gcm';
        this.sessionKey = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the encryption service for a user
     * @param {string} userId - The user ID to initialize encryption for
     */
    async initialize(userId = 'default') {
        try {
            this.accountName = `encryption-key-${userId}`;
            
            // Get or create encryption key
            let key = await this.getStoredKey();
            if (!key) {
                key = await this.generateAndStoreKey();
            }
            
            this.sessionKey = Buffer.from(key, 'base64');
            this.isInitialized = true;
            
            console.log('[EncryptionService] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[EncryptionService] Initialization failed:', error);
            // Fallback to session-only key
            this.sessionKey = crypto.randomBytes(32);
            this.isInitialized = true;
            return false;
        }
    }

    /**
     * Get the stored encryption key from OS keychain
     * @returns {Promise<string|null>} The stored key or null
     */
    async getStoredKey() {
        if (!keytar) {
            return null;
        }

        try {
            const key = await keytar.getPassword(this.serviceName, this.accountName);
            return key;
        } catch (error) {
            console.error('[EncryptionService] Failed to get stored key:', error);
            return null;
        }
    }

    /**
     * Generate a new encryption key and store it
     * @returns {Promise<string>} The generated key
     */
    async generateAndStoreKey() {
        const key = crypto.randomBytes(32).toString('base64');
        
        if (keytar) {
            try {
                await keytar.setPassword(this.serviceName, this.accountName, key);
                console.log('[EncryptionService] Key stored in OS keychain');
            } catch (error) {
                console.warn('[EncryptionService] Failed to store key in keychain:', error);
            }
        }
        
        return key;
    }

    /**
     * Encrypt text using AES-256-GCM
     * @param {string} text - Text to encrypt
     * @returns {string} Encrypted text with IV and auth tag
     */
    encrypt(text) {
        if (!this.isInitialized || !this.sessionKey) {
            throw new Error('EncryptionService not initialized');
        }

        if (!text) {
            return '';
        }

        try {
            // Generate random IV
            const iv = crypto.randomBytes(16);
            
            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, this.sessionKey, iv);
            
            // Encrypt the text
            let encrypted = cipher.update(text, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            // Get the auth tag
            const authTag = cipher.getAuthTag();
            
            // Combine IV + authTag + encrypted data
            const combined = Buffer.concat([iv, authTag, encrypted]);
            
            // Return as base64
            return combined.toString('base64');
        } catch (error) {
            console.error('[EncryptionService] Encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt text encrypted with encrypt()
     * @param {string} encryptedText - Base64 encoded encrypted text
     * @returns {string} Decrypted text
     */
    decrypt(encryptedText) {
        if (!this.isInitialized || !this.sessionKey) {
            throw new Error('EncryptionService not initialized');
        }

        if (!encryptedText) {
            return '';
        }

        try {
            // Decode from base64
            const combined = Buffer.from(encryptedText, 'base64');
            
            // Extract components
            const iv = combined.slice(0, 16);
            const authTag = combined.slice(16, 32);
            const encrypted = combined.slice(32);
            
            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.sessionKey, iv);
            decipher.setAuthTag(authTag);
            
            // Decrypt
            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted.toString('utf8');
        } catch (error) {
            console.error('[EncryptionService] Decryption failed:', error);
            // Return original if decryption fails (might not be encrypted)
            return encryptedText;
        }
    }

    /**
     * Check if a string looks like it's encrypted
     * @param {string} str - String to check
     * @returns {boolean} True if it looks encrypted
     */
    looksEncrypted(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }

        // Check if it's valid base64 and has minimum length
        try {
            const decoded = Buffer.from(str, 'base64');
            // Encrypted strings have at least IV (16) + authTag (16) + some data
            return decoded.length >= 33 && /^[A-Za-z0-9+/]+=*$/.test(str);
        } catch {
            return false;
        }
    }

    /**
     * Reset the session key (for logout)
     */
    resetSessionKey() {
        this.sessionKey = null;
        this.isInitialized = false;
    }

    /**
     * Delete stored key for a user
     * @param {string} userId - The user ID
     */
    async deleteStoredKey(userId = 'default') {
        if (!keytar) {
            return;
        }

        try {
            const accountName = `encryption-key-${userId}`;
            await keytar.deletePassword(this.serviceName, accountName);
            console.log('[EncryptionService] Deleted stored key for user:', userId);
        } catch (error) {
            console.error('[EncryptionService] Failed to delete stored key:', error);
        }
    }
}

// Export singleton instance
module.exports = new EncryptionService();