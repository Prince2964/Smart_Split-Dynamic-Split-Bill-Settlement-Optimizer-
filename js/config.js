
window.SS = window.SS || {};

SS.STORAGE = Object.freeze({
    users: 'ss_users',
    groups: 'ss_groups',
    invitations: 'ss_invitations',
    currentUser: 'ss_current_user',
    settlementHistory: 'ss_settlement_history',
    authToken: 'ss_auth_token',
    backendUser: 'ss_backend_user'
});

SS.APP = Object.freeze({
    name: 'SplitSmart',
    version: '1.7.0',
    demo: true
});

// Backend base URL
// Local development default. After deploying the backend, replace this with your Render URL.
// Example: 'https://your-splitsmart-api.onrender.com/api'
SS.API_BASE_URL = 'https://smart-split-dynamic-split-bill.onrender.com';

// Shared API helper
SS.api = {
    async request(path, options = {}) {
        const token = localStorage.getItem(SS.STORAGE.authToken);

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
            `${SS.API_BASE_URL}${path}`,
            {
                ...options,
                headers
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || `Request failed (${response.status})`
            );
        }

        return data;
    }
};
