SS.calculations = {
    _members(group) { return Array.isArray(group?.members) ? group.members : []; },
    _expenses(group) { return Array.isArray(group?.expenses) ? group.expenses.map(expense => SS.expenses?.normalize ? SS.expenses.normalize(expense) : expense) : []; },
    roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; },
    balances(group) {
        const map = {};
        this._members(group).forEach(member => {
            map[member.userId] = {
                userId: member.userId,
                name: member.name || 'Member',
                paid: 0,
                share: 0,
                balance: 0,
                status: member.status || 'accepted'
            };
        });
        this._expenses(group).forEach(expense => {
            const amount = Number(expense.amount);
            if (!Number.isFinite(amount) || amount < 0) return;
            if (map[expense.paidBy]) map[expense.paidBy].paid += amount;
            const participants = Array.isArray(expense.participants) ? expense.participants : [];
            participants.forEach(id => {
                if (!map[id]) return;
                const share = expense.shares && Object.prototype.hasOwnProperty.call(expense.shares, id)
                    ? Number(expense.shares[id])
                    : (participants.length ? amount / participants.length : 0);
                if (Number.isFinite(share) && share >= 0) map[id].share += share;
            });
        });
        return Object.values(map).map(balance => ({
            ...balance,
            paid: this.roundMoney(balance.paid),
            share: this.roundMoney(balance.share),
            balance: this.roundMoney(balance.paid - balance.share)
        }));
    },
    simplify(group) {
        const balances = this.balances(group).filter(balance => balance.status !== 'removed' || Math.abs(balance.balance) > 0.009);
        const creditors = balances.filter(balance => balance.balance > 0.009).map(balance => ({ ...balance, amount: balance.balance })).sort((a, b) => b.amount - a.amount);
        const debtors = balances.filter(balance => balance.balance < -0.009).map(balance => ({ ...balance, amount: -balance.balance })).sort((a, b) => b.amount - a.amount);
        const result = [];
        let debtorIndex = 0;
        let creditorIndex = 0;
        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];
            const amount = this.roundMoney(Math.min(debtor.amount, creditor.amount));
            if (amount > 0) result.push({
                key: this.settlementKey({ fromId: debtor.userId, toId: creditor.userId, amount }),
                from: debtor.name,
                to: creditor.name,
                fromId: debtor.userId,
                toId: creditor.userId,
                amount
            });
            debtor.amount = this.roundMoney(debtor.amount - amount);
            creditor.amount = this.roundMoney(creditor.amount - amount);
            if (debtor.amount <= 0.009) debtorIndex++;
            if (creditor.amount <= 0.009) creditorIndex++;
        }
        return result;
    },
    settlementKey(settlement) { return `${settlement.fromId}|${settlement.toId}|${this.roundMoney(settlement.amount).toFixed(2)}`; },
    settlementFingerprint(group) {
        return (this._expenses(group).map(expense => `${expense.id}:${expense.updatedAt || expense.date || ''}:${expense.amount}:${expense.paidBy}:${(expense.participants || []).join(',')}:${JSON.stringify(expense.shares || {})}`).join('~')) || 'empty';
    },
    settlementStatusKey(group, settlement) { return `${this.settlementFingerprint(group)}|${this.settlementKey(settlement)}`; },
    settlementId(groupId, group, settlement) { return `${groupId}|${this.settlementStatusKey(group, settlement)}`; },
    settlementStatus(group, settlement) {
        const map = group?.settlementStatuses && typeof group.settlementStatuses === 'object' ? group.settlementStatuses : {};
        return map[this.settlementStatusKey(group, settlement)]?.status === 'paid' ? 'paid' : 'pending';
    },
    syncSettlementStatuses(group, settlements = this.simplify(group)) {
        if (!group) return settlements;
        if (!group.settlementStatuses || typeof group.settlementStatuses !== 'object' || Array.isArray(group.settlementStatuses)) group.settlementStatuses = {};
        return settlements;
    },
    markSettlementPaid(groupId, settlement) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user) throw new Error('Group unavailable.');
        if (!SS.groups.member(group, user.id)) throw new Error('Only accepted group members can mark a settlement as paid.');
        const current = this.simplify(group).find(item => this.settlementKey(item) === this.settlementKey(settlement));
        if (!current) throw new Error('This settlement is no longer current. Recalculate and try again.');
        if (!group.settlementStatuses || typeof group.settlementStatuses !== 'object') group.settlementStatuses = {};
        const key = this.settlementStatusKey(group, current);
        if (group.settlementStatuses[key]?.status === 'paid') return group;
        const paidAt = SS.now();
        group.settlementStatuses[key] = { status: 'paid', paidAt, markedBy: user.id };
        SS.groups.update(group);
        const history = SS.storage.settlementHistory();
        const id = this.settlementId(groupId, group, current);
        if (!history.some(record => record.id === id)) {
            history.unshift({
                id,
                fromId: current.fromId,
                from: current.from,
                toId: current.toId,
                to: current.to,
                amount: this.roundMoney(current.amount),
                groupId,
                groupName: group.name,
                status: 'paid',
                paidAt,
                markedBy: user.id
            });
            SS.storage.replaceSettlementHistory(history);
        }
        return group;
    },
    categorySpending(groups, userId = null) {
        const totals = {};
        (groups || []).forEach(group => this._expenses(group).forEach(expense => {
            if (userId && !expense.participants.includes(userId) && expense.paidBy !== userId) return;
            const category = expense.category || 'Other';
            totals[category] = this.roundMoney((totals[category] || 0) + Number(expense.amount || 0));
        }));
        return Object.entries(totals).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    },
    dashboardSummary(groups, userId) {
        let totalTracked = 0;
        let userPaid = 0;
        let userShare = 0;
        let owedToUser = 0;
        let userOwes = 0;
        const recentExpenses = [];
        (groups || []).forEach(group => {
            const expenses = this._expenses(group);
            expenses.forEach(expense => {
                const amount = Number(expense.amount) || 0;
                totalTracked += amount;
                if (expense.paidBy === userId) userPaid += amount;
                if (Array.isArray(expense.participants) && expense.participants.includes(userId)) {
                    const share = expense.shares && Object.prototype.hasOwnProperty.call(expense.shares, userId)
                        ? Number(expense.shares[userId]) : amount / Math.max(1, expense.participants.length);
                    userShare += Number.isFinite(share) ? share : 0;
                }
                recentExpenses.push({ ...expense, groupId: group.id, groupName: group.name });
            });
            const balance = this.balances(group).find(item => item.userId === userId)?.balance || 0;
            if (balance > 0.009) owedToUser += balance;
            if (balance < -0.009) userOwes += -balance;
        });
        recentExpenses.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        return {
            totalTracked: this.roundMoney(totalTracked),
            userPaid: this.roundMoney(userPaid),
            userShare: this.roundMoney(userShare),
            netBalance: this.roundMoney(userPaid - userShare),
            owedToUser: this.roundMoney(owedToUser),
            userOwes: this.roundMoney(userOwes),
            recentExpenses: recentExpenses.slice(0, 6),
            categorySpending: this.categorySpending(groups, userId)
        };
    }
};
