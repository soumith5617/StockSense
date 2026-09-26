const express = require("express");
const { getSummary, getRecentActivity, getLowStockProducts } = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// All dashboard endpoints require authentication
router.use(authenticate);

router.get("/summary", getSummary);
router.get("/activity", getRecentActivity);
router.get("/low-stock", getLowStockProducts);

module.exports = router;
