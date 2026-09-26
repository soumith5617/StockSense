const pool = require("../config/database");

/**
 * Build dynamic WHERE clause and parameters from validated filters
 */
function buildLedgerWhereClause(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.movement_type) {
        conditions.push("sl.movement_type = ?");
        params.push(filters.movement_type);
    }

    if (filters.location_id) {
        conditions.push("sl.location_id = ?");
        params.push(filters.location_id);
    }

    if (filters.product_id) {
        conditions.push("sl.product_id = ?");
        params.push(filters.product_id);
    }

    if (filters.start_date) {
        conditions.push("sl.created_at >= ?");
        params.push(filters.start_date);
    }

    if (filters.end_date) {
        conditions.push("sl.created_at <= ?");
        params.push(filters.end_date);
    }

    if (filters.search) {
        conditions.push(
            "(p.name LIKE ? OR p.sku LIKE ? OR l.name LIKE ? OR w.name LIKE ? OR sl.movement_type LIKE ?)"
        );
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereSql, params };
}

/**
 * Fetch enriched stock ledger entries with joins, filters, and pagination
 */
const getLedgerEntries = async (filters = {}, pagination = {}) => {
    const { whereSql, params } = buildLedgerWhereClause(filters);

    const limit = Number.isInteger(pagination.limit) && pagination.limit > 0 ? pagination.limit : 25;
    const offset = Number.isInteger(pagination.offset) && pagination.offset >= 0 ? pagination.offset : 0;

    const queryParams = [...params, limit, offset];

    const sql = `
        SELECT
            sl.id,
            sl.product_id,
            p.name AS product_name,
            p.sku,
            sl.location_id,
            l.name AS location_name,
            w.name AS warehouse_name,
            sl.movement_type,
            sl.reference_id,
            CASE sl.movement_type
                WHEN 'receipt' THEN r.receipt_number
                WHEN 'delivery' THEN d.delivery_number
                WHEN 'transfer_in' THEN t.transfer_number
                WHEN 'transfer_out' THEN t.transfer_number
                WHEN 'adjustment' THEN a.adjustment_number
                ELSE NULL
            END AS reference_number,
            sl.quantity_change,
            sl.balance_after,
            sl.created_by,
            u.name AS created_by_name,
            sl.created_at
        FROM stock_ledger sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN locations l ON sl.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON sl.created_by = u.id
        LEFT JOIN receipts r ON sl.reference_id = r.id AND sl.movement_type = 'receipt'
        LEFT JOIN deliveries d ON sl.reference_id = d.id AND sl.movement_type = 'delivery'
        LEFT JOIN transfers t ON sl.reference_id = t.id AND sl.movement_type IN ('transfer_in', 'transfer_out')
        LEFT JOIN adjustments a ON sl.reference_id = a.id AND sl.movement_type = 'adjustment'
        ${whereSql}
        ORDER BY sl.created_at DESC, sl.id DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, queryParams);
    return rows;
};

/**
 * Count total ledger entries matching the specified filters
 */
const countLedgerEntries = async (filters = {}) => {
    const { whereSql, params } = buildLedgerWhereClause(filters);

    const sql = `
        SELECT COUNT(*) AS total
        FROM stock_ledger sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN locations l ON sl.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON sl.created_by = u.id
        ${whereSql}
    `;

    const [rows] = await pool.query(sql, params);
    return rows[0]?.total || 0;
};

/**
 * Fetch a single stock ledger entry by ID
 */
const getLedgerEntryById = async (id) => {
    const sql = `
        SELECT
            sl.id,
            sl.product_id,
            p.name AS product_name,
            p.sku,
            sl.location_id,
            l.name AS location_name,
            w.name AS warehouse_name,
            sl.movement_type,
            sl.reference_id,
            CASE sl.movement_type
                WHEN 'receipt' THEN r.receipt_number
                WHEN 'delivery' THEN d.delivery_number
                WHEN 'transfer_in' THEN t.transfer_number
                WHEN 'transfer_out' THEN t.transfer_number
                WHEN 'adjustment' THEN a.adjustment_number
                ELSE NULL
            END AS reference_number,
            sl.quantity_change,
            sl.balance_after,
            sl.created_by,
            u.name AS created_by_name,
            sl.created_at
        FROM stock_ledger sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN locations l ON sl.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON sl.created_by = u.id
        LEFT JOIN receipts r ON sl.reference_id = r.id AND sl.movement_type = 'receipt'
        LEFT JOIN deliveries d ON sl.reference_id = d.id AND sl.movement_type = 'delivery'
        LEFT JOIN transfers t ON sl.reference_id = t.id AND sl.movement_type IN ('transfer_in', 'transfer_out')
        LEFT JOIN adjustments a ON sl.reference_id = a.id AND sl.movement_type = 'adjustment'
        WHERE sl.id = ?
    `;

    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
};

module.exports = {
    getLedgerEntries,
    countLedgerEntries,
    getLedgerEntryById
};
