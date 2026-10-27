const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    createGroup,
    getGroups,
    getGroupById,
    previewInvitation,
    inviteByEmail,
    createInviteLink,
    joinGroup,
    markSettlementPaid,
    deleteGroup
} = require("../controllers/groupController");

// Public route: recipient can view invitation before login
router.get("/invitation/:token", previewInvitation);

// All routes below require authentication
router.use(authMiddleware);
router.post("/:groupId/settlements/paid", markSettlementPaid);

router.post("/", createGroup);
router.get("/", getGroups);
router.post("/join", joinGroup);
router.get("/:groupId", getGroupById);
router.delete("/:groupId", deleteGroup);
router.post("/:groupId/invitations/email", inviteByEmail);
router.post("/:groupId/invitations/link", createInviteLink);

module.exports = router;
