const mongoose = require("mongoose");
const Group = require("../models/Group");
const GroupExpense = require("../models/GroupExpense");

const toPaise = amount => Math.round(Number(amount) * 100);

function buildSplits({ amount, splitType, splits, memberIds }) {
    if (!["equal", "custom"].includes(splitType)) {
        const error = new Error("splitType must be equal or custom");
        error.status = 400;
        throw error;
    }
    if (!Array.isArray(splits) || splits.length === 0) {
        const error = new Error("Select at least one participant");
        error.status = 400;
        throw error;
    }
    const seen = new Set();
    for (const split of splits) {
        const id = split?.user?.toString();
        if (!id || !memberIds.includes(id)) {
            const error = new Error("Every participant must be a group member");
            error.status = 400;
            throw error;
        }
        if (seen.has(id)) {
            const error = new Error("Duplicate users in expense splits");
            error.status = 400;
            throw error;
        }
        seen.add(id);
        if (splitType === "custom" &&
            (typeof split.amount !== "number" || !Number.isFinite(split.amount) || split.amount < 0)) {
            const error = new Error("Each share must be a non-negative number");
            error.status = 400;
            throw error;
        }
    }

    if (splitType === "equal") {
        const totalPaise = toPaise(amount);
        const base = Math.floor(totalPaise / splits.length);
        const remainder = totalPaise % splits.length;
        return splits.map((split, index) => ({
            user: split.user,
            amount: (base + (index < remainder ? 1 : 0)) / 100
        }));
    }

    const sharesTotal = splits.reduce((sum, split) => sum + toPaise(split.amount), 0);
    if (sharesTotal !== toPaise(amount)) {
        const error = new Error("Custom shares must add up to the total expense");
        error.status = 400;
        throw error;
    }
    return splits.map(split => ({ user: split.user, amount: toPaise(split.amount) / 100 }));
}

function validateBody(body, memberIds) {
    const { title, amount, category, paidBy, splitType, splits } = body;
    if (typeof title !== "string" || !title.trim() ||
        typeof category !== "string" || !category.trim()) {
        const error = new Error("Title and category are required");
        error.status = 400;
        throw error;
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || toPaise(amount) <= 0) {
        const error = new Error("Amount must be a positive number");
        error.status = 400;
        throw error;
    }
    if (!paidBy || !memberIds.includes(paidBy.toString())) {
        const error = new Error("Payer must be a member of this group");
        error.status = 400;
        throw error;
    }
    return {
        title: title.trim(),
        amount: toPaise(amount) / 100,
        category: category.trim(),
        paidBy,
        splitType,
        splits: buildSplits({ amount, splitType, splits, memberIds }),
        note: String(body.note || "").trim(),
        isRecurring: Boolean(body.isRecurring),
        frequency: body.isRecurring && ["weekly", "monthly", "yearly"].includes(body.frequency) ? body.frequency : "",
        startDate: body.isRecurring ? String(body.startDate || "") : "",
        nextDueDate: body.isRecurring ? String(body.nextDueDate || "") : "",
        endDate: body.isRecurring ? String(body.endDate || "") : ""
    };
}

async function populateExpense(expense) {
    await expense.populate([
        { path: "paidBy", select: "name email" },
        { path: "createdBy", select: "name email" },
        { path: "splits.user", select: "name email" }
    ]);
    return expense;
}

const createGroupExpense = async (req, res) => {
    try {
        const { groupId } = req.params;
        if (!mongoose.isValidObjectId(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid group ID" });
        }
        const group = await Group.findOne({ _id: groupId, members: req.user.id });
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        const memberIds = group.members.map(id => id.toString());
        const data = validateBody(req.body, memberIds);
        const expense = await GroupExpense.create({
            group: group._id,
            ...data,
            createdBy: req.user.id
        });
        await populateExpense(expense);
        return res.status(201).json({
            success: true,
            message: "Group expense created successfully",
            expense
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Could not create group expense"
        });
    }
};

const getGroupExpenses = async (req, res) => {
    try {
        const { groupId } = req.params;
        if (!mongoose.isValidObjectId(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid group ID" });
        }
        const group = await Group.findOne({ _id: groupId, members: req.user.id }).select("_id");
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        const expenses = await GroupExpense.find({ group: group._id })
            .populate("paidBy", "name email")
            .populate("createdBy", "name email")
            .populate("splits.user", "name email")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: expenses.length, expenses });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not fetch group expenses" });
    }
};

const updateGroupExpense = async (req, res) => {
    try {
        const { groupId, expenseId } = req.params;
        if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(expenseId)) {
            return res.status(400).json({ success: false, message: "Invalid group or expense ID" });
        }
        const group = await Group.findOne({ _id: groupId, members: req.user.id });
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        const expense = await GroupExpense.findOne({ _id: expenseId, group: group._id });
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });

        const isGroupCreator = group.createdBy.toString() === req.user.id;
        const isExpenseCreator = expense.createdBy.toString() === req.user.id;
        if (!isGroupCreator && !isExpenseCreator) {
            return res.status(403).json({
                success: false,
                message: "Only the group creator or expense creator can edit it"
            });
        }

        const data = validateBody(req.body, group.members.map(id => id.toString()));
        Object.assign(expense, data);
        await expense.save();
        await populateExpense(expense);
        return res.json({ success: true, message: "Group expense updated successfully", expense });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Could not update group expense"
        });
    }
};

const deleteGroupExpense = async (req, res) => {
    try {
        const { groupId, expenseId } = req.params;
        if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(expenseId)) {
            return res.status(400).json({ success: false, message: "Invalid group or expense ID" });
        }
        const group = await Group.findOne({ _id: groupId, members: req.user.id });
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        const expense = await GroupExpense.findOne({ _id: expenseId, group: group._id });
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });

        const isGroupCreator = group.createdBy.toString() === req.user.id;
        const isExpenseCreator = expense.createdBy.toString() === req.user.id;
        if (!isGroupCreator && !isExpenseCreator) {
            return res.status(403).json({
                success: false,
                message: "Only the group creator or expense creator can delete it"
            });
        }

        await expense.deleteOne();
        return res.json({ success: true, message: "Group expense deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not delete group expense" });
    }
};

module.exports = {
    createGroupExpense,
    getGroupExpenses,
    updateGroupExpense,
    deleteGroupExpense
};
