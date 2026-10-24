
const crypto = require("crypto");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const User = require("../models/User");


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
                    "Hotel / Stay": Number(budget.categories?.["Hotel / Stay"]) || 0,
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


const getGroups = async (req, res) => {
    try {
        const groups = await Group.find({
            members: req.user.id
        })
            .populate("createdBy", "name email")
            .populate("members", "name email")
            .select("-invitations.tokenHash")
            .sort({ createdAt: -1 });

        return res.json({ success: true, groups });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not fetch groups"
        });
    }
};

const getGroupById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        const group = await Group.findOne({
            _id: req.params.groupId,
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
        return res.status(500).json({
            success: false,
            message: "Could not fetch group"
        });
    }
};

const createInvitation = async (req, res, type) => {
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
        });

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        let email = null;

        if (type === "email") {
            if (!req.body.email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid email is required"
                });
            }

            email = req.body.email.trim().toLowerCase();

            const existingUser = await User.findOne({ email });

            if (existingUser &&
                group.members.some(
                    member => member.toString() === existingUser._id.toString()
                )) {
                return res.status(409).json({
                    success: false,
                    message: "This user is already a group member"
                });
            }

            group.invitations = group.invitations.filter(invite =>
                !(invite.type === "email" &&
                  invite.email === email &&
                  invite.status === "pending")
            );
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        group.invitations.push({
            email,
            tokenHash,
            type,
            invitedBy: req.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        await group.save();

        return res.status(201).json({
            success: true,
            message: type === "email"
                ? "Email invitation created. Share the token with the invitee."
                : "Invite link token created. Share it securely with invitees.",
            groupId: group._id,
            invitation: {
                type,
                email,
                token: rawToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not create invitation"
        });
    }
};

const inviteByEmail = (req, res) =>
    createInvitation(req, res, "email");

const createInviteLink = (req, res) =>
    createInvitation(req, res, "link");

const joinGroup = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invitation token is required"
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const group = await Group.findOne({
            invitations: {
                $elemMatch: {
                    tokenHash,
                    status: "pending",
                    expiresAt: { $gt: new Date() }
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
            invite.expiresAt > new Date()
        );

        const user = await User.findById(req.user.id).select("email");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }

        if (invitation.email && invitation.email !== user.email.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: "Sign in with the email address invited to this group"
            });
        }

        if (group.members.some(
            member => member.toString() === req.user.id
        )) {
            return res.status(409).json({
                success: false,
                message: "You are already a group member"
            });
        }

        group.members.push(req.user.id);
        invitation.status = "accepted";

        await group.save();

        return res.json({
            success: true,
            message: "You joined the group successfully",
            groupId: group._id
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not join group"
        });
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    inviteByEmail,
    createInviteLink,
    joinGroup
};
