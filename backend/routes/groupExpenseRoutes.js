
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    createGroupExpense,
    getGroupExpenses,
    updateGroupExpense,
    deleteGroupExpense
} = require("../controllers/groupExpenseController");

router.use(authMiddleware);

router.post("/:groupId", createGroupExpense);
router.get("/:groupId", getGroupExpenses);
router.put("/:groupId/:expenseId", updateGroupExpense);
router.delete("/:groupId/:expenseId", deleteGroupExpense);

module.exports = router;
