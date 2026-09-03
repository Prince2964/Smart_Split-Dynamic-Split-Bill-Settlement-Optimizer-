SS.storage = {
    load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null)
                return fallback;
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        }
        catch {
            return fallback;
        }
    },
    save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        }
        catch (error) {
            throw new Error('Browser storage is unavailable or full. Please free some storage and try again.');
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        }
        catch { /* ignore storage cleanup failures */ }
    },
    users() {
        const value = this.load(SS.STORAGE.users, []);
        return Array.isArray(value) ? value : [];
    },
    groups() {
        const value = this.load(SS.STORAGE.groups, []);
        return Array.isArray(value) ? value : [];
    },
    invitations() {
        const value = this.load(SS.STORAGE.invitations, []);
        return Array.isArray(value) ? value : [];
    },
    settlementHistory() {
        const value = this.load(SS.STORAGE.settlementHistory, []);
        return Array.isArray(value) ? value : [];
    },
    replaceSettlementHistory(value) { this.save(SS.STORAGE.settlementHistory, Array.isArray(value) ? value : []); },
    currentUserId() {
        try {
            return localStorage.getItem(SS.STORAGE.currentUser);
        }
        catch {
            return null;
        }
    },
    setCurrentUser(id) { try {
        localStorage.setItem(SS.STORAGE.currentUser, String(id));
    }
    catch {
        throw new Error('Could not save the login session in this browser.');
    } },
    clearCurrentUser() { this.remove(SS.STORAGE.currentUser); },
    replaceUsers(value) { this.save(SS.STORAGE.users, Array.isArray(value) ? value : []); },
    replaceGroups(value) { this.save(SS.STORAGE.groups, Array.isArray(value) ? value : []); },
    replaceInvitations(value) { this.save(SS.STORAGE.invitations, Array.isArray(value) ? value : []); }
};

