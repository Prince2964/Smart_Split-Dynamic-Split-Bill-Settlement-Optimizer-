/**
 * SplitSmart Phase 1.7 - Budget System
 * Dedicated module for group budget management, calculations, category tracking, and threshold alerts.
 */
SS.budget = {
    CORE_CATEGORIES: Object.freeze(['Travel', 'Hotel / Stay', 'Food', 'Activities']),

    CATEGORY_ICONS: Object.freeze({
        'Travel': '✈️',
        'Hotel / Stay': '🏨',
        'Food': '🍽️',
        'Activities': '🎯'
    }),

    // In-memory alert notification state: groupId -> { tier: 'none' | 'warning' | 'danger', notifiedAt: timestamp }
    _notifiedState: {},

    /**
     * Sanitizes and parses budget form values from FormData or plain object.
     */
    parseBudgetFormData(source = {}) {
        const parseNum = (val, label) => {
            if (val === undefined || val === null || String(val).trim() === '') return 0;
            const raw = String(val).trim();
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) {
                throw new Error(`${label} must be a valid amount of ₹0 or more.`);
            }
            if (Math.round(n * 100) / 100 !== n) {
                throw new Error(`${label} can have at most two decimal places.`);
            }
            return Math.round(n * 100) / 100;
        };

        const total = parseNum(source.budgetTotal ?? source.total, 'Total budget');
        const categories = {
            'Travel': parseNum(source.budgetCategory_Travel ?? source.categories?.['Travel'], 'Travel budget'),
            'Hotel / Stay': parseNum(source.budgetCategory_Hotel ?? source.categories?.['Hotel / Stay'], 'Hotel / Stay budget'),
            'Food': parseNum(source.budgetCategory_Food ?? source.categories?.['Food'], 'Food budget'),
            'Activities': parseNum(source.budgetCategory_Activities ?? source.categories?.['Activities'], 'Activities budget')
        };

        const categoryTotal = Math.round(Object.values(categories).reduce((sum, amount) => sum + amount, 0) * 100) / 100;
        if (total > 0 && categoryTotal > total) {
            throw new Error(`Category budgets total ${SS.money(categoryTotal)}, which is more than the overall budget ${SS.money(total)}. Increase the total budget or reduce category limits.`);
        }

        return { total, categories };
    },

    /**
     * Safely retrieves normalized budget object from a group.
     * Ensures backwards compatibility with groups that do not have budget data.
     */
    get(group) {
        const raw = group?.budget || {};
        const total = Number.isFinite(Number(raw.total)) && Number(raw.total) > 0 ? Number(raw.total) : 0;
        const rawCats = raw.categories || {};
        const categories = {
            'Travel': Number.isFinite(Number(rawCats['Travel'])) && Number(rawCats['Travel']) > 0 ? Number(rawCats['Travel']) : 0,
            'Hotel / Stay': Number.isFinite(Number(rawCats['Hotel / Stay'])) && Number(rawCats['Hotel / Stay']) > 0 ? Number(rawCats['Hotel / Stay']) : 0,
            'Food': Number.isFinite(Number(rawCats['Food'])) && Number(rawCats['Food']) > 0 ? Number(rawCats['Food']) : 0,
            'Activities': Number.isFinite(Number(rawCats['Activities'])) && Number(rawCats['Activities']) > 0 ? Number(rawCats['Activities']) : 0
        };

        const hasCategoryBudgets = Object.values(categories).some(val => val > 0);
        const isSet = total > 0 || hasCategoryBudgets;

        return {
            total,
            categories,
            isSet
        };
    },

    /**
     * Calculates all budget metrics from existing expenses.
     */
    calculate(group) {
        const budget = this.get(group);
        const expenses = Array.isArray(group?.expenses)
            ? group.expenses.map(e => SS.expenses?.normalize ? SS.expenses.normalize(e) : e)
            : [];

        // Sum total spent across all expenses
        let totalSpent = 0;
        const categorySpendingMap = {};

        expenses.forEach(exp => {
            const amount = Number(exp.amount);
            if (Number.isFinite(amount) && amount > 0) {
                totalSpent += amount;
                const cat = exp.category || 'Other';
                categorySpendingMap[cat] = (categorySpendingMap[cat] || 0) + amount;
            }
        });

        totalSpent = SS.calculations.roundMoney(totalSpent);

        const totalBudget = budget.total;
        const hasBudget = totalBudget > 0;
        const remaining = hasBudget ? SS.calculations.roundMoney(totalBudget - totalSpent) : 0;
        const percentUsed = hasBudget ? (totalSpent / totalBudget) * 100 : 0;
        const isOverBudget = hasBudget && totalSpent > totalBudget;
        const isWarning = hasBudget && percentUsed >= 80 && !isOverBudget;
        const overAmount = isOverBudget ? SS.calculations.roundMoney(totalSpent - totalBudget) : 0;

        // Category-wise calculations for the 4 core categories
        const categoryBreakdown = this.CORE_CATEGORIES.map(catName => {
            const catBudget = budget.categories[catName] || 0;
            const catSpent = SS.calculations.roundMoney(categorySpendingMap[catName] || 0);
            const hasCatBudget = catBudget > 0;
            const catRemaining = hasCatBudget ? SS.calculations.roundMoney(catBudget - catSpent) : 0;
            const catPercentUsed = hasCatBudget ? (catSpent / catBudget) * 100 : 0;
            const isCatOver = hasCatBudget && catSpent > catBudget;
            const isCatWarning = hasCatBudget && catPercentUsed >= 80 && !isCatOver;
            const catOverAmount = isCatOver ? SS.calculations.roundMoney(catSpent - catBudget) : 0;

            return {
                name: catName,
                icon: this.CATEGORY_ICONS[catName] || SS.categoryIcon(catName),
                budget: catBudget,
                hasBudget: hasCatBudget,
                spent: catSpent,
                remaining: catRemaining,
                percentUsed: catPercentUsed,
                isWarning: isCatWarning,
                isOverBudget: isCatOver,
                overAmount: catOverAmount
            };
        });

        // Other non-core categories with spending
        const otherCategories = Object.entries(categorySpendingMap)
            .filter(([cat]) => !this.CORE_CATEGORIES.includes(cat))
            .map(([cat, amount]) => ({
                name: cat,
                icon: SS.categoryIcon(cat),
                spent: SS.calculations.roundMoney(amount)
            }))
            .sort((a, b) => b.spent - a.spent);

        return {
            hasBudget,
            hasAnyBudget: budget.isSet,
            totalBudget,
            totalSpent,
            remaining,
            percentUsed,
            isWarning,
            isOverBudget,
            overAmount,
            categoryBreakdown,
            otherCategories,
            budgetRaw: budget
        };
    },

    /**
     * Checks budget alert thresholds (>= 80% warning, > 100% overspending alert)
     * and shows a toast notification if the threshold state has transitioned.
     * Prevents duplicate alerts on repetitive renders (such as typing in search).
     */
    checkAlerts(group, options = {}) {
        if (!group?.id) return;
        const stats = this.calculate(group);
        if (!stats.hasAnyBudget) return;

        let currentTier = 'none';
        if (stats.isOverBudget) {
            currentTier = 'danger';
        } else if (stats.isWarning) {
            currentTier = 'warning';
        }

        const prev = this._notifiedState[group.id] || { tier: 'none', categories: {} };

        // Overall budget alerts: only notify when crossing into a new tier.
        if (options.force || prev.tier !== currentTier) {
            if (currentTier === 'danger') {
                const message = `Budget exceeded: over by ${SS.money(stats.overAmount)}. Spent ${SS.money(stats.totalSpent)} of ${SS.money(stats.totalBudget)}.`;
                SS.notifications.error(message, { timeout: 6000 });
            } else if (currentTier === 'warning' && prev.tier !== 'danger') {
                const message = `Budget warning: ${Math.round(stats.percentUsed)}% of total budget used. ${SS.money(stats.remaining)} remaining.`;
                SS.notifications.warning(message, { timeout: 4500 });
            }
        }

        // Category alerts: track each category independently to avoid duplicate toasts on re-render.
        const categoryTiers = { ...(prev.categories || {}) };
        stats.categoryBreakdown.forEach(category => {
            if (!category.hasBudget) {
                categoryTiers[category.name] = 'none';
                return;
            }
            const tier = category.isOverBudget ? 'danger' : category.isWarning ? 'warning' : 'none';
            const previousTier = categoryTiers[category.name] || 'none';
            if ((options.force || previousTier !== tier) && tier !== 'none') {
                if (tier === 'danger') {
                    SS.notifications.error(`${category.name} budget exceeded by ${SS.money(category.overAmount)}.`, { timeout: 5500 });
                } else if (previousTier !== 'danger') {
                    SS.notifications.warning(`${category.name} budget warning: ${Math.round(category.percentUsed)}% used; ${SS.money(category.remaining)} remaining.`, { timeout: 4500 });
                }
            }
            categoryTiers[category.name] = tier;
        });

        this._notifiedState[group.id] = {
            tier: currentTier,
            categories: categoryTiers,
            lastOverAmount: stats.overAmount,
            notifiedAt: Date.now()
        };
    },

    /**
     * Renders the visually consistent Budget Summary section.
     */
    renderSummary(group, host, onUpdate) {
        if (!host || !group) return;
        const stats = this.calculate(group);
        const user = SS.currentUser();
        const isAdmin = group.creator === user?.id;

        // Progress bar percentage clamped for visual display
        const displayPercent = stats.hasBudget ? Math.min(100, Math.max(0, stats.percentUsed)) : 0;
        const progressClass = stats.isOverBudget ? 'progress-danger' : stats.isWarning ? 'progress-warning' : 'progress-normal';

        // Status badge in header
        let statusBadgeHtml = '';
        if (!stats.hasBudget) {
            statusBadgeHtml = '<span class="status-pill status-muted">Budget Not Set</span>';
        } else if (stats.isOverBudget) {
            statusBadgeHtml = `<span class="status-pill status-danger">🚨 Over Budget by ${SS.money(stats.overAmount)}</span>`;
        } else if (stats.isWarning) {
            statusBadgeHtml = `<span class="status-pill status-warning">⚠️ ${Math.round(stats.percentUsed)}% Used · Caution</span>`;
        } else {
            statusBadgeHtml = `<span class="status-pill status-success">✓ On Track · ${Math.round(stats.percentUsed)}% Used</span>`;
        }

        // Inline alert banner
        let alertBannerHtml = '';
        if (stats.hasBudget) {
            if (stats.isOverBudget) {
                alertBannerHtml = `
                    <div class="budget-alert-banner alert-danger">
                        <span class="alert-icon">🚨</span>
                        <div class="alert-content">
                            <strong>Overspending Alert: Budget Exceeded</strong>
                            <p>You have surpassed the group budget by <b>${SS.money(stats.overAmount)}</b> (Total spending: ${SS.money(stats.totalSpent)} / Budget: ${SS.money(stats.totalBudget)} · ${stats.percentUsed.toFixed(1)}% used).</p>
                        </div>
                    </div>
                `;
            } else if (stats.isWarning) {
                alertBannerHtml = `
                    <div class="budget-alert-banner alert-warning">
                        <span class="alert-icon">⚠️</span>
                        <div class="alert-content">
                            <strong>Budget Warning: 80% Threshold Reached</strong>
                            <p>You have consumed <b>${stats.percentUsed.toFixed(1)}%</b> of your total budget. Only <b>${SS.money(stats.remaining)}</b> remains before exceeding the limit.</p>
                        </div>
                    </div>
                `;
            }
        }

        // Metrics Row
        const remainingDisplay = !stats.hasBudget
            ? 'Not set'
            : stats.isOverBudget
                ? `<span class="text-danger">-${SS.money(stats.overAmount)}</span>`
                : `<span class="text-success">${SS.money(stats.remaining)}</span>`;

        const remainingHelper = !stats.hasBudget
            ? 'No cap defined'
            : stats.isOverBudget
                ? `Exceeded by ${SS.money(stats.overAmount)}`
                : `${SS.money(stats.remaining)} remaining`;

        const percentDisplay = stats.hasBudget ? `${stats.percentUsed.toFixed(1)}%` : 'Not set';

        // Category breakdown cards
        const categoryCardsHtml = stats.categoryBreakdown.map(cat => {
            const catProgressClass = cat.isOverBudget ? 'progress-danger' : cat.isWarning ? 'progress-warning' : 'progress-normal';
            const catDisplayPercent = cat.hasBudget ? Math.min(100, Math.max(0, cat.percentUsed)) : 0;

            let catMetaHtml = '';
            if (cat.hasBudget) {
                if (cat.isOverBudget) {
                    catMetaHtml = `<span class="cat-pill pill-danger">Over by ${SS.money(cat.overAmount)}</span>`;
                } else if (cat.isWarning) {
                    catMetaHtml = `<span class="cat-pill pill-warning">${cat.percentUsed.toFixed(0)}% used</span>`;
                } else {
                    catMetaHtml = `<span class="cat-pill pill-subtle">${SS.money(cat.remaining)} left</span>`;
                }
            } else {
                catMetaHtml = '<span class="cat-pill pill-muted">No cap set</span>';
            }

            return `
                <div class="budget-cat-card ${cat.isOverBudget ? 'card-danger' : ''}">
                    <div class="budget-cat-head">
                        <div class="budget-cat-title">
                            <span class="budget-cat-icon">${cat.icon}</span>
                            <strong>${SS.escape(cat.name)}</strong>
                        </div>
                        ${catMetaHtml}
                    </div>
                    <div class="budget-cat-amounts">
                        <div>
                            <span class="amount-label">Spent</span>
                            <span class="amount-val">${SS.money(cat.spent)}</span>
                        </div>
                        <div class="text-right">
                            <span class="amount-label">Budget</span>
                            <span class="amount-val">${cat.hasBudget ? SS.money(cat.budget) : 'Not set'}</span>
                        </div>
                    </div>
                    <div class="budget-progress-track cat-track">
                        <div class="budget-progress-fill ${catProgressClass}" style="width: ${catDisplayPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Other categories pill row (if any)
        let otherCategoriesHtml = '';
        if (stats.otherCategories.length > 0) {
            const items = stats.otherCategories.map(c => `
                <div class="other-cat-item">
                    <span>${c.icon} ${SS.escape(c.name)}</span>
                    <b>${SS.money(c.spent)}</b>
                </div>
            `).join('');

            otherCategoriesHtml = `
                <div class="other-spending-block">
                    <span class="other-spending-label">Other Category Spending (No specific cap set):</span>
                    <div class="other-spending-grid">${items}</div>
                </div>
            `;
        }

        // Full panel markup
        host.innerHTML = `
            <section class="panel budget-panel" id="budgetSectionPanel">
                <div class="panel-head budget-head">
                    <div>
                        <span class="kicker">Financial Limits &amp; Tracking</span>
                        <h2>Budget Summary</h2>
                    </div>
                    <div class="budget-head-actions">
                        ${statusBadgeHtml}
                        ${isAdmin ? '<button class="btn btn-soft btn-sm" id="btnEditBudget">⚙ Manage Budget</button>' : ''}
                    </div>
                </div>

                ${alertBannerHtml}

                <div class="budget-metrics-grid">
                    <div class="budget-metric-card">
                        <span class="metric-label">Total Budget</span>
                        <strong class="metric-value">${stats.hasBudget ? SS.money(stats.totalBudget) : 'Not set'}</strong>
                        <small class="metric-helper">${stats.hasBudget ? 'Estimated total cap' : 'Set a budget to track limits'}</small>
                    </div>
                    <div class="budget-metric-card">
                        <span class="metric-label">Total Spent</span>
                        <strong class="metric-value">${SS.money(stats.totalSpent)}</strong>
                        <small class="metric-helper">From ${group.expenses?.length || 0} expense${group.expenses?.length === 1 ? '' : 's'}</small>
                    </div>
                    <div class="budget-metric-card">
                        <span class="metric-label">Remaining</span>
                        <strong class="metric-value">${remainingDisplay}</strong>
                        <small class="metric-helper">${remainingHelper}</small>
                    </div>
                    <div class="budget-metric-card">
                        <span class="metric-label">Budget Used</span>
                        <strong class="metric-value ${stats.isOverBudget ? 'text-danger' : stats.isWarning ? 'text-warning' : ''}">${percentDisplay}</strong>
                        <small class="metric-helper">${stats.hasBudget ? (stats.isOverBudget ? 'Exceeded 100%' : `${(100 - stats.percentUsed).toFixed(1)}% remaining`) : 'No limit set'}</small>
                    </div>
                </div>

                <div class="budget-overall-progress">
                    <div class="progress-info-row">
                        <span>Overall Progress</span>
                        <strong>${stats.hasBudget ? `${stats.percentUsed.toFixed(1)}% (${SS.money(stats.totalSpent)} of ${SS.money(stats.totalBudget)})` : 'No budget set'}</strong>
                    </div>
                    <div class="budget-progress-track main-track">
                        <div class="budget-progress-fill ${progressClass}" style="width: ${displayPercent}%"></div>
                        ${stats.hasBudget ? '<div class="budget-threshold-mark" style="left: 80%" title="80% Warning Threshold"><span>80%</span></div>' : ''}
                    </div>
                </div>

                <div class="category-budgets-section">
                    <div class="cat-section-header">
                        <h3>Category Budgets vs. Spending</h3>
                        <small>Key tracked categories</small>
                    </div>
                    <div class="category-cards-grid">
                        ${categoryCardsHtml}
                    </div>
                    ${otherCategoriesHtml}
                </div>
            </section>
        `;

        if (isAdmin) {
            document.getElementById('btnEditBudget')?.addEventListener('click', () => {
                this.openEditModal(group, onUpdate);
            });
        }
    },

    /**
     * Opens the Manage/Edit Budget modal on the group details page.
     */
    openEditModal(group, onUpdate) {
        let modal = document.getElementById('budgetModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'budgetModal';
            modal.className = 'modal-backdrop';
            modal.innerHTML = `
                <div class="modal budget-modal">
                    <div class="modal-head">
                        <div>
                            <span class="kicker">Spending Targets</span>
                            <h2>Manage Group Budget</h2>
                            <p class="modal-subtitle">Set or modify the total budget and category-wise spending limits.</p>
                        </div>
                        <button class="icon-btn" data-close-budget-modal>×</button>
                    </div>
                    <form class="form-grid" id="editBudgetForm">
                        <div class="field">
                            <label for="editBudgetTotal">Estimated Total Budget (₹)</label>
                            <input type="number" id="editBudgetTotal" name="budgetTotal" min="0" step="0.01" placeholder="e.g. 50000">
                            <small class="field-help">Leave empty or 0 if you don't want an overall cap.</small>
                        </div>
                        <div class="form-section-label" style="margin-top: 10px;">Category Budgets (₹)</div>
                        <div class="form-row">
                            <div class="field">
                                <label for="editBudgetTravel">✈️ Travel</label>
                                <input type="number" id="editBudgetTravel" name="budgetCategory_Travel" min="0" step="0.01" placeholder="0.00">
                            </div>
                            <div class="field">
                                <label for="editBudgetHotel">🏨 Hotel / Stay</label>
                                <input type="number" id="editBudgetHotel" name="budgetCategory_Hotel" min="0" step="0.01" placeholder="0.00">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="field">
                                <label for="editBudgetFood">🍽️ Food</label>
                                <input type="number" id="editBudgetFood" name="budgetCategory_Food" min="0" step="0.01" placeholder="0.00">
                            </div>
                            <div class="field">
                                <label for="editBudgetActivities">🎯 Activities</label>
                                <input type="number" id="editBudgetActivities" name="budgetCategory_Activities" min="0" step="0.01" placeholder="0.00">
                            </div>
                        </div>
                        <div class="form-error" id="editBudgetError"></div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-soft" data-close-budget-modal>Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Budget</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelectorAll('[data-close-budget-modal]').forEach(btn => {
                btn.addEventListener('click', () => modal.classList.remove('open'));
            });
        }

        // Prepopulate current values
        const current = this.get(group);
        const totalInput = document.getElementById('editBudgetTotal');
        const travelInput = document.getElementById('editBudgetTravel');
        const hotelInput = document.getElementById('editBudgetHotel');
        const foodInput = document.getElementById('editBudgetFood');
        const activitiesInput = document.getElementById('editBudgetActivities');

        if (totalInput) totalInput.value = current.total > 0 ? current.total : '';
        if (travelInput) travelInput.value = current.categories['Travel'] > 0 ? current.categories['Travel'] : '';
        if (hotelInput) hotelInput.value = current.categories['Hotel / Stay'] > 0 ? current.categories['Hotel / Stay'] : '';
        if (foodInput) foodInput.value = current.categories['Food'] > 0 ? current.categories['Food'] : '';
        if (activitiesInput) activitiesInput.value = current.categories['Activities'] > 0 ? current.categories['Activities'] : '';

        const form = document.getElementById('editBudgetForm');
        form.onsubmit = e => {
            e.preventDefault();
            const errBox = document.getElementById('editBudgetError');
            if (errBox) errBox.textContent = '';

            try {
                const formData = Object.fromEntries(new FormData(form));
                const newBudget = this.parseBudgetFormData(formData);
                this.updateGroupBudget(group.id, newBudget);
                modal.classList.remove('open');
                SS.notifications.success('Budget saved successfully');
                if (typeof onUpdate === 'function') onUpdate();
            } catch (err) {
                if (errBox) errBox.textContent = err.message || 'Unable to save budget. Please check the values.';
            }
        };

        modal.classList.add('open');
    },

    /**
     * Persists new budget data inside the group object in localStorage.
     */
    updateGroupBudget(groupId, budgetData) {
        const group = SS.group(groupId);
        if (!group) throw new Error('Group not found.');
        const user = SS.currentUser();
        if (!user || group.creator !== user.id) {
            throw new Error('Only the group admin can modify the budget.');
        }

        group.budget = {
            total: Number(budgetData.total) || 0,
            categories: {
                'Travel': Number(budgetData.categories?.['Travel']) || 0,
                'Hotel / Stay': Number(budgetData.categories?.['Hotel / Stay']) || 0,
                'Food': Number(budgetData.categories?.['Food']) || 0,
                'Activities': Number(budgetData.categories?.['Activities']) || 0
            }
        };

        // Reset notified state so new threshold will trigger appropriate notification
        delete this._notifiedState[groupId];

        SS.groups.update(group);
        return group;
    }
};
