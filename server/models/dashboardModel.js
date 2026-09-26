const pool = require("../config/database");

/**
 * Get authoritative dashboard summary KPIs using SQL aggregation.
 * Low stock: stock > 0 AND stock <= reorder_level (where reorder_level > 0)
 * Out of stock: stock <= 0 (products with stock rows having quantity <= 0)
 */
const getDashboardSummary = async () => {
    const [rows] = await pool.query(`
        SELECT
            -- Total products in master catalog
            (SELECT COUNT(*) FROM products) AS total_products,

            -- Out of stock: has a stock row with qty <= 0
            (
                SELECT COUNT(DISTINCT p.id)
                FROM products p
                INNER JOIN stock s ON p.id = s.product_id
                WHERE s.quantity <= 0
            ) AS out_of_stock,

            -- Low stock: qty > 0 AND qty <= reorder_level (and reorder_level > 0)
            (
                SELECT COUNT(DISTINCT p.id)
                FROM products p
                INNER JOIN stock s ON p.id = s.product_id
                WHERE s.quantity > 0
                  AND p.reorder_level > 0
                  AND s.quantity <= p.reorder_level
            ) AS low_stock,

            -- Pending receipts: not done, not canceled
            (
                SELECT COUNT(*)
                FROM receipts
                WHERE status NOT IN ('done', 'canceled')
            ) AS pending_receipts,

            -- Pending deliveries: not done, not canceled
            (
                SELECT COUNT(*)
                FROM deliveries
                WHERE status NOT IN ('done', 'canceled')
            ) AS pending_deliveries,

            -- Scheduled transfers: not done, not canceled
            (
                SELECT COUNT(*)
                FROM transfers
                WHERE status NOT IN ('done', 'canceled')
            ) AS scheduled_transfers
    `);

    return rows[0] || {
        total_products: 0,
        out_of_stock: 0,
        low_stock: 0,
        pending_receipts: 0,
        pending_deliveries: 0,
        scheduled_transfers: 0
    };
};

/**
 * Get recent ledger activity for dashboard feed (latest 10 movements)
 */
const getRecentActivity = async (limit = 10) => {
    const [rows] = await pool.query(`
        SELECT
            sl.id,
            p.name AS product_name,
            p.sku,
            l.name AS location_name,
            w.name AS warehouse_name,
            sl.movement_type,
            sl.quantity_change,
            sl.balance_after,
            sl.created_at,
            u.name AS created_by_name,
            CASE sl.movement_type
                WHEN 'receipt' THEN r.receipt_number
                WHEN 'delivery' THEN d.delivery_number
                WHEN 'transfer_in' THEN t.transfer_number
                WHEN 'transfer_out' THEN t.transfer_number
                WHEN 'adjustment' THEN a.adjustment_number
                ELSE NULL
            END AS reference_number
        FROM stock_ledger sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN locations l ON sl.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON sl.created_by = u.id
        LEFT JOIN receipts r ON sl.reference_id = r.id AND sl.movement_type = 'receipt'
        LEFT JOIN deliveries d ON sl.reference_id = d.id AND sl.movement_type = 'delivery'
        LEFT JOIN transfers t ON sl.reference_id = t.id AND sl.movement_type IN ('transfer_in', 'transfer_out')
        LEFT JOIN adjustments a ON sl.reference_id = a.id AND sl.movement_type = 'adjustment'
        ORDER BY sl.created_at DESC, sl.id DESC
        LIMIT ?
    `, [limit]);

    return rows;
};

/**
 * Get products that are low stock or out of stock for dashboard widget
 */
const getLowStockProducts = async (limit = 8) => {
    const [rows] = await pool.query(`
        SELECT
            p.id,
            p.name,
            p.sku,
            p.reorder_level,
            p.unit_of_measure,
            COALESCE(SUM(s.quantity), 0) AS total_quantity
        FROM products p
        LEFT JOIN stock s ON p.id = s.product_id
        GROUP BY p.id, p.name, p.sku, p.reorder_level, p.unit_of_measure
        HAVING
            (COALESCE(SUM(s.quantity), 0) <= 0)
            OR (
                p.reorder_level > 0
                AND COALESCE(SUM(s.quantity), 0) > 0
                AND COALESCE(SUM(s.quantity), 0) <= p.reorder_level
            )
        ORDER BY COALESCE(SUM(s.quantity), 0) ASC
        LIMIT ?
    `, [limit]);

    return rows;
};

module.exports = {
    getDashboardSummary,
    getRecentActivity,
    getLowStockProducts
};
