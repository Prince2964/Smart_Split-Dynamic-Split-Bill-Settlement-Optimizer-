# SplitSmart Phase 1.7 — Budget System

A client-side **Budget System** extension for SplitSmart Phase 1.7 built using only HTML5, Vanilla CSS, and JavaScript (ES6+). This module introduces overall spending targets and category-wise spending caps without altering backend requirements, databases, or breaking existing authentication, recurring expenses, and settlement algorithms.

---

## 1. Modified & New Files

| File | Status | Description |
|---|---|---|
| `js/budget.js` | **New** | Dedicated module (`SS.budget`) containing budget calculations, data sanitization, category aggregation, threshold alert state management, and summary UI rendering. |
| `css/budget.css` | **New** | Premium, responsive styles for the budget form controls, metrics grid, dynamic multi-tier progress bars, category budget cards, inline alert banners, and budget modal. |
| `create-group.html` | **Modified** | Integrated `css/budget.css`, added optional budget input fields (Estimated Total Budget and category budgets for Travel, Hotel / Stay, Food, and Activities), and loaded `js/budget.js`. |
| `js/create-group.js` | **Modified** | Form submit handler parses budget inputs via `SS.budget.parseBudgetFormData(d)` and attaches the structured budget object before group persistence. |
| `group.html` | **Modified** | Linked `css/budget.css`, added the `Activities` category option to the expense modal category selector, and loaded `js/budget.js`. |
| `js/group-page.js` | **Modified** | Integrated `#groupBudgetRoot` container into the group page layout, mounted `SS.budget.renderSummary(group, host, onUpdate)`, and hooked `SS.budget.checkAlerts(group)`. |
| `js/groups.js` | **Modified** | Initialized the `budget` property in `SS.groups.create()` with backward-compatible defaults. |
| `js/utils.js` | **Modified** | Added `Activities` (`🎯`) to `SS.expenseCategories` so activities expenses can be logged and tracked natively. |

*Note: The original source folder (`SplitSmart-Phase1.7`) remains untouched. All work is housed in `SplitSmart-Phase1.7-budget-system`.*

---

## 2. Budget Object Structure in `localStorage`

The budget data is persisted directly inside each group object under the `ss_groups` key in browser `localStorage`.

### Data Schema
```json
{
  "id": "GRP-12345678",
  "name": "Goa Trip 2026",
  "purpose": "trip",
  "creator": "USR-87654321",
  "creatorName": "Priya Sharma",
  "createdAt": "2026-10-23T11:00:00.000Z",
  "thumbnail": "",
  "members": [
    {
      "userId": "USR-87654321",
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "status": "accepted",
      "joinedAt": "2026-10-23T11:00:00.000Z"
    }
  ],
  "expenses": [],
  "settlementStatuses": {},
  "budget": {
    "total": 50000,
    "categories": {
      "Travel": 15000,
      "Hotel / Stay": 15000,
      "Food": 12000,
      "Activities": 8000
    }
  },
  "meta": {
    "destination": "Goa",
    "startDate": "2026-11-01",
    "endDate": "2026-11-07",
    "address": "",
    "description": "Annual beach vacation with friends",
    "customPurpose": ""
  }
}
```

### Backward Compatibility & Defaults
- **Legacy Groups**: Existing groups without a `budget` key evaluate safely via `SS.budget.get(group)` to:
  ```json
  {
    "total": 0,
    "categories": { "Travel": 0, "Hotel / Stay": 0, "Food": 0, "Activities": 0 },
    "isSet": false
  }
  ```
- **Missing or Zero Values**: Handled as `0` or *"Not set"*. No NaN values or runtime exceptions occur if a user omits the total budget or category values.
- **Admin Management**: Group admins can click **"Manage Budget"** on the group page at any time to define or update budget figures for existing or new groups.

---

## 3. How Calculations & Alerts Work

### Calculations
All metrics are derived in real time from the group's expenses array:
1. **Total Spent**: Sum of all valid positive expense amounts (`∑ expense.amount`).
2. **Remaining Budget**: `totalBudget > 0 ? (totalBudget - totalSpent) : 0`. (If overspent, remaining is negative or displayed with an over-budget indicator).
3. **Percentage Used**: `totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0`.
4. **Category Breakdown**:
   - For each of the core 4 categories (`Travel`, `Hotel / Stay`, `Food`, `Activities`):
     - `spent`: Sum of `expense.amount` where `expense.category === catName`.
     - `budget`: Category allocation entered during group creation or editing.
     - `remaining`: `categoryBudget - categorySpent`.
     - `percentUsed`: `(categorySpent / categoryBudget) * 100`.
   - Any spending in non-core categories (e.g., Shopping, Groceries, Utilities) is grouped in a secondary breakdown so 100% of tracked expenses reconcile with the total.

