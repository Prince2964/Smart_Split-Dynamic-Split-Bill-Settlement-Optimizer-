SS.calculations = {
    _members(group) {
        return Array.isArray(group?.members) ? group.members : [];
    },
    _expenses(group) {
        return Array.isArray(group?.expenses) ? group.expenses : [];
    },
    balances(group) {
        const map = {};
        this._members(group).forEach(m => {
            map[m.userId] = {
                userId: m.userId,
                name: m.name || 'Member',
                paid: 0,
                share: 0,
                balance: 0,
                status: m.status || 'accepted'
            };
        });
        this._expenses(group).forEach(e => {
            const amount = Number(e.amount);
            if (!Number.isFinite(amount) || amount < 0)
                return;
            if (map[e.paidBy])
                map[e.paidBy].paid += amount;
            const participants = Array.isArray(e.participants) ? e.participants : [];
            participants.forEach(id => {
                if (!map[id])
                    return;
                let share;
                if (e.shares && Object.prototype.hasOwnProperty.call(e.shares, id)) {
                    share = Number(e.shares[id]);
                }
                else {
                    share = participants.length ? amount / participants.length : 0;
                }
                if (Number.isFinite(share) && share >= 0)
                    map[id].share += share;
            });
        });
        return Object.values(map).map(b => ({
            ...b,
            paid: this.roundMoney(b.paid),
            share: this.roundMoney(b.share),
            balance: this.roundMoney(b.paid - b.share)
        }));
    },
    roundMoney(value) {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    },
    simplify(group) {
        // Keep removed members with a non-zero historical balance so their
        // outstanding financial position is not silently erased.
        const balances = this.balances(group).filter(b => b.status !== 'removed' || Math.abs(b.balance) > 0.009);
        const creditors = balances
            .filter(b => b.balance > 0.009)
            .map(b => ({ ...b, amount: b.balance }))
            .sort((a, b) => b.amount - a.amount);
        const debtors = balances
            .filter(b => b.balance < -0.009)
            .map(b => ({ ...b, amount: -b.balance }))
            .sort((a, b) => b.amount - a.amount);
        const result = [];
        let d = 0;
        let c = 0;
        while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d];
            const creditor = creditors[c];
            const amount = this.roundMoney(Math.min(debtor.amount, creditor.amount));
            if (amount > 0) {
                result.push({
                    key: this.settlementKey({ fromId: debtor.userId, toId: creditor.userId, amount }),
                    from: debtor.name,
                    to: creditor.name,
                    fromId: debtor.userId,
                    toId: creditor.userId,
                    amount
                });
            }
            debtor.amount = this.roundMoney(debtor.amount - amount);
            creditor.amount = this.roundMoney(creditor.amount - amount);
            if (debtor.amount <= 0.009)
                d++;
            if (creditor.amount <= 0.009)
                c++;
        }
        return result;
    },
    settlementKey(settlement) {
        return `${settlement.fromId}|${settlement.toId}|${this.roundMoney(settlement.amount).toFixed(2)}`;
    },
    settlementStatus(group, settlement) {
        const map = group?.settlementStatuses && typeof group.settlementStatuses === 'object'
            ? group.settlementStatuses
            : {};
        return map[this.settlementKey(settlement)]?.status === 'paid' ? 'paid' : 'pending';
    },
    syncSettlementStatuses(group, settlements = this.simplify(group)) {
        if (!group)
            return settlements;
        if (!group.settlementStatuses || typeof group.settlementStatuses !== 'object' || Array.isArray(group.settlementStatuses)) {
            group.settlementStatuses = {};
        }
        const validKeys = new Set(settlements.map(s => this.settlementKey(s)));
        // Remove stale keys only when they no longer describe a current transfer.
        // Historical expense data is preserved; this map only tracks current payment state.
        Object.keys(group.settlementStatuses).forEach(key => {
            if (!key || !key.includes('|'))
                delete group.settlementStatuses[key];
        });
        // Do not create a record for every pending settlement. A record is only
        // created when a user marks a transfer as paid.
        void validKeys;
        return settlements;
    },
    markSettlementPaid(groupId, settlement) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user)
            throw new Error('Group unavailable.');
        if (!SS.groups.member(group, user.id))
            throw new Error('Only accepted group members can update settlements.');
        const current = this.simplify(group);
        const key = this.settlementKey(settlement);
        const match = current.find(s => this.settlementKey(s) === key);
        if (!match)
            throw new Error('This settlement is no longer current. Recalculate the group first.');
        if (!group.settlementStatuses || typeof group.settlementStatuses !== 'object' || Array.isArray(group.settlementStatuses)) {
            group.settlementStatuses = {};
        }
        group.settlementStatuses[key] = {
            status: 'paid',
            paidAt: SS.now(),
            fromId: match.fromId,
            toId: match.toId,
            amount: match.amount
        };
        SS.groups.update(group);
        return group;
    },
    dashboardSummary(groups, userId) {
        const safeGroups = Array.isArray(groups) ? groups : [];
        let totalTracked = 0;
        let userPaid = 0;
        let userShare = 0;
        let owedToUser = 0;
        let userOwes = 0;
        let recentExpenses = [];
        safeGroups.forEach(group => {
            const expenses = this._expenses(group);
            totalTracked += expenses.reduce((sum, e) => sum + (Number.isFinite(Number(e.amount)) ? Number(e.amount) : 0), 0);
            const balance = this.balances(group).find(b => b.userId === userId);
            if (balance) {
                userPaid += balance.paid;
                userShare += balance.share;
                if (balance.balance > 0.009)
                    owedToUser += balance.balance;
                if (balance.balance < -0.009)
                    userOwes += -balance.balance;
            }
            recentExpenses = recentExpenses.concat(expenses.map(e => ({ ...e, groupId: group.id, groupName: group.name })));
        });
        recentExpenses.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return {
            totalTracked: this.roundMoney(totalTracked),
            userPaid: this.roundMoney(userPaid),
            userShare: this.roundMoney(userShare),
            netBalance: this.roundMoney(userPaid - userShare),
            owedToUser: this.roundMoney(owedToUser),
            userOwes: this.roundMoney(userOwes),
            recentExpenses: recentExpenses.slice(0, 5)
        };
    }
};

