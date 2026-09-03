SS.uid = (prefix = 'ID') => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
SS.now = () => new Date().toISOString();
SS.escape = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
SS.money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
SS.icon = purpose => ({ trip: '✈️', household: '🏠', custom: '✦' }[purpose] || '✦');
SS.label = purpose => ({ trip: 'Trip', household: 'Household', custom: 'Custom Group' }[purpose] || purpose || 'Group');
SS.formatDate = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
SS.formatDateTime = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
SS.query = key => new URLSearchParams(location.search).get(key);
SS.group = id => SS.storage.groups().find(g => g.id === id) || null;
SS.currentUser = () => SS.storage.users().find(u => u.id === SS.storage.currentUserId()) || null;
SS.initials = name => (String(name || 'U').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || 'U').toUpperCase();
SS.currentPageUrl = () => `${location.pathname.split('/').pop() || 'index.html'}${location.search || ''}${location.hash || ''}`;
SS.requireAuth = () => {
    if (SS.currentUser()) return true;
    const current = SS.currentPageUrl();
    const publicPages = ['index.html', 'login.html', 'signup.html'];
    const page = location.pathname.split('/').pop() || 'index.html';
    location.href = publicPages.includes(page) ? 'login.html' : `login.html?next=${encodeURIComponent(current)}`;
    return false;
};
SS.requireGuest = () => {
    if (!SS.currentUser()) return true;
    location.href = SS.query('next') || 'dashboard.html';
    return false;
};
SS.readImageAsDataUrl = file => new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Please choose an image smaller than 5 MB.'));
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const max = 1000;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.onerror = () => reject(new Error('Could not read that image.'));
        img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
});
SS.defaultThumbnail = purpose => `assets/default-${purpose}.svg`;
SS.thumbnail = group => group.thumbnail || SS.defaultThumbnail(group.purpose);

SS.expenseCategories = Object.freeze([
    { value: 'Food', icon: '🍽️' },
    { value: 'Travel', icon: '✈️' },
    { value: 'Hotel / Stay', icon: '🏨' },
    { value: 'Shopping', icon: '🛍️' },
    { value: 'Entertainment', icon: '🎬' },
    { value: 'Bills', icon: '🧾' },
    { value: 'Groceries', icon: '🛒' },
    { value: 'Transport', icon: '🚕' },
    { value: 'Healthcare', icon: '🏥' },
    { value: 'Education', icon: '📚' },
    { value: 'Utilities', icon: '💡' },
    { value: 'Other', icon: '✦' }
]);
SS.categoryIcon = category => SS.expenseCategories.find(item => item.value === category)?.icon || '✦';

SS.notifications = {
    _keys: new Set(),
    _container() {
        let host = document.getElementById('notificationStack');
        if (!host) {
            host = document.createElement('div');
            host.id = 'notificationStack';
            host.className = 'notification-stack';
            host.setAttribute('aria-live', 'polite');
            host.setAttribute('aria-atomic', 'false');
            document.body.appendChild(host);
        }
        return host;
    },
    show(message, type = 'info', options = {}) {
        const text = String(message || '').trim();
        if (!text) return;
        const key = `${type}:${text}`;
        if (this._keys.has(key)) return;
        this._keys.add(key);
        const toast = document.createElement('div');
        toast.className = `notification notification-${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const body = document.createElement('div');
        body.className = 'notification-body';
        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        icon.textContent = { success: '✓', error: '!', warning: '⚠', info: 'i' }[type] || 'i';
        const content = document.createElement('div');
        content.className = 'notification-content';
        const messageNode = document.createElement('span');
        messageNode.textContent = text;
        content.appendChild(messageNode);
        if (options.actionLabel && typeof options.onAction === 'function') {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'notification-action';
            action.textContent = options.actionLabel;
            action.addEventListener('click', () => {
                options.onAction();
                dismiss();
            });
            content.appendChild(action);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'notification-close';
        close.setAttribute('aria-label', 'Close notification');
        close.textContent = '×';
        body.append(icon, content, close);
        toast.appendChild(body);
        const dismiss = () => {
            if (!toast.isConnected) return;
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 220);
            this._keys.delete(key);
        };
        close.addEventListener('click', dismiss);
        this._container().appendChild(toast);
        const timeout = options.timeout ?? (type === 'error' ? 5000 : 3200);
        if (timeout > 0) setTimeout(dismiss, timeout);
        return dismiss;
    },
    success(message, options) { return this.show(message, 'success', options); },
    error(message, options) { return this.show(message, 'error', options); },
    warning(message, options) { return this.show(message, 'warning', options); },
    info(message, options) { return this.show(message, 'info', options); }
};
SS.toast = message => SS.notifications.info(message);
