
const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            default: null,
            lowercase: true,
            trim: true
        },
        tokenHash: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ["email", "link"],
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "revoked"],
            default: "pending"
        },
        expiresAt: {
            type: Date,
            required: true
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        purpose: {
            type: String,
            enum: ["trip", "household", "custom"],
            default: "custom"
        },

        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500
        },

        thumbnail: {
            type: String,
            default: ""
        },

        budget: {
            total: { type: Number, default: 0 },
            categories: {
                Travel: { type: Number, default: 0 },
                "Hotel / Stay": { type: Number, default: 0 },
                Food: { type: Number, default: 0 },
                Activities: { type: Number, default: 0 }
            }
        },

        meta: {
            destination: { type: String, default: "" },
            startDate: { type: String, default: "" },
            endDate: { type: String, default: "" },
            address: { type: String, default: "" },
            description: { type: String, default: "" },
            customPurpose: { type: String, default: "" }
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        members: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        settlementStatuses: {
            type: Map,
            of: new mongoose.Schema({
                status: {
                    type: String,
                    enum: ["pending", "paid"],
                    default: "pending"
                },
                paidAt: {
                    type: Date,
                    default: null
                },
                markedBy: {
                    type: String,
                    default: ""
                },
                fromId: {
                    type: String,
                    default: ""
                },
                toId: {
                    type: String,
                    default: ""
                },
                amount: {
                    type: Number,
                    default: 0
                }
            }, { _id: false }),
            default: () => new Map()
        },
        invitations: [invitationSchema]
    },
    { timestamps: true }
);

groupSchema.index({ members: 1, createdAt: -1 });

module.exports = mongoose.model("Group", groupSchema);
