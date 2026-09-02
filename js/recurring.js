SS.recurring = {
    due(group, now = new Date()) {
        if (!group || group.purpose !== 'household') return [];
        const today = new Date(now).toISOString().slice(0, 10);
        return (group.expenses || []).map(expense => SS.expenses.normalize(expense)).filter(expense => {
            if (!expense.isRecurring || !expense.nextDueDate) return false;
            if (expense.endDate && expense.nextDueDate > expense.endDate) return false;
            return expense.nextDueDate <= today;
        });
    },
    advanceDate(date, frequency) {
        const d = new Date(`${date}T12:00:00`);
        if (frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toISOString().slice(0, 10);
    },
    generate(groupId, templateId) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user) throw new Error('Group unavailable.');
        if (group.purpose !== 'household') throw new Error('Recurring expenses are available for Household groups only.');
        if (!SS.groups.member(group, user.id)) throw new Error('Only active members can generate recurring expenses.');
        const template = group.expenses?.find(expense => expense.id === templateId);
        if (!template || !template.isRecurring) throw new Error('Recurring expense template not found.');
        const dueDate = template.nextDueDate;
        if (!dueDate) throw new Error('This recurring expense has no next due date.');
        const duplicate = (group.expenses || []).some(expense => expense.recurringGeneratedFrom === templateId && expense.recurringPeriod === dueDate);
        if (duplicate) throw new Error('This recurring occurrence has already been generated.');
        const copy = SS.expenses.normalize({
            ...template,
            id: SS.uid('EXP'),
            date: SS.now(),
            createdAt: SS.now(),
            updatedAt: '',
            addedBy: user.id,
            isRecurring: false,
            frequency: '',
            startDate: '',
            nextDueDate: '',
            endDate: '',
            recurringGeneratedFrom: templateId,
            recurringPeriod: dueDate
        });
        group.expenses.push(copy);
        const currentTemplate = group.expenses.find(expense => expense.id === templateId);
        currentTemplate.lastGeneratedAt = SS.now();
        currentTemplate.lastGeneratedForPeriod = dueDate;
        currentTemplate.nextDueDate = this.advanceDate(dueDate, currentTemplate.frequency);
        if (currentTemplate.endDate && currentTemplate.nextDueDate > currentTemplate.endDate) currentTemplate.completedRecurring = true;
        SS.groups.update(group);
        return copy;
    }
};
