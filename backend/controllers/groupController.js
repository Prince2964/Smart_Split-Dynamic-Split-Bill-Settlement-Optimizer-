
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Resend } = require("resend");

const Group = require("../models/Group");
const GroupExpense = require("../models/GroupExpense");
const User = require("../models/User");

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const INVITATION_DAYS = 7;
const INVITATION_MS = INVITATION_DAYS * 24 * 60 * 60 * 1000;

const createRawToken = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");

const getInvitationUrl = (token) => {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
        throw new Error("FRONTEND_URL is missing from backend .env");
    }

    return new URL(
        `invitation.html?token=${encodeURIComponent(token)}`,
        frontendUrl.endsWith("/") ? frontendUrl : `${frontendUrl}/`
    ).toString();
};

// Create a group
const createGroup = async (req, res) => {
    try {
        const {
            name,
            description = "",
            purpose = "custom",
            thumbnail = "",
            budget = {},
            meta = {}
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required"
            });
        }

        if (!["trip", "household", "custom"].includes(purpose)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group type"
            });
        }

        const group = await Group.create({
            name: name.trim(),
            purpose,
            description: String(description || "").trim(),
            thumbnail,
            budget: {
                total: Number(budget.total) || 0,
                categories: {
                    Travel: Number(budget.categories?.Travel) || 0,
                    "Hotel / Stay":
                        Number(budget.categories?.["Hotel / Stay"]) || 0,
                    Food: Number(budget.categories?.Food) || 0,
                    Activities: Number(budget.categories?.Activities) || 0
                }
            },
            meta: {
                destination: String(meta.destination || "").trim(),
                startDate: meta.startDate || "",
                endDate: meta.endDate || "",
                address: String(meta.address || "").trim(),
                description: String(meta.description || "").trim(),
                customPurpose: String(meta.customPurpose || "").trim()
            },
            createdBy: req.user.id,
            members: [req.user.id]
        });

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            group
        });
    } catch (error) {
        console.error("Create group error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not create group"
        });
    }
};

// Get groups for the logged-in user
const getGroups = async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user.id })
            .populate("createdBy", "name email")
            .populate("members", "name email")
            .select("-invitations.tokenHash")
            .sort({ createdAt: -1 });

        return res.json({ success: true, groups });
    } catch (error) {
        console.error("Get groups error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not fetch groups"
        });
    }
};

// Get a group the logged-in user belongs to
const getGroupById = async (req, res) => {
    try {
        const { groupId } = req.params;

        if (!mongoose.isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        const group = await Group.findOne({
            _id: groupId,
            members: req.user.id
        })
            .populate("createdBy", "name email")
            .populate("members", "name email")
            .select("-invitations.tokenHash");

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        return res.json({ success: true, group });
    } catch (error) {
        console.error("Get group by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not fetch group"
        });
    }
};

