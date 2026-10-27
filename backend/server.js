const cors = require("cors");
require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = new Set([
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "https://smart-split-beryl.vercel.app",
    process.env.FRONTEND_URL
].filter(Boolean));

// FRONTEND_URL should be the deployed Vercel URL (or local frontend URL).
if (process.env.FRONTEND_URL) {
    try {
        allowedOrigins.add(new URL(process.env.FRONTEND_URL).origin);
    } catch {
        console.warn("FRONTEND_URL is not a valid URL; check Render environment variables.");
    }
}

app.use(cors({
    origin(origin, callback) {
        // Allow server-to-server tools and local requests without an Origin header.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS"));
    }
}));

app.use(express.json({ limit: "1mb" }));

// Existing routes
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");

// New group module routes
const groupRoutes = require("./routes/groupRoutes");
const groupExpenseRoutes = require("./routes/groupExpenseRoutes");

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/group-expenses", groupExpenseRoutes);

app.get("/", (req, res) => {
    res.send("SplitSmart Backend is running!");
});

// Unknown API route
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// General error handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body"
        });
    }

    console.error("Server error:", err.message);

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(
                `SplitSmart backend listening on port ${PORT}`
            );
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
