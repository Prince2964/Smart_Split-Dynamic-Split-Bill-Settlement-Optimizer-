const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SplitSmart API is healthy"
    });
});

module.exports = router;
