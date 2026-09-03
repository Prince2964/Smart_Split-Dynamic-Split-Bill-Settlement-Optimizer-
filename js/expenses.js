SS.expenses = {
    normalize(expense = {}) {
        const category = SS.expenseCategories.some(item => item.value === expense.category) ? expense.category : 'Other';
        return {
            ...expense,
            category,
            note: String(expense.note || ''),
            isRecurring: Boolean(expense.isRecurring),
            frequency: ['weekly', 'monthly', 'yearly'].includes(expense.frequency) ? expense.frequency : '',
            startDate: expense.startDate || '',
            nextDueDate: expense.nextDueDate || '',
            endDate: expense.endDate || '',
            participants: Array.isArray(expense.participants) ? expense.participants : [],
            shares: expense.shares && typeof expense.shares === 'object' ? expense.shares : {}
        };
    },
    normalizeGroup(group) {
        if (!group || !Array.isArray(group.expenses)) return group;
        let changed = false;
        group.expenses = group.expenses.map(expense => {
            const normalized = this.normalize(expense);
            if (JSON.stringify(normalized) !== JSON.stringify(expense)) changed = true;
            return normalized;
        });
        if (changed) SS.groups.update(group);
        return group;
    },
    _validateInput(group, data) {
        const description = String(data.description || '').trim();
        const value = Number(data.amount);
        const splitMode = data.splitMode === 'manual' ? 'manual' : 'equal';
        const participants = [...new Set(Array.isArray(data.participants) ? data.participants.filter(Boolean) : [])];
        const shares = data.shares && typeof data.shares === 'object' ? data.shares : {};
        const category = SS.expenseCategories.some(item => item.value === data.category) ? data.category : 'Other';
        const note = String(data.note || '').trim();
        const isRecurring = Boolean(data.isRecurring);
        const frequency = String(data.frequency || '').toLowerCase();
        const startDate = String(data.startDate || '').trim();
        const nextDueDate = String(data.nextDueDate || '').trim();
        const endDate = String(data.endDate || '').trim();

        if (!description) throw new Error('Enter an expense description.');
        if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a valid amount greater than ₹0.');
        if (!SS.groups.member(group, data.paidBy)) throw new Error('Select a valid payer from the active group members.');
        if (!participants.length) throw new Error('Select at least one participant.');
        const activeIds = new Set(SS.groups.activeMembers(group).map(member => member.userId));
        if (participants.some(id => !activeIds.has(id))) throw new Error('Only active group members can be selected for a new expense.');
        if (isRecurring) {
            if (group.purpose !== 'household') throw new Error('Recurring expenses are available for Household groups only.');
            if (!['weekly', 'monthly', 'yearly'].includes(frequency)) throw new Error('Choose a valid recurring frequency.');
            if (!startDate || Number.isNaN(new Date(startDate).getTime())) throw new Error('Choose a valid recurring start date.');
            if (!nextDueDate || Number.isNaN(new Date(nextDueDate).getTime())) throw new Error('Choose a valid next due date.');
            if (endDate && Number.isNaN(new Date(endDate).getTime())) throw new Error('Choose a valid recurring end date.');
            if (endDate && nextDueDate > endDate) throw new Error('Next due date cannot be after the recurring end date.');
        }

        const normalizedShares = {};
        if (splitMode === 'manual') {
            let totalCents = 0;
            participants.forEach(id => {
                const raw = shares[id];
                if (raw === '' || raw === null || raw === undefined) throw new Error('Enter a share for every selected member.');
                const share = Number(raw);
                if (!Number.isFinite(share) || share < 0) throw new Error('Every custom share must be a valid non-negative amount.');
                const cents = Math.round(share * 100);
                totalCents += cents;
                normalizedShares[id] = cents / 100;
            });
            const amountCents = Math.round(value * 100);
            if (totalCents !== amountCents) {
                throw new Error(`Custom shares must add up to ${SS.money(amountCents / 100)}. Current total is ${SS.money(totalCents / 100)}.`);
            }
        } else {
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
            shares: normalizedShares,
            category,
            note,
            isRecurring,
            frequency: isRecurring ? frequency : '',
            startDate: isRecurring ? startDate : '',
            nextDueDate: isRecurring ? nextDueDate : '',
            endDate: isRecurring ? endDate : ''
        };
    },
    add(groupId, data) {
        const user = SS.currentUser();
        const group = SS.group(groupId);
        if (!group || !user) throw new Error('Group unavailable.');
        if (!SS.groups.member(group, user.id)) throw new Error('Only accepted members can add expenses.');
        const clean = this._validateInput(group, data);
        const payer = SS.groups.member(group, clean.paidBy);
        group.expenses = Array.isArray(group.expenses) ? group.expenses : [];
        group.expenses.push({
            id: SS.uid('EXP'),
            ...clean,
            paidByName: payer.name,
            date: SS.now(),
            createdAt: SS.now(),
            addedBy: user.id,
            updatedAt: ''
        });
        SS.groups.update(group);
        return group;
    },
    update(groupId, expenseId, data) {
        const user = SS.currentUser();
        const group = SS.group(groupId);
        const expense = group?.expenses.find(item => item.id === expenseId);
        if (!group || !expense || !user) throw new Error('Expense not found.');
        if (!SS.groups.member(group, user.id)) throw new Error('Only accepted members can edit expenses.');
        if (expense.addedBy !== user.id && group.creator !== user.id) throw new Error('Only the expense creator or group admin can edit it.');
        const clean = this._validateInput(group, data);
        const payer = SS.groups.member(group, clean.paidBy);
        Object.assign(expense, clean, { paidByName: payer.name, updatedAt: SS.now() });
        SS.groups.update(group);
        return group;
    },
    remove(groupId, expenseId) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        const expense = group?.expenses.find(item => item.id === expenseId);
        if (!group || !expense || !user) throw new Error('Expense not found.');
        if (expense.addedBy !== user.id && group.creator !== user.id) throw new Error('Only the expense creator or group admin can delete it.');
        group.expenses = group.expenses.filter(item => item.id !== expenseId);
        SS.groups.update(group);
        return { group, expense: this.normalize(expense) };
    },
    restore(groupId, expense) {
        const group = SS.group(groupId);
        if (!group || !expense?.id) throw new Error('Expense could not be restored.');
        group.expenses = Array.isArray(group.expenses) ? group.expenses : [];
        if (group.expenses.some(item => item.id === expense.id)) throw new Error('This expense has already been restored.');
        group.expenses.push(this.normalize(expense));
        SS.groups.update(group);
        return group;
    },
    filters(expenses, filters = {}) {
        const search = String(filters.search || '').trim().toLowerCase();
        const category = filters.category || 'all';
        const payer = filters.payer || 'all';
        const min = filters.minAmount === '' || filters.minAmount == null ? null : Number(filters.minAmount);
        const max = filters.maxAmount === '' || filters.maxAmount == null ? null : Number(filters.maxAmount);
        const from = filters.dateFrom || '';
        const to = filters.dateTo || '';
        let result = (Array.isArray(expenses) ? expenses : []).map(item => this.normalize(item));
        result = result.filter(expense => {
            const haystack = [expense.description, expense.category, expense.paidByName].join(' ').toLowerCase();
            const date = String(expense.date || expense.createdAt || '').slice(0, 10);
            return (!search || haystack.includes(search)) &&
                (category === 'all' || expense.category === category) &&
                (payer === 'all' || expense.paidBy === payer) &&
                (!Number.isFinite(min) || expense.amount >= min) &&
                (!Number.isFinite(max) || expense.amount <= max) &&
                (!from || date >= from) && (!to || date <= to);
        });
        const sort = filters.sort || 'newest';
        result.sort((a, b) => {
            if (sort === 'oldest') return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt);
            if (sort === 'highest') return b.amount - a.amount;
            if (sort === 'lowest') return a.amount - b.amount;
            if (sort === 'az') return a.description.localeCompare(b.description);
            if (sort === 'za') return b.description.localeCompare(a.description);
            return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
        });
        return result;
    }
};
