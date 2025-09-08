class AuthService {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
    }

    async login(credentials) {
        this.isAuthenticated = true;
        this.user = { id: 'user1', email: credentials.email };
        console.log('User logged in');
    }

    async logout() {
        this.isAuthenticated = false;
        this.user = null;
        console.log('User logged out');
    }

    async getCurrentUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.isAuthenticated;
    }
}

module.exports = new AuthService();
