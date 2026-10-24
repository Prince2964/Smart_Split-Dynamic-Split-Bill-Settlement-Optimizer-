SS.settlementHistoryPage = {
    state: { groupId: 'all', member: 'all', status: 'all', dateFrom: '', dateTo: '' },
    init() {
        if (!SS.requireAuth()) return;
        SS.navigation.render();
        this.populateFilters();
        this.bind();
        this.render();
    },
    groups() { return SS.groups.userGroups(SS.currentUser().id); },
    records() {
        const groupIds = new Set(this.groups().map(group => group.id));
        return SS.storage.settlementHistory().filter(record => groupIds.has(record.groupId));
    },
    populateFilters() {
        const groups = this.groups();
        const groupSelect = document.getElementById('historyGroupFilter');
        if (groupSelect) groupSelect.innerHTML = `<option value="all">All groups</option>${groups.map(group => `<option value="${SS.escape(group.id)}">${SS.escape(group.name)}</option>`).join('')}`;
        const members = new Map();
        groups.forEach(group => (group.members || []).forEach(member => members.set(member.userId, member.name)));
        const memberSelect = document.getElementById('historyMemberFilter');
        if (memberSelect) memberSelect.innerHTML = `<option value="all">All members</option>${[...members].map(([id, name]) => `<option value="${SS.escape(id)}">${SS.escape(name)}</option>`).join('')}`;
    },
    bind() {
        const ids = { historyGroupFilter: 'groupId', historyMemberFilter: 'member', historyStatusFilter: 'status', historyDateFrom: 'dateFrom', historyDateTo: 'dateTo' };
        Object.entries(ids).forEach(([id, key]) => document.getElementById(id)?.addEventListener('change', event => { this.state[key] = event.target.value; this.render(); }));
        document.getElementById('clearHistoryFilters')?.addEventListener('click', () => {
            this.state = { groupId: 'all', member: 'all', status: 'all', dateFrom: '', dateTo: '' };
            ['historyGroupFilter','historyMemberFilter','historyStatusFilter','historyDateFrom','historyDateTo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = id === 'historyStatusFilter' ? 'all' : ''; });
            const group = document.getElementById('historyGroupFilter'); if (group) group.value = 'all';
            const member = document.getElementById('historyMemberFilter'); if (member) member.value = 'all';
            this.render();
            SS.notifications.info('Filters cleared');
        });
    },
    render() {
        const records = this.records().filter(record => {
            const day = String(record.paidAt || '').slice(0, 10);
            return (this.state.groupId === 'all' || record.groupId === this.state.groupId) &&
                (this.state.member === 'all' || record.fromId === this.state.member || record.toId === this.state.member) &&
                (this.state.status === 'all' || record.status === this.state.status) &&
                (!this.state.dateFrom || day >= this.state.dateFrom) && (!this.state.dateTo || day <= this.state.dateTo);
        }).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
        document.getElementById('historyCount').textContent = records.length;
        const host = document.getElementById('settlementHistoryList');
        if (!records.length) {
            host.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div><h3>No settlement history</h3><p>Completed settlements will be recorded here.</p></div>';
            return;
        }
        host.innerHTML = records.map(record => `<article class="history-row"><div class="history-status">✓</div><div><strong>${SS.escape(record.from)} → ${SS.escape(record.to)}</strong><p>${SS.escape(record.groupName || 'Group')} · Paid on ${SS.formatDateTime(record.paidAt)}</p></div><div class="history-amount"><strong>${SS.money(record.amount)}</strong><span class="status-pill success">Paid</span></div></article>`).join('');
    }
};
