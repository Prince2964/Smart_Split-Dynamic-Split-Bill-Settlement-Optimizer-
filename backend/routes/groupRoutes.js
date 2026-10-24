
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    createGroup,
    getGroups,
    getGroupById,
    inviteByEmail,
    createInviteLink,
    joinGroup
} = require("../controllers/groupController");

router.use(authMiddleware);

router.post("/", createGroup);
router.get("/", getGroups);

// Joining is allowed for any authenticated user with a valid invite.
router.post("/join", joinGroup);

router.get("/:groupId", getGroupById);
router.post("/:groupId/invitations/email", inviteByEmail);
router.post("/:groupId/invitations/link", createInviteLink);

module.exports = router;
