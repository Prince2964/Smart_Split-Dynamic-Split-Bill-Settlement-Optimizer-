SS.render = {
    groupCards(groups, host, options = {}) {
        if (!host)
            return;
        const compact = options.compact === true;
        if (!groups.length) {
            host.innerHTML = '<div class="empty-state"><div class="empty-icon">＋</div><h3>No groups yet</h3><p>Create your first group to start splitting smarter.</p><a class="btn btn-primary" href="create-group.html">Create a group</a></div>';
            return;
        }
        host.innerHTML = groups.map(g => {
            const expenses = Array.isArray(g.expenses) ? g.expenses : [];
            const total = expenses.reduce((s, e) => s + (Number.isFinite(Number(e.amount)) ? Number(e.amount) : 0), 0);
            const members = Array.isArray(g.members) ? g.members.filter(m => m.status !== 'removed') : [];
            return `<article class="group-card ${compact ? 'compact-group-card' : ''}">
        <div class="group-thumb-wrap"><img class="group-thumb" src="${SS.escape(SS.thumbnail(g))}" alt="${SS.escape(g.name)} thumbnail"></div>
        <div class="group-card-content">
          <div class="group-card-top"><span class="purpose-badge ${SS.escape(g.purpose)}">${SS.icon(g.purpose)} ${SS.escape(SS.label(g.purpose))}</span><span class="group-created">${SS.formatDate(g.createdAt)}</span></div>
          <h3>${SS.escape(g.name)}</h3>
          <p>${g.purpose === 'trip' && g.meta?.destination ? SS.escape(g.meta.destination) + ' · ' : ''}${members.length} members · ${expenses.length} expenses</p>
          <div class="group-card-bottom"><strong>${SS.money(total)}</strong><a class="text-btn" href="group.html?id=${encodeURIComponent(g.id)}">Open group →</a></div>
        </div>
      </article>`;
        }).join('');
    },
    invitations(incoming, outgoing, host) {
        if (!host)
            return;
        const received = incoming || [];
        const sent = outgoing || [];
        if (!received.length && !sent.length) {
            host.innerHTML = '<div class="empty-state compact"><div class="empty-icon">✉</div><h3>No invitations yet</h3><p>Invitations you receive or send will appear here.</p></div>';
            return;
        }
        const statusClass = status => ({ pending: 'pending', accepted: 'success', declined: 'declined', expired: 'declined' }[status] || 'pending');
        const statusText = status => status.charAt(0).toUpperCase() + status.slice(1);
        const inviteCard = (i, direction) => {
            const g = SS.group(i.groupId);
            const status = i.status || 'pending';
            const pending = status === 'pending';
            const expiresText = i.expiresAt && pending ? ` · Expires ${SS.formatDate(i.expiresAt)}` : '';
            return `<article class="invite-card ${direction === 'sent' ? 'sent-invite' : ''}">
        <div class="invite-avatar"><img src="${SS.escape(SS.thumbnail(g || { purpose: 'custom' }))}" alt=""></div>
        <div class="invite-body">
          <div class="invite-title"><strong>${SS.escape(g?.name || 'Group')}</strong><span class="status-pill ${statusClass(status)}">${statusText(status)}</span></div>
          <p>${direction === 'sent' ? `To <b>${SS.escape(i.name || '')}</b> · ${SS.escape(i.email || '')}` : `${SS.escape(i.invitedByName || 'Someone')} invited you · ${SS.escape(SS.label(g?.purpose))}`}${expiresText}</p>
          ${direction === 'sent' && i.token ? `<div class="invite-meta-line">Invitation ID <code>${SS.escape(i.id)}</code></div>` : ''}
          ${direction === 'received' && pending ? `<div class="invite-actions"><button class="btn btn-primary btn-sm invite-accept" data-id="${SS.escape(i.id)}">Accept</button><button class="btn btn-soft btn-sm invite-decline" data-id="${SS.escape(i.id)}">Decline</button></div>` : ''}
        </div>
      </article>`;
        };
        const receivedHtml = received.length
            ? `<div class="invite-section"><div class="invite-section-title"><span>Received</span><small>${received.filter(i => i.status === 'pending').length} pending</small></div>${received.map(i => inviteCard(i, 'received')).join('')}</div>`
            : '';
        const sentHtml = sent.length
            ? `<div class="invite-section"><div class="invite-section-title"><span>Sent by you</span><small>${sent.filter(i => i.status === 'pending').length} pending</small></div>${sent.map(i => inviteCard(i, 'sent')).join('')}</div>`
            : '';
        host.innerHTML = receivedHtml + sentHtml;
        host.querySelectorAll('.invite-accept').forEach(b => b.addEventListener('click', () => {
            try {
                const g = SS.invitations.accept(b.dataset.id);
                SS.toast('Invitation accepted 🎉');
                setTimeout(() => location.href = `group.html?id=${encodeURIComponent(g.id)}`, 300);
            }
            catch (e) {
                SS.toast(e.message);
            }
        }));
        host.querySelectorAll('.invite-decline').forEach(b => b.addEventListener('click', () => {
            try {
                SS.invitations.decline(b.dataset.id);
                SS.toast('Invitation declined.');
                setTimeout(() => location.reload(), 250);
            }
            catch (e) {
                SS.toast(e.message);
            }
        }));
    },
    expenses(group, host, options = {}) {
        if (!host) return;
        const allExpenses = Array.isArray(group.expenses) ? group.expenses.map(item => SS.expenses.normalize(item)) : [];
        const expenses = SS.expenses.filters(allExpenses, options.filters || {});
        const user = SS.currentUser();
        const canManage = expense => Boolean(user && (expense.addedBy === user.id || group.creator === user.id));
        if (!expenses.length) {
            host.innerHTML = `<div class="empty-state compact"><div class="empty-icon">₹</div><h3>${allExpenses.length ? 'No matching expenses' : 'No expenses yet'}</h3><p>${allExpenses.length ? 'Try changing your search or filters.' : 'Add the first shared expense to start calculating balances.'}</p></div>`;
            return;
        }
        host.innerHTML = `<div class="expense-list">${expenses.map(expense => {
            const actions = canManage(expense) ? `<div class="expense-actions"><button class="icon-btn edit-expense" data-id="${SS.escape(expense.id)}" title="Edit expense">✎</button><button class="icon-btn duplicate-expense" data-id="${SS.escape(expense.id)}" title="Duplicate expense">⧉</button><button class="icon-btn delete-expense" data-id="${SS.escape(expense.id)}" title="Delete expense">×</button></div>` : '';
            const recurring = expense.isRecurring ? `<span class="expense-tag recurring-tag">↻ ${SS.escape(expense.frequency)}</span>` : '';
            const note = expense.note ? `<p class="expense-note">${SS.escape(expense.note)}</p>` : '';
            return `<article class="expense-row"><div class="expense-icon">${SS.categoryIcon(expense.category)}</div><div class="expense-main"><div class="expense-title-line"><strong>${SS.escape(expense.description)}</strong><span class="expense-tag">${SS.categoryIcon(expense.category)} ${SS.escape(expense.category)}</span>${recurring}</div><p>${SS.escape(expense.paidByName || 'Unknown member')} paid · ${expense.participants.length} people · ${expense.splitMode === 'manual' ? 'Manual split' : 'Equal split'} · ${SS.formatDate(expense.date || expense.createdAt)}</p>${note}</div><strong class="expense-amount">${SS.money(expense.amount)}</strong>${actions}</article>`;
        }).join('')}</div>`;
        host.querySelectorAll('.edit-expense').forEach(button => button.addEventListener('click', () => options.onEdit?.(button.dataset.id)));
        host.querySelectorAll('.duplicate-expense').forEach(button => button.addEventListener('click', () => options.onDuplicate?.(button.dataset.id)));
        host.querySelectorAll('.delete-expense').forEach(button => button.addEventListener('click', () => {
            if (!confirm('Delete this expense?')) return;
            try {
                const result = SS.expenses.remove(group.id, button.dataset.id);
                options.onChanged?.();
                SS.notifications.warning('Expense deleted', {
                    timeout: 8000,
                    actionLabel: 'UNDO',
                    onAction: () => {
                        try {
                            SS.expenses.restore(group.id, result.expense);
                            options.onChanged?.();
                            SS.notifications.success('Expense restored successfully');
                        } catch (error) { SS.notifications.error(error.message); }
                    }
                });
            } catch (error) { SS.notifications.error(error.message); }
        }));
    },
    balances(balances, host) {
        if (!host)
            return;
        host.innerHTML = balances.map(b => `<div class="balance-row"><div class="member-cell"><span class="avatar">${SS.initials(b.name)}</span><strong>${SS.escape(b.name)}</strong></div><span>${SS.money(b.paid)}</span><span class="desktop-only">${SS.money(b.share)}</span><strong class="${b.balance > .009 ? 'positive' : b.balance < -.009 ? 'negative' : 'zero'}">${b.balance > .009 ? '+' : ''}${SS.money(b.balance)}</strong></div>`).join('');
    },
    settlement(items, host, group, options = {}) {
        if (!host)
            return;
        if (!items.length) {
            host.innerHTML = '<div class="empty-state compact"><div class="empty-icon">✓</div><h3>Everyone is settled</h3><p>No transfers are required.</p></div>';
            return;
        }
        host.innerHTML = items.map(s => {
            const status = SS.calculations.settlementStatus(group, s);
            const action = status === 'paid'
                ? '<span class="status-pill success">✓ Paid</span>'
                : `<button class="btn btn-soft btn-sm mark-settlement-paid" data-from="${SS.escape(s.fromId)}" data-to="${SS.escape(s.toId)}" data-amount="${SS.escape(s.amount)}">Mark Paid</button>`;
            return `<div class="settlement-row"><div class="settlement-flow"><strong>${SS.escape(s.from)}</strong><span>→</span><strong>${SS.escape(s.to)}</strong></div><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end"><strong>${SS.money(s.amount)}</strong>${action}</div></div>`;
        }).join('');
        host.querySelectorAll('.mark-settlement-paid').forEach(button => button.addEventListener('click', () => {
            try {
                SS.calculations.markSettlementPaid(group.id, {
                    fromId: button.dataset.from,
                    toId: button.dataset.to,
                    amount: Number(button.dataset.amount)
                });
                options.onChanged?.();
                SS.toast('Settlement marked as paid.');
            }
            catch (e) {
                SS.toast(e.message);
            }
        }));
    }
};

