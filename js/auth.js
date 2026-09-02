SS.auth = {
    register({ name, email, password }) {
        const users = SS.storage.users();
        const cleanName = String(name || '').trim();
        const normalized = String(email || '').trim().toLowerCase();
        if (users.some(u => String(u.email || '').toLowerCase() === normalized)) {
            throw new Error('An account with this email already exists.');
        }
        const user = {
            id: SS.uid('USR'),
            name: cleanName,
            email: normalized,
            // DEMO ONLY. Never store plaintext passwords in a production app.
            password: String(password || ''),
            createdAt: SS.now()
        };
        users.push(user);
        SS.storage.replaceUsers(users);
        return user;
    },
    login(email, password) {
        const normalized = String(email || '').trim().toLowerCase();
        const suppliedPassword = String(password || '');
        const user = SS.storage.users().find(u => String(u.email || '').toLowerCase() === normalized && u.password === suppliedPassword);
        if (!user)
            throw new Error('Invalid email or password.');
        SS.storage.setCurrentUser(user.id);
        return user;
    },
    logout() {
        SS.storage.clearCurrentUser();
        location.href = 'index.html';
    }
};

