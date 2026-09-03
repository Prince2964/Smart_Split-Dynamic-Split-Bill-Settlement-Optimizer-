SS.groupPage = {
    editingExpenseId: null,
    editingShares: {},
    init(id) {
        if (!SS.requireAuth())
            return;
        SS.navigation.render();
        this.bindRootActions(id);
        this.render(id);
        this.modals();
    },
    bindRootActions(id) {
        const root = document.getElementById('groupRoot');
        if (!root || root.dataset.bound === '1')
            return;
        root.dataset.bound = '1';
        root.addEventListener('click', e => {
            const remove = e.target.closest('.remove-member');
            if (remove) {
                const group = SS.group(id);
                if (group)
                    this.removeMember(group, remove.dataset.id);
                return;
            }
            const deleteGroup = e.target.closest('#deleteGroup');
            if (deleteGroup) {
                const group = SS.group(id);
                if (group)
                    this.deleteGroup(group);
            }
        });
    },
    render(id) {
        const group = SS.group(id);
        const root = document.getElementById('groupRoot');
        const user = SS.currentUser();
        if (!root)
            return;
        if (!group) {
            root.innerHTML = '<div class="panel empty-state"><h3>Group not found</h3><p>The group may have been removed.</p><a class="btn btn-primary" href="my-groups.html">Back to My Groups</a></div>';
            return;
        }
        if (!user || !SS.groups.member(group, user.id)) {
            location.href = 'dashboard.html';
            return;
        }
        const activeMembers = SS.groups.activeMembers(group);
        const total = (group.expenses || []).reduce((s, e) => s + (Number.isFinite(Number(e.amount)) ? Number(e.amount) : 0), 0);
        const balances = SS.calculations.balances(group);
        const settlements = SS.calculations.simplify(group);
        const myBalance = balances.find(b => b.userId === user.id)?.balance || 0;
        const isAdmin = group.creator === user.id;
        SS.calculations.syncSettlementStatuses(group, settlements);
        root.innerHTML = `
      <div class="group-header">
        <div class="group-header-main">
          <a class="back-link light" href="my-groups.html">← My Groups</a>
          <div class="group-title-row">
            <img class="group-header-thumb" src="${SS.escape(SS.thumbnail(group))}" alt="">
            <div class="big-purpose">${SS.icon(group.purpose)}</div>
            <div>
              <div class="group-title-meta"><span class="purpose-badge light">${SS.label(group.purpose)}</span>${isAdmin ? '<span class="admin-badge">♛ Admin</span>' : ''}</div>
              <h1>${SS.escape(group.name)}</h1>
              <p>${group.purpose === 'trip' && group.meta?.destination ? `📍 ${SS.escape(group.meta.destination)} · ` : ''}${activeMembers.length} active members · Created by ${SS.escape(group.creatorName)}</p>
            </div>
          </div>
        </div>
        <div class="group-header-actions">
          ${isAdmin ? '<button class="btn btn-danger-outline" id="deleteGroup">⌫ Delete Group</button>' : ''}
          <button class="btn btn-white" id="openExpense">＋ Add Expense</button>
        </div>
      </div>

      <div class="group-summary">
        <div><span>Total expense</span><strong>${SS.money(total)}</strong><small>${group.expenses.length} expense${group.expenses.length === 1 ? '' : 's'}</small></div>
        <div><span>Members</span><strong>${activeMembers.length}</strong><small>${isAdmin ? 'You are the admin' : 'Active members'}</small></div>
        <div><span>Settlement transfers</span><strong>${settlements.length}</strong><small>Optimized transactions</small></div>
        <div class="my-balance ${myBalance > .009 ? 'receive' : myBalance < -.009 ? 'owe' : 'settled'}"><span>Your balance</span><strong>${myBalance > .009 ? '+' : ''}${SS.money(myBalance)}</strong><small>${myBalance > .009 ? 'You receive' : myBalance < -.009 ? 'You owe' : 'All settled'}</small></div>
      </div>

      <div class="group-main-grid">
        <section class="panel">
          <div class="panel-head"><div><span class="kicker">Activity</span><h2>Expense history</h2></div><button class="btn btn-primary btn-sm" id="openExpense2">＋ Add Expense</button></div>
          <div id="expenses"></div>
        </section>
        <aside class="panel members-panel">
          <div class="panel-head"><div><span class="kicker">People</span><h2>Members</h2></div>${isAdmin ? '<button class="btn btn-soft btn-sm" id="inviteBtn">＋ Invite</button>' : ''}</div>
          <div class="member-list">
            ${activeMembers.map(m => `<div class="member-row"><span class="avatar">${SS.initials(m.name)}</span><div><strong>${SS.escape(m.name)}${m.userId === user.id ? ' <span class="you-tag">You</span>' : ''}</strong><small>${m.userId === group.creator ? 'Admin · ' : ''}${SS.escape(m.email)}</small></div>${m.userId === group.creator ? '<span class="admin-crown">♛</span>' : (isAdmin ? `<button class="member-action remove-member" data-id="${SS.escape(m.userId)}" title="Remove member">−</button>` : '<span class="member-dot"></span>')}</div>`).join('')}
          </div>
          ${group.members.some(m => m.status === 'removed') ? `<div class="removed-members"><span>Removed members</span><small>${group.members.filter(m => m.status === 'removed').map(m => SS.escape(m.name)).join(', ')}</small></div>` : ''}
          ${isAdmin ? '<div class="admin-note"><strong>♛ Admin controls</strong><span>You can remove members or delete this group.</span></div>' : ''}
        </aside>
      </div>

      <section class="panel balance-panel">
        <div class="panel-head"><div><span class="kicker">Financial position</span><h2>Balances</h2></div><span class="formula">Paid − Share = Balance</span></div>
        <div class="balance-row balance-head"><span>Member</span><span>Paid</span><span class="desktop-only">Share</span><span>Balance</span></div>
        <div id="balances"></div>
      </section>

      <section class="panel settlement-panel">
        <div class="panel-head"><div><span class="kicker">The smart part</span><h2>Settlement plan</h2><p>Raw balances are reduced to the minimum practical transfers.</p></div><span class="status-pill success">${settlements.length} transfer${settlements.length === 1 ? '' : 's'}</span></div>
        <div class="before-after"><div><span class="compare-label">BEFORE · RAW BALANCES</span><div class="raw-list">${balances.map(b => `<div><span>${SS.escape(b.name)}</span><strong class="${b.balance > .009 ? 'positive' : b.balance < -.009 ? 'negative' : 'zero'}">${b.balance > .009 ? '+' : ''}${SS.money(b.balance)}</strong></div>`).join('')}</div></div><div class="compare-arrow">→</div><div><span class="compare-label">AFTER · OPTIMIZED</span><div id="settlement" class="settlement-list"></div></div></div>
      </section>`;
        SS.render.expenses(group, document.getElementById('expenses'), {
            onEdit: expenseId => this.openExpense(SS.group(id), SS.group(id)?.expenses.find(e => e.id === expenseId) || null),
            onChanged: () => this.render(id)
        });
        SS.render.balances(balances, document.getElementById('balances'));
        SS.render.settlement(settlements, document.getElementById('settlement'), group, { onChanged: () => this.render(id) });
        document.getElementById('openExpense')?.addEventListener('click', () => this.openExpense(SS.group(id)));
        document.getElementById('openExpense2')?.addEventListener('click', () => this.openExpense(SS.group(id)));
        document.getElementById('inviteBtn')?.addEventListener('click', () => this.openInvite());
    },
    deleteGroup(group) {
        if (group.creator !== SS.currentUser()?.id)
            return SS.toast('Only the group admin can delete this group.');
        if (!confirm(`Delete "${group.name}"? This will remove the group and its invitations.`))
            return;
        try {
            SS.groups.delete(group.id);
            SS.toast('Group deleted.');
            setTimeout(() => location.href = 'my-groups.html', 350);
        }
        catch (e) {
            SS.toast(e.message);
        }
    },
    removeMember(group, userId) {
        if (group.creator !== SS.currentUser()?.id)
            return SS.toast('Only the group admin can remove members.');
        const member = group.members.find(m => m.userId === userId);
        if (!member)
            return;
        if (!confirm(`Remove ${member.name} from ${group.name}? They will lose access to this group, but historical expenses remain.`))
            return;
        try {
            SS.groups.removeMember(group.id, userId);
            SS.toast(`${member.name} removed from the group.`);
            setTimeout(() => this.render(group.id), 250);
        }
        catch (e) {
            SS.toast(e.message);
        }
    },
    modals() {
        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => button.closest('.modal-backdrop')?.classList.remove('open'));
        });
        const ef = document.getElementById('expenseForm');
        if (ef)
            ef.addEventListener('submit', e => {
                e.preventDefault();
                const id = SS.query('id');
                const splitMode = document.getElementById('splitMode')?.value || 'equal';
                const participants = [...ef.querySelectorAll('input[name="participant"]:checked')].map(x => x.value);
                const shares = {};
                ef.querySelectorAll('.manual-share-input').forEach(input => { shares[input.dataset.userId] = input.value; });
                const payload = {
                    description: document.getElementById('expenseDescription').value,
                    amount: document.getElementById('expenseAmount').value,
                    paidBy: document.getElementById('paidBy').value,
                    participants,
                    splitMode,
                    shares
                };
                const error = document.getElementById('expenseError');
                error.textContent = '';
                try {
                    if (this.editingExpenseId) {
                        SS.expenses.update(id, this.editingExpenseId, payload);
                        SS.toast('Expense updated. Balances recalculated.');
                    }
                    else {
                        SS.expenses.add(id, payload);
                        SS.toast('Expense added. Balances updated.');
                    }
                    document.getElementById('expenseModal').classList.remove('open');
                    this.editingExpenseId = null;
                    this.editingShares = {};
                    this.render(id);
                }
                catch (x) {
                    error.textContent = x.message;
                }
            });
        document.getElementById('splitMode')?.addEventListener('change', () => this.updateSplitMode());
        document.getElementById('expenseAmount')?.addEventListener('input', () => this.updateSplitMode());
        document.getElementById('participants')?.addEventListener('change', e => {
            if (e.target.matches('input[name="participant"]'))
                this.updateSplitMode();
        });
        const inf = document.getElementById('inviteForm');
        if (inf)
            inf.addEventListener('submit', async (e) => {
                e.preventDefault();
                const error = document.getElementById('inviteError');
                error.textContent = '';
                try {
                    const group = SS.group(SS.query('id'));
                    if (!group || group.creator !== SS.currentUser()?.id)
                        throw new Error('Only the group admin can send invitations.');
                    const invitation = SS.invitations.create(group.id, document.getElementById('inviteName').value, document.getElementById('inviteEmail').value);
                    await SS.invitations.send(invitation);
                    document.getElementById('inviteResults').innerHTML = `<div class="invite-generated"><span class="status-pill pending">Pending</span><strong>${SS.escape(invitation.name)}</strong><p>Invitation created for <b>${SS.escape(invitation.email)}</b>.</p><div class="demo-token">${SS.escape(invitation.token)}</div><small>Demo invitation · Expires ${SS.escape(SS.formatDate(invitation.expiresAt))}. The recipient must log in with this email in this browser.</small></div>`;
                    inf.reset();
                    SS.toast('Demo invitation created.');
                }
                catch (x) {
                    error.textContent = x.message;
                }
            });
    },
    openExpense(group, expense = null) {
        if (!group || !SS.groups.member(group, SS.currentUser()?.id))
            return SS.toast('You are not an active member of this group.');
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');
        if (!modal || !form)
            return;
        this.editingExpenseId = expense?.id || null;
        this.editingShares = expense?.shares ? { ...expense.shares } : {};
        form.reset();
        document.getElementById('expenseError').textContent = '';
        const title = document.querySelector('#expenseModal .modal-head h2');
        const submit = form.querySelector('button[type="submit"]');
        if (title)
            title.textContent = expense ? 'Edit an expense' : 'Add an expense';
        if (submit)
            submit.textContent = expense ? 'Save Changes' : 'Add Expense';
        const activeMembers = SS.groups.activeMembers(group);
        document.getElementById('paidBy').innerHTML = activeMembers.map(x => `<option value="${SS.escape(x.userId)}">${SS.escape(x.name)}${x.userId === SS.currentUser()?.id ? ' (You)' : ''}</option>`).join('');
        document.getElementById('participants').innerHTML = activeMembers.map(x => `<label class="check participant-check"><input type="checkbox" name="participant" value="${SS.escape(x.userId)}" checked><span class="participant-name">${SS.escape(x.name)}${x.userId === SS.currentUser()?.id ? ' (You)' : ''}</span></label>`).join('');
        if (expense) {
            document.getElementById('expenseDescription').value = expense.description || '';
            document.getElementById('expenseAmount').value = Number(expense.amount).toFixed(2);
            document.getElementById('paidBy').value = expense.paidBy || '';
            document.getElementById('splitMode').value = expense.splitMode === 'manual' ? 'manual' : 'equal';
            const participantSet = new Set(Array.isArray(expense.participants) ? expense.participants : []);
            document.querySelectorAll('input[name="participant"]').forEach(input => { input.checked = participantSet.has(input.value); });
        }
        else {
            document.getElementById('splitMode').value = 'equal';
        }
        this.updateSplitMode();
        modal.classList.add('open');
    },
    updateSplitMode() {
        const manual = document.getElementById('splitMode')?.value === 'manual';
        const panel = document.getElementById('manualShares');
        const hint = document.getElementById('manualShareHint');
        if (!panel)
            return;
        if (!manual) {
            panel.classList.add('hide');
            hint?.classList.add('hide');
            return;
        }
        panel.classList.remove('hide');
        hint?.classList.remove('hide');
        const amount = Number(document.getElementById('expenseAmount').value) || 0;
        const previous = { ...this.editingShares };
        panel.querySelectorAll('.manual-share-input').forEach(input => { previous[input.dataset.userId] = input.value; });
        const checks = [...document.querySelectorAll('input[name="participant"]')].filter(x => x.checked);
        panel.innerHTML = checks.map(x => {
            const label = x.closest('label')?.querySelector('.participant-name')?.textContent || 'Member';
            const oldValue = previous[x.value] ?? '';
            return `<div class="manual-share-row"><span>${SS.escape(label)}</span><div class="manual-input-wrap"><span>₹</span><input class="manual-share-input" data-user-id="${SS.escape(x.value)}" type="number" min="0" step="0.01" value="${SS.escape(oldValue)}" placeholder="0.00"></div></div>`;
        }).join('');
        if (hint)
            hint.textContent = amount ? `Enter amounts that add up exactly to ${SS.money(amount)}.` : 'Enter each person\'s share after entering the total expense.';
    },
    openInvite() {
        const group = SS.group(SS.query('id'));
        if (!group || group.creator !== SS.currentUser()?.id)
            return SS.toast('Only the group admin can send invitations.');
        document.getElementById('inviteForm')?.reset();
        document.getElementById('inviteError').textContent = '';
        document.getElementById('inviteResults').innerHTML = '';
        document.getElementById('inviteModal').classList.add('open');
    }
};

