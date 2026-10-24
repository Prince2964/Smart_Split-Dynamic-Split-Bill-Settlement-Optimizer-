const mongoose = require("mongoose");
const Expense = require("../models/Expense");

// CREATE EXPENSE
// POST /api/expenses
const createExpense = async (req, res) => {
    try {
        const { title, amount, category } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof category !== "string" ||
            !category.trim() ||
            amount === undefined ||
            amount === null ||
            amount === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Title, amount and category are required"
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
            });
        }

        const expense = await Expense.create({
            title: title.trim(),
            amount: numericAmount,
            category: category.trim(),
            user: req.user.id
        });

        return res.status(201).json({
            success: true,
            message: "Expense created successfully",
            expense
        });
    } catch (error) {
        console.error("Create expense error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to create expense"
        });
    }
};

// GET ALL EXPENSES OF LOGGED-IN USER
// GET /api/expenses
const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({
            user: req.user.id
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: expenses.length,
            expenses
        });
    } catch (error) {
        console.error("Get expenses error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch expenses"
        });
    }
};

// GET ONE EXPENSE
// GET /api/expenses/:id
const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const expense = await Expense.findOne({
            _id: id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            expense
        });
    } catch (error) {
        console.error("Get expense error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch expense"
        });
    }
};

// UPDATE EXPENSE
// PUT /api/expenses/:id
const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, amount, category } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof category !== "string" ||
            !category.trim() ||
            amount === undefined ||
            amount === null ||
            amount === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Title, amount and category are required"
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
            });
        }

        const expense = await Expense.findOneAndUpdate(
            {
                _id: id,
                user: req.user.id
            },
            {
                title: title.trim(),
                amount: numericAmount,
                category: category.trim()
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            expense
        });
    } catch (error) {
        console.error("Update expense error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update expense"
        });
    }
};

// DELETE EXPENSE
// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const expense = await Expense.findOneAndDelete({
            _id: id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully",
            expense
        });
    } catch (error) {
        console.error("Delete expense error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to delete expense"
        });
    }
};

module.exports = {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense
};
