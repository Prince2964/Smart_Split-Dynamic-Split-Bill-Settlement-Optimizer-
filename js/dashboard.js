SS.dashboardPage = {
    init() {
        if (!SS.requireAuth()) return;
        SS.navigation.render();
        const user = SS.currentUser();
        const groups = SS.groups.userGroups(user.id);
        groups.forEach(group => SS.expenses.normalizeGroup(group));
        const freshGroups = SS.groups.userGroups(user.id);
        const incoming = SS.invitations.forUser(user.email, 'pending');
        const summary = SS.calculations.dashboardSummary(freshGroups, user.id);
        document.getElementById('welcomeName').textContent = user.name.split(' ')[0];
        document.getElementById('totalGroups').textContent = freshGroups.length;
        document.getElementById('activeGroups').textContent = freshGroups.filter(group => (group.expenses?.length || 0) || (group.members?.length || 0) > 1).length;
        document.getElementById('totalExpenses').textContent = SS.money(summary.totalTracked);
        document.getElementById('pendingInvites').textContent = incoming.length;
        this.renderFinancialSummary(summary);
        this.renderAnalytics(summary, freshGroups, user);
        const recent = [...freshGroups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
        SS.render.groupCards(recent, document.getElementById('recentGroups'), { compact: true });
        const invitationSummary = document.getElementById('dashboardInvitationSummary');
        if (invitationSummary) invitationSummary.innerHTML = incoming.length
            ? `<div class="attention-card"><div class="attention-icon">✉</div><div><strong>${incoming.length} invitation${incoming.length > 1 ? 's' : ''} waiting</strong><p>You have new group invitation${incoming.length > 1 ? 's' : ''} to review.</p></div><a class="btn btn-primary btn-sm" href="invitations.html">Review →</a></div>`
            : `<div class="quiet-card"><span>✓</span><div><strong>You're all caught up</strong><p>No pending invitations right now.</p></div><a class="text-btn" href="invitations.html">View invitations →</a></div>`;
    },
    renderFinancialSummary(summary) {
        const host = document.getElementById('financialSummary');
        if (!host) return;
        const netLabel = summary.netBalance > 0.009 ? 'You are owed' : summary.netBalance < -0.009 ? 'You owe' : 'All settled';
        host.innerHTML = [
            ['Total Expenses', SS.money(summary.totalTracked), 'Across your groups'],
            ['You Paid', SS.money(summary.userPaid), 'Personally paid'],
            ['Your Share', SS.money(summary.userShare), 'Your portion'],
            ['You Are Owed', SS.money(summary.owedToUser), 'Others owe you'],
            ['You Owe', SS.money(summary.userOwes), 'You owe others'],
            [netLabel, `${summary.netBalance > 0.009 ? '+' : summary.netBalance < -0.009 ? '-' : ''}${SS.money(Math.abs(summary.netBalance))}`, 'Net balance']
        ].map(([label, value, helper]) => `<div class="financial-card"><span>${label}</span><strong>${value}</strong><small>${helper}</small></div>`).join('');
    },
    renderAnalytics(summary, groups, user) {
        const categoryHost = document.getElementById('categoryAnalytics');
        if (categoryHost) {
            const items = summary.categorySpending.slice(0, 6);
            const max = Math.max(...items.map(item => item.amount), 1);
            categoryHost.innerHTML = items.length ? items.map(item => `<div class="category-bar"><div><span>${SS.categoryIcon(item.category)} ${SS.escape(item.category)}</span><strong>${SS.money(item.amount)}</strong></div><i><b style="width:${Math.max(4, (item.amount / max) * 100)}%"></b></i></div>`).join('') : '<div class="empty-state compact"><h3>No spending data yet</h3><p>Add expenses to see category analytics.</p></div>';
        }
        const expenseHost = document.getElementById('dashboardRecentExpenses');
        if (expenseHost) expenseHost.innerHTML = summary.recentExpenses.length ? summary.recentExpenses.map(expense => `<div class="mini-activity"><span>${SS.categoryIcon(expense.category)}</span><div><strong>${SS.escape(expense.description)}</strong><small>${SS.escape(expense.groupName)} · ${SS.escape(expense.category)}</small></div><b>${SS.money(expense.amount)}</b></div>`).join('') : '<div class="empty-state compact"><h3>No recent expenses</h3><p>Your latest expenses will appear here.</p></div>';
        const history = SS.storage.settlementHistory().filter(record => (groups || []).some(group => group.id === record.groupId)).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).slice(0, 5);
        const settlementHost = document.getElementById('dashboardRecentSettlements');
        if (settlementHost) settlementHost.innerHTML = history.length ? history.map(record => `<div class="mini-activity"><span>✓</span><div><strong>${SS.escape(record.from)} → ${SS.escape(record.to)}</strong><small>${SS.escape(record.groupName || 'Group')} · ${SS.formatDate(record.paidAt)}</small></div><b>${SS.money(record.amount)}</b></div>`).join('') : '<div class="empty-state compact"><h3>No completed settlements</h3><p>Paid settlements will appear here.</p></div>';
    }
};
