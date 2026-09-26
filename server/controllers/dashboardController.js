const dashboardService = require("../services/dashboardService");

/**
 * GET /api/dashboard/summary
 * Returns authoritative KPI metrics for the inventory dashboard.
 * Requires JWT authentication.
 */
const getSummary = async (req, res) => {
    try {
        const data = await dashboardService.getSummary();
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Dashboard summary error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard summary"
        });
    }
};

/**
 * GET /api/dashboard/activity
 * Returns the latest inventory ledger movements for the activity feed.
 * Requires JWT authentication.
 */
const getRecentActivity = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const data = await dashboardService.getRecentActivity(limit);
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Dashboard activity error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to load recent activity"
        });
    }
};

/**
 * GET /api/dashboard/low-stock
 * Returns products that are low stock or out of stock.
 * Requires JWT authentication.
 */
const getLowStockProducts = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 8, 50);
        const data = await dashboardService.getLowStockProducts(limit);
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Dashboard low-stock error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to load low stock products"
        });
    }
};

module.exports = { getSummary, getRecentActivity, getLowStockProducts };