### Alerts & Anti-Duplication
Threshold alerts trigger at two key stages:
1. **Warning Alert (80% to 100%)**:
   - Condition: `percentUsed >= 80 && percentUsed <= 100`.
   - In-page: Yellow/amber alert banner indicating percentage used and remaining budget.
   - Toast: `SS.notifications.warning(...)` warning user of the 80% threshold.
2. **Overspending Alert (> 100%)**:
   - Condition: `totalSpent > totalBudget`.
   - In-page: Red danger banner displaying the exact extra amount: `overAmount = totalSpent - totalBudget`.
   - Progress Bar: Turns crimson/red.
   - Toast: `SS.notifications.error(...)` notifying user of overspending.
3. **Anti-Duplication State**:
   - `SS.budget._notifiedState[groupId]` tracks the active alert tier (`'none' | 'warning' | 'danger'`).
   - Alerts only fire when a state transition occurs (e.g., crossing from normal into warning, or warning into over-budget) or upon first page view.
   - Filtering, searching, sorting, or re-rendering expenses does **not** spam toasts.

---

## 4. Validation and Alert Improvements

The budget module validates values before saving:
- Blank fields are treated as optional values (`0`).
- Negative, non-numeric, non-finite, or amounts with more than two decimal places are rejected with a clear message.
- When an overall budget is set, the sum of category limits cannot exceed it; the user is asked to adjust the total or category limits.
- Category warning (80%+) and overspending (>100%) toasts are tracked independently, including when a group uses category budgets without an overall budget.
- Re-rendering does not repeatedly fire the same category alert while the threshold state remains unchanged.

## 5. Phase 2 Backend Migration Guide (Node.js, Express, MongoDB)

When migrating SplitSmart to Phase 2 with a Node.js/Express and MongoDB/Mongoose backend, follow these steps to integrate the Budget System:

### 1. Mongoose Schema Update
Extend the `Group` schema in `models/Group.js`:
```javascript
const categoryBudgetSchema = new mongoose.Schema({
  Travel: { type: Number, default: 0, min: 0 },
  'Hotel / Stay': { type: Number, default: 0, min: 0 },
  Food: { type: Number, default: 0, min: 0 },
  Activities: { type: Number, default: 0, min: 0 }
}, { _id: false });

const budgetSchema = new mongoose.Schema({
  total: { type: Number, default: 0, min: 0 },
  categories: { type: categoryBudgetSchema, default: () => ({}) }
}, { _id: false });

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  purpose: { type: String, enum: ['trip', 'household', 'custom'], required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  budget: { type: budgetSchema, default: () => ({}) },
  meta: { type: Object, default: {} }
}, { timestamps: true });
```

### 2. Express Controller Endpoints
Add dedicated routes in `routes/groupRoutes.js`:
- `POST /api/groups`: Accept `budget: { total, categories }` in the request body.
- `PUT /api/groups/:id/budget`: Dedicated endpoint allowing group creator/admin to modify budget values:
  ```javascript
  exports.updateBudget = async (req, res) => {
    const { id } = req.params;
    const { total, categories } = req.body;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only group admin can modify budget' });
    }
    group.budget = {
      total: Number(total) || 0,
      categories: {
        Travel: Number(categories?.Travel) || 0,
        'Hotel / Stay': Number(categories?.['Hotel / Stay']) || 0,
        Food: Number(categories?.Food) || 0,
        Activities: Number(categories?.Activities) || 0
      }
    };
    await group.save();
    res.json({ message: 'Budget updated', budget: group.budget });
  };
  ```

### 3. Aggregation Pipeline for Budget Analytics
In MongoDB, use an aggregation pipeline to compute category totals server-side if needed for large expense datasets:
```javascript
const stats = await Expense.aggregate([
  { $match: { group: new mongoose.Types.ObjectId(groupId) } },
  { $group: { _id: '$category', totalSpent: { $sum: '$amount' } } }
]);
```

### 4. Database Migration Script
For MongoDB instances with existing groups from Phase 1, run a one-time migration:
```javascript
await Group.updateMany(
  { budget: { $exists: false } },
  { $set: { budget: { total: 0, categories: { Travel: 0, 'Hotel / Stay': 0, Food: 0, Activities: 0 } } } }
);
```
