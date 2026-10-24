const cors = require("cors");
require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501"
    ]
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
                `Server is running on http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
