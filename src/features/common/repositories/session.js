class SessionRepository {
    constructor() {
        this.sessions = new Map();
        this.currentSession = null;
    }

    async createSession(data) {
        const sessionId = `session_${Date.now()}`;
        const session = {
            id: sessionId,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.sessions.set(sessionId, session);
        this.currentSession = session;
        
        console.log('Session created:', sessionId);
        return session;
    }

    async getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    async updateSession(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (session) {
            Object.assign(session, data, { updatedAt: new Date().toISOString() });
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    async deleteSession(sessionId) {
        this.sessions.delete(sessionId);
        if (this.currentSession && this.currentSession.id === sessionId) {
            this.currentSession = null;
        }
        console.log('Session deleted:', sessionId);
    }

    async getAllSessions() {
        return Array.from(this.sessions.values());
    }

    async getCurrentSession() {
        return this.currentSession;
    }

    async setCurrentSession(sessionId) {
        this.currentSession = this.sessions.get(sessionId);
    }
}

module.exports = new SessionRepository();
