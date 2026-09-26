const pool = require("../config/database");

/**
 * Insert a new location
 */
const createLocation = async ({ warehouse_id, name, code }) => {
    const [result] = await pool.query(`
        INSERT INTO locations (warehouse_id, name, code)
        VALUES (?, ?, ?)
    `, [warehouse_id, name, code]);

    return result.insertId;
};

/**
 * Fetch all locations with joined warehouse details
 */
const getAllLocations = async () => {
    const [rows] = await pool.query(`
        SELECT
            l.id,
            l.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            l.name,
            l.code,
            l.created_at
        FROM locations l
        LEFT JOIN warehouses w
            ON l.warehouse_id = w.id
        ORDER BY l.id DESC
    `);

    return rows;
};

/**
 * Fetch single location by ID with warehouse details
 */
const getLocationById = async (id) => {
    const [rows] = await pool.query(`
        SELECT
            l.id,
            l.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            l.name,
            l.code,
            l.created_at
        FROM locations l
        LEFT JOIN warehouses w
            ON l.warehouse_id = w.id
        WHERE l.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Find location by warehouse_id and code (optionally excluding a specific location ID)
 * Enforces uniqueness of code within a warehouse.
 */
const getLocationByWarehouseAndCode = async (warehouseId, code, excludeId = null) => {
    let sql = `SELECT id, warehouse_id, name, code FROM locations WHERE warehouse_id = ? AND code = ?`;
    const params = [warehouseId, code];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Check whether a location is referenced by inventory, transactions, or transfer records
 */
const checkLocationReferences = async (id) => {
    const [rows] = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM stock WHERE location_id = ?) AS stock_count,
            (SELECT COALESCE(SUM(quantity), 0) FROM stock WHERE location_id = ?) AS total_stock_qty,
            (SELECT COUNT(*) FROM receipts WHERE location_id = ?) AS receipt_count,
            (SELECT COUNT(*) FROM deliveries WHERE location_id = ?) AS delivery_count,
            (SELECT COUNT(*) FROM transfers WHERE source_location_id = ? OR destination_location_id = ?) AS transfer_count,
            (SELECT COUNT(*) FROM adjustments WHERE location_id = ?) AS adjustment_count,
            (SELECT COUNT(*) FROM stock_ledger WHERE location_id = ?) AS ledger_count
    `, [id, id, id, id, id, id, id, id]);

    const stats = rows[0] || {};
    const stockCount = Number(stats.stock_count || 0);
    const totalStockQty = Number(stats.total_stock_qty || 0);
    const receiptCount = Number(stats.receipt_count || 0);
    const deliveryCount = Number(stats.delivery_count || 0);
    const transferCount = Number(stats.transfer_count || 0);
    const adjustmentCount = Number(stats.adjustment_count || 0);
    const ledgerCount = Number(stats.ledger_count || 0);

    const isReferenced = (
        stockCount > 0 ||
        totalStockQty > 0 ||
        receiptCount > 0 ||
        deliveryCount > 0 ||
        transferCount > 0 ||
        adjustmentCount > 0 ||
        ledgerCount > 0
    );

    return {
        isReferenced,
        references: {
            stockCount,
            totalStockQty,
            receiptCount,
            deliveryCount,
            transferCount,
            adjustmentCount,
            ledgerCount
        }
    };
};

/**
 * Update an existing location
 */
const updateLocation = async (id, { warehouse_id, name, code }) => {
    const [result] = await pool.query(`
        UPDATE locations
        SET
            warehouse_id = ?,
            name = ?,
            code = ?
        WHERE id = ?
    `, [warehouse_id, name, code, id]);

    return result.affectedRows;
};

/**
 * Delete location by ID
 */
const deleteLocation = async (id) => {
    const [result] = await pool.query(`
        DELETE FROM locations
        WHERE id = ?
    `, [id]);

    return result.affectedRows;
};

module.exports = {
    createLocation,
    getAllLocations,
    getLocationById,
    getLocationByWarehouseAndCode,
    checkLocationReferences,
    updateLocation,
    deleteLocation
};
