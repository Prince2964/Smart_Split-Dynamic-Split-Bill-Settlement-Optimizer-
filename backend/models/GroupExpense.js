
const mongoose = require("mongoose");

const splitSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const groupExpenseSchema = new mongoose.Schema(
    {
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        splitType: {
            type: String,
            enum: ["equal", "custom"],
            required: true
        },
        splits: {
            type: [splitSchema],
            validate: {
                validator: function (splits) {
                    return splits.length > 0;
                },
                message: "At least one expense share is required"
            }
        },
        note: { type: String, trim: true, default: "" },
        isRecurring: { type: Boolean, default: false },
        frequency: { type: String, enum: ["", "weekly", "monthly", "yearly"], default: "" },
        startDate: { type: String, default: "" },
        nextDueDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

groupExpenseSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model("GroupExpense", groupExpenseSchema);
