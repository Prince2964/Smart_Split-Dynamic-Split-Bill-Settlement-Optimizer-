require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health API
const healthRoutes = require("./routes/healthRoutes");
app.use("/api/health", healthRoutes);

// Expense APIs
const expenseRoutes = require("./routes/expenseRoutes");
app.use("/api/expenses", expenseRoutes);

// Authentication APIs
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Root API
app.get("/", (req, res) => {
    res.send("SplitSmart Backend is running!");
});

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
};

startServer();