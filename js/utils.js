SS.uid = (prefix = 'ID') => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
SS.now = () => new Date().toISOString();
SS.escape = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
SS.money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
SS.icon = purpose => ({ trip: '✈️', household: '🏠', custom: '✦' }[purpose] || '✦');
SS.label = purpose => ({ trip: 'Trip', household: 'Household', custom: 'Custom Group' }[purpose] || purpose || 'Group');
SS.formatDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
SS.toast = message => { const el = document.getElementById('toast'); if (!el)
    return; el.textContent = message; el.classList.add('show'); clearTimeout(SS.__toast); SS.__toast = setTimeout(() => el.classList.remove('show'), 2800); };
SS.query = key => new URLSearchParams(location.search).get(key);
SS.group = id => SS.storage.groups().find(g => g.id === id) || null;
SS.currentUser = () => SS.storage.users().find(u => u.id === SS.storage.currentUserId()) || null;
SS.initials = name => (String(name || 'U').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || 'U').toUpperCase();
SS.currentPageUrl = () => `${location.pathname.split('/').pop() || 'index.html'}${location.search || ''}${location.hash || ''}`;
SS.requireAuth = () => {
    if (SS.currentUser())
        return true;
    const current = SS.currentPageUrl();
    const publicPages = ['index.html', 'login.html', 'signup.html'];
    const page = location.pathname.split('/').pop() || 'index.html';
    if (!publicPages.includes(page)) {
        location.href = `login.html?next=${encodeURIComponent(current)}`;
    }
    else {
        location.href = 'login.html';
    }
    return false;
};
SS.requireGuest = () => {
    if (!SS.currentUser())
        return true;
    const next = SS.query('next');
    location.href = next || 'dashboard.html';
    return false;
};
SS.readImageAsDataUrl = file => new Promise((resolve, reject) => {
    if (!file)
        return resolve('');
    if (!file.type.startsWith('image/'))
        return reject(new Error('Please select an image file.'));
    if (file.size > 5 * 1024 * 1024)
        return reject(new Error('Please choose an image smaller than 5 MB.'));
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

