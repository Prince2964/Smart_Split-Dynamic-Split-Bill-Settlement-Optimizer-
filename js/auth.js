
SS.auth = {
    async register({ name, email, password }) {
        const data = await SS.api.request("/auth/register", {
            method: "POST",
            body: JSON.stringify({
                name: String(name || "").trim(),
                email: String(email || "").trim().toLowerCase(),
                password: String(password || "")
            })
        });

        return data.user;
    },

    async login(email, password) {
        const data = await SS.api.request("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: String(email || "").trim().toLowerCase(),
                password: String(password || "")
            })
        });

        // Save backend JWT token
        localStorage.setItem(
            SS.STORAGE.authToken,
            data.token
        );

        // Keep compatibility with the existing local dashboard.
        // This is only a profile mirror; backend is the auth source.
        const users = SS.storage.users();
        const backendUser = {
            id: String(data.user.id),
            name: data.user.name,
            email: data.user.email
        };

        const index = users.findIndex(
            user => user.id === backendUser.id
        );

        if (index >= 0) {
            users[index] = {
                ...users[index],
                ...backendUser
            };
        } else {
            users.push(backendUser);
        }

        SS.storage.replaceUsers(users);
        SS.storage.setCurrentUser(backendUser.id);

        localStorage.setItem(
            SS.STORAGE.backendUser,
            JSON.stringify(backendUser)
        );

        return backendUser;
    },

    logout() {
        localStorage.removeItem(SS.STORAGE.authToken);
        localStorage.removeItem(SS.STORAGE.backendUser);

        SS.storage.clearCurrentUser();
        location.href = "index.html";
    }
};