// Create an email invitation or a reusable invitation link
const createInvitation = async (req, res, type) => {
    let group;
    let invitation;

    try {
        const { groupId } = req.params;

        if (!mongoose.isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        // Only the group creator can issue invitations.
        if (group.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the group admin can invite members"
            });
        }

        let email = null;

        if (type === "email") {
            email = String(req.body.email || "").trim().toLowerCase();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid email is required"
                });
            }

            const existingUser = await User.findOne({ email });

            if (
                existingUser &&
                group.members.some(
                    member =>
                        member.toString() === existingUser._id.toString()
                )
            ) {
                return res.status(409).json({
                    success: false,
                    message: "This user is already a group member"
                });
            }

            // Replace an older pending email invitation to this address.
            group.invitations = group.invitations.filter(invite =>
                !(
                    invite.type === "email" &&
                    invite.email === email &&
                    invite.status === "pending"
                )
            );
        }

        if (type === "email" && !resend) {
            return res.status(503).json({
                success: false,
                message: "Email service is not configured. Set RESEND_API_KEY."
            });
        }

        if (type === "email" && !process.env.RESEND_FROM_EMAIL) {
            return res.status(503).json({
                success: false,
                message: "RESEND_FROM_EMAIL is missing from backend .env"
            });
        }

        const rawToken = createRawToken();
        const expiresAt = new Date(Date.now() + INVITATION_MS);

        group.invitations.push({
            email,
            tokenHash: hashToken(rawToken),
            type,
            invitedBy: req.user.id,
            expiresAt,
            status: "pending"
        });

        invitation = group.invitations[group.invitations.length - 1];

        // Save before sending, so the invitation exists when the recipient opens it.
        await group.save();

        const inviteUrl = getInvitationUrl(rawToken);

        if (type === "email") {
            const inviter = await User.findById(req.user.id).select("name email");

            const { error } = await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL,
                to: [email],
                subject: `You're invited to ${group.name} on SplitSmart`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
                        <h2>You're invited to SplitSmart!</h2>
                        <p>${inviter?.name || "A group admin"} invited you to join
                           <strong>${group.name}</strong>.</p>
                        <p>Use the button below to open your invitation.
                           Sign in or create an account with
                           <strong>${email}</strong> to accept it.</p>
                        <p>
                            <a href="${inviteUrl}"
                               style="display:inline-block;padding:12px 20px;
                               background:#2563eb;color:white;text-decoration:none;
                               border-radius:6px">
                                View invitation
                            </a>
                        </p>
                        <p>This invitation expires in 7 days and can only be
                           accepted by the invited email account.</p>
                        <p>If you weren't expecting this invitation, you can
                           ignore this email.</p>
                    </div>
                `
            });

            if (error) {
                throw new Error(error.message || "Resend could not send the email");
            }
        }

        return res.status(201).json({
            success: true,
            message: type === "email"
                ? "Invitation email sent successfully"
                : "Reusable invitation link created",
            groupId: group._id,
            invitation: {
                type,
                email,
                inviteUrl,
                expiresAt
            }
        });
    } catch (error) {
        console.error("Create invitation error:", error);

        // Remove the unsent invitation if email delivery fails.
        if (group && invitation && type === "email") {
            try {
                group.invitations.pull(invitation._id);
                await group.save();
            } catch (cleanupError) {
                console.error("Invitation cleanup error:", cleanupError);
            }
        }

        return res.status(500).json({
            success: false,
            message: type === "email"
                ? "Could not send invitation email. Check Resend configuration."
                : "Could not create invitation"
        });
    }
};

const inviteByEmail = (req, res) =>
    createInvitation(req, res, "email");

const createInviteLink = (req, res) =>
    createInvitation(req, res, "link");

// Preview an invitation using its raw token
const previewInvitation = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token || typeof token !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invitation token is required"
            });
        }

        const tokenHash = hashToken(token);
        const now = new Date();

        const group = await Group.findOne({
            invitations: {
                $elemMatch: {
                    tokenHash,
                    status: "pending",
                    expiresAt: { $gt: now }
                }
            }
        }).populate("createdBy", "name");

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Invitation is invalid, expired, or already used"
            });
        }

        const invitation = group.invitations.find(invite =>
            invite.tokenHash === tokenHash &&
            invite.status === "pending" &&
            invite.expiresAt > now
        );

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found"
            });
        }

        return res.json({
            success: true,
            invitation: {
                email: invitation.email,
                type: invitation.type,
                expiresAt: invitation.expiresAt
            },
            group: {
                id: group._id,
                name: group.name,
                purpose: group.purpose,
                description: group.description,
                creatorName: group.createdBy?.name || "Group admin",
                memberCount: group.members.length
            }
        });
    } catch (error) {
        console.error("Preview invitation error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load invitation"
        });
    }
};
// Join a group using an invitation token
const joinGroup = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invitation token is required"
            });
        }

        const tokenHash = hashToken(token);
        const now = new Date();

        const group = await Group.findOne({
            invitations: {
                $elemMatch: {
                    tokenHash,
                    status: "pending",
                    expiresAt: { $gt: now }
                }
            }
        });

        if (!group) {
            return res.status(400).json({
                success: false,
                message: "Invitation is invalid, expired, or already used"
            });
        }

        const invitation = group.invitations.find(invite =>
            invite.tokenHash === tokenHash &&
            invite.status === "pending" &&
            invite.expiresAt > now
        );

        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: "Invitation is invalid or expired"
            });
        }

        const user = await User.findById(req.user.id).select("email");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }

        if (
            invitation.email &&
            invitation.email !== String(user.email || "").toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Sign in with the email address invited to this group"
            });
        }

        if (
            group.members.some(
                member => member.toString() === req.user.id
            )
        ) {
            return res.status(409).json({
                success: false,
                message: "You are already a group member"
            });
        }

        group.members.push(req.user.id);

        // Email invitations are one-use.
        // Link invitations remain pending until expiry, so others can join too.
        if (invitation.type === "email") {
            invitation.status = "accepted";
        }

        await group.save();

        return res.json({
            success: true,
            message: "You joined the group successfully",
            groupId: group._id
        });
    } catch (error) {
        console.error("Join group error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not join group"
        });
    }
};

// Mark a current settlement as paid and persist the status in MongoDB.
const markSettlementPaid = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { statusKey, fromId, toId, amount } = req.body || {};

        if (!mongoose.isValidObjectId(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid group ID" });
        }
        if (typeof statusKey !== "string" || !statusKey || statusKey.length > 2000 ||
            typeof fromId !== "string" || typeof toId !== "string" ||
            !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid settlement details" });
        }

        const group = await Group.findOne({ _id: groupId, members: req.user.id });
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found or you are not a member" });
        }

        // Must match SS.calculations.settlementStorageKey() in the frontend.
        // MongoDB Map keys cannot contain dots or dollar signs.
        const safeKey = statusKey.replace(/\./g, "%2E").replace(/\$/g, "%24");

        const existing = group.settlementStatuses?.get
            ? group.settlementStatuses.get(safeKey)
            : group.settlementStatuses?.[safeKey];

        if (existing?.status === "paid") {
            return res.json({
                success: true,
                status: existing,
                settlementStatuses: group.settlementStatuses?.toJSON
                    ? group.settlementStatuses.toJSON()
                    : group.settlementStatuses || {}
            });
        }

        const paidAt = new Date();

        const status = {
            status: "paid",
            paidAt,
            markedBy: req.user.id,
            fromId,
            toId,
            amount: Number(amount)
        };

        if (group.settlementStatuses?.set) {
            group.settlementStatuses.set(safeKey, status);
        } else {
            group.settlementStatuses = {
                ...(group.settlementStatuses || {}),
                [safeKey]: status
            };
        }

        group.markModified("settlementStatuses");
        await group.save();

        const settlementStatuses = group.settlementStatuses?.toJSON
            ? group.settlementStatuses.toJSON()
            : group.settlementStatuses;
        return res.json({ success: true, status, settlementStatuses });
    } catch (error) {
        console.error("Mark settlement paid error:", error);
        return res.status(500).json({ success: false, message: "Could not save settlement status" });
    }
};

// Delete a group and its expenses. Only the group creator/admin may do this.
const deleteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid group ID" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const currentUserId = String(req.user.id || req.user._id || "");
        if (String(group.createdBy) !== currentUserId) {
            return res.status(403).json({ success: false, message: "Only the group admin can delete this group" });
        }

        // Remove child expenses first so no orphaned records remain.
        await GroupExpense.deleteMany({ group: group._id });
        await Group.deleteOne({ _id: group._id });

        return res.json({ success: true, message: "Group deleted successfully", groupId });
    } catch (error) {
        console.error("Delete group error:", error);
        return res.status(500).json({ success: false, message: "Could not delete group" });
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    previewInvitation,
    inviteByEmail,
    createInviteLink,
    joinGroup,
    markSettlementPaid,
    deleteGroup
};