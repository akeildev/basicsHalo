class PermissionRepository {
    constructor() {
        this.permissions = new Map();
    }

    async hasPermission(permission) {
        return this.permissions.get(permission) || false;
    }

    async grantPermission(permission) {
        this.permissions.set(permission, true);
    }

    async revokePermission(permission) {
        this.permissions.set(permission, false);
    }

    async getAllPermissions() {
        return Object.fromEntries(this.permissions);
    }
}

module.exports = new PermissionRepository();
