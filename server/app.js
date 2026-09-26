const express = require("express");
const cors = require("cors");

const pool = require("./config/database");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "StockSense API is running"
    });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            success: true,
            database: rows[0].database_name
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// API Routes
app.use("/api", routes);

// 404 and Error handling middlewares
app.use(notFound);
app.use(errorHandler);

module.exports = app;