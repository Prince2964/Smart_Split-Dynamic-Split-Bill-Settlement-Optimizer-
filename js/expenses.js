SS.expenses = {
    _validateInput(group, data) {
        const description = String(data.description || '').trim();
        const value = Number(data.amount);
        const splitMode = data.splitMode === 'manual' ? 'manual' : 'equal';
        const participants = [...new Set(Array.isArray(data.participants) ? data.participants : [])];
        const shares = data.shares && typeof data.shares === 'object' ? data.shares : {};
        if (!description)
            throw new Error('Enter an expense description.');
        if (!Number.isFinite(value) || value <= 0)
            throw new Error('Enter a valid amount greater than ₹0.');
        if (!SS.groups.member(group, data.paidBy))
            throw new Error('Select a valid payer from the active group members.');
        if (!participants.length)
            throw new Error('Select at least one participant.');
        const activeIds = new Set(SS.groups.activeMembers(group).map(m => m.userId));
        if (participants.some(id => !activeIds.has(id)))
            throw new Error('Only active group members can be selected for a new expense.');
        const normalizedShares = {};
        if (splitMode === 'manual') {
            let totalCents = 0;
            participants.forEach(id => {
                const raw = shares[id];
                if (raw === '' || raw === null || raw === undefined)
                    throw new Error('Enter a share for every selected member.');
                const share = Number(raw);
                if (!Number.isFinite(share) || share < 0)
                    throw new Error('Every custom share must be a valid non-negative amount.');
                const cents = Math.round(share * 100);
                totalCents += cents;
                normalizedShares[id] = cents / 100;
            });
            const amountCents = Math.round(value * 100);
            if (totalCents !== amountCents) {
                throw new Error(`Custom shares must add up to ${SS.money(amountCents / 100)}. Current total is ${SS.money(totalCents / 100)}.`);
            }
        }
        else {
            const amountCents = Math.round(value * 100);
            const baseCents = Math.floor(amountCents / participants.length);
            let remainder = amountCents - baseCents * participants.length;
            participants.forEach(id => {
                const cents = baseCents + (remainder-- > 0 ? 1 : 0);
                normalizedShares[id] = cents / 100;
            });
        }
        return {
            description,
            amount: Math.round(value * 100) / 100,
            paidBy: data.paidBy,
            splitMode,
            participants,
            shares: normalizedShares
        };
    },
    add(groupId, data) {
        const user = SS.currentUser();
        const group = SS.group(groupId);
        if (!group || !user)
            throw new Error('Group unavailable.');
        if (!SS.groups.member(group, user.id))
            throw new Error('Only accepted members can add expenses.');
        const clean = this._validateInput(group, data);
        const payer = SS.groups.member(group, clean.paidBy);
        group.expenses = Array.isArray(group.expenses) ? group.expenses : [];
        group.expenses.push({
            id: SS.uid('EXP'),
            ...clean,
            paidByName: payer.name,
            date: SS.now(),
            addedBy: user.id,
            updatedAt: ''
        });
        SS.groups.update(group);
        return group;
    },
    update(groupId, expenseId, data) {
        const user = SS.currentUser();
        const group = SS.group(groupId);
        const expense = group?.expenses.find(e => e.id === expenseId);
        if (!group || !expense || !user)
            throw new Error('Expense not found.');
        if (!SS.groups.member(group, user.id))
            throw new Error('Only accepted members can edit expenses.');
        if (expense.addedBy !== user.id && group.creator !== user.id)
            throw new Error('Only the expense creator or group admin can edit it.');
        const clean = this._validateInput(group, data);
        const payer = SS.groups.member(group, clean.paidBy);
        Object.assign(expense, clean, {
            paidByName: payer.name,
            updatedAt: SS.now()
        });
        SS.groups.update(group);
        return group;
    },
    remove(groupId, expenseId) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        const expense = group?.expenses.find(e => e.id === expenseId);
        if (!group || !expense || !user)
            throw new Error('Expense not found.');
        if (expense.addedBy !== user.id && group.creator !== user.id)
            throw new Error('Only the expense creator or group admin can delete it.');
        group.expenses = group.expenses.filter(e => e.id !== expenseId);
        SS.groups.update(group);
        return group;
    }
};

