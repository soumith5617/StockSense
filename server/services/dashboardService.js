const dashboardModel = require("../models/dashboardModel");

/**
 * Fetch authoritative dashboard summary KPIs.
 * All calculations are done in SQL — no React-side arithmetic.
 */
const getSummary = async () => {
    const row = await dashboardModel.getDashboardSummary();

    return {
        totalProducts: Number(row.total_products || 0),
        lowStockItems: Number(row.low_stock || 0),
        outOfStockItems: Number(row.out_of_stock || 0),
        pendingReceipts: Number(row.pending_receipts || 0),
        pendingDeliveries: Number(row.pending_deliveries || 0),
        scheduledTransfers: Number(row.scheduled_transfers || 0)
    };
};

/**
 * Fetch recent inventory ledger activity for dashboard feed.
 */
const getRecentActivity = async (limit = 10) => {
    const rows = await dashboardModel.getRecentActivity(limit);
    return rows;
};

/**
 * Fetch low-stock and out-of-stock products for dashboard widget.
 */
const getLowStockProducts = async (limit = 8) => {
    const rows = await dashboardModel.getLowStockProducts(limit);
    return rows.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        reorder_level: Number(p.reorder_level || 0),
        unit_of_measure: p.unit_of_measure,
        total_quantity: Number(p.total_quantity || 0),
        status: Number(p.total_quantity || 0) <= 0 ? 'out_of_stock' : 'low_stock'
    }));
};

module.exports = {
    getSummary,
    getRecentActivity,
    getLowStockProducts
};
