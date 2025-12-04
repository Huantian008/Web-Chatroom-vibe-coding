const fs = require('fs');
const path = require('path');

const ADMIN_CONFIG_PATH = path.join(__dirname, '../config/admins.json');

class AdminHelper {
    constructor() {
        this.admins = new Set();
        this.watcher = null;
        this.loadAdmins();
        this.watchAdminFile();
    }

    loadAdmins() {
        try {
            const data = fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8');
            const config = JSON.parse(data);
            this.admins = new Set(config.admins || []);
            console.log(`✅ Loaded ${this.admins.size} admin(s): ${Array.from(this.admins).join(', ')}`);
        } catch (error) {
            console.error('❌ Error loading admin config:', error.message);
            this.admins = new Set();
        }
    }

    isAdmin(username) {
        return this.admins.has(username);
    }

    getAdminList() {
        return Array.from(this.admins);
    }

    reloadAdmins() {
        this.loadAdmins();
    }

    watchAdminFile() {
        // Reload admins automatically when the config file changes
        if (this.watcher) return;

        try {
            this.watcher = fs.watch(ADMIN_CONFIG_PATH, (eventType) => {
                if (eventType === 'change') {
                    console.log('🔄 Admin config changed, reloading...');
                    this.reloadAdmins();
                }
            });

            // Allow process to exit even if watcher is active
            if (this.watcher?.unref) {
                this.watcher.unref();
            }
        } catch (error) {
            console.error('❌ Failed to watch admin config file:', error.message);
        }
    }
}

module.exports = new AdminHelper();
