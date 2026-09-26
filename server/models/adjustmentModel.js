const pool = require("../config/database");

/**
 * Insert a new adjustment and its line items
 */
const createAdjustment = async ({ adjustment_number, location_id, reason, status = "draft", created_by }, items, client = null) => {
    const db = client || pool;

    const [adjResult] = await db.query(`
        INSERT INTO adjustments (adjustment_number, location_id, reason, status, created_by)
        VALUES (?, ?, ?, ?, ?)
    `, [adjustment_number, location_id, reason ?? null, status, created_by ?? null]);

    const adjustmentId = adjResult.insertId;

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO adjustment_items (adjustment_id, product_id, system_quantity, counted_quantity, difference)
                VALUES (?, ?, ?, ?, ?)
            `, [adjustmentId, item.product_id, item.system_quantity, item.counted_quantity, item.difference]);
        }
    }

    return adjustmentId;
};

/**
 * Fetch all adjustments with location, warehouse, user, and aggregate item statistics
 */
const getAllAdjustments = async () => {
    const [rows] = await pool.query(`
        SELECT
            a.id,
            a.adjustment_number,
            a.location_id,
            l.name AS location_name,
            w.name AS warehouse_name,
            a.reason,
            a.status,
            a.created_by,
            u.name AS created_by_name,
            a.created_at,
            COUNT(ai.id) AS item_count,
            COALESCE(SUM(ai.difference), 0) AS total_difference
        FROM adjustments a
        LEFT JOIN locations l ON a.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN adjustment_items ai ON a.id = ai.adjustment_id
        GROUP BY
            a.id,
            a.adjustment_number,
            a.location_id,
            l.name,
            w.name,
            a.reason,
            a.status,
            a.created_by,
            u.name,
            a.created_at
        ORDER BY a.id DESC
    `);

    return rows;
};

/**
 * Fetch a single adjustment by ID with joined header details
 */
const getAdjustmentById = async (id, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            a.id,
            a.adjustment_number,
            a.location_id,
            l.name AS location_name,
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            a.reason,
            a.status,
            a.created_by,
            u.name AS created_by_name,
            a.created_at
        FROM adjustments a
        LEFT JOIN locations l ON a.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON a.created_by = u.id
        WHERE a.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Fetch all items for an adjustment joined with product details
 */
const getAdjustmentItems = async (adjustmentId, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            ai.id,
            ai.adjustment_id,
            ai.product_id,
            p.name AS product_name,
            p.sku AS product_sku,
            p.unit_of_measure,
            ai.system_quantity,
            ai.counted_quantity,
            ai.difference
        FROM adjustment_items ai
        LEFT JOIN products p ON ai.product_id = p.id
        WHERE ai.adjustment_id = ?
        ORDER BY ai.id ASC
    `, [adjustmentId]);

    return rows;
};

/**
 * Lookup adjustment by adjustment_number
 */
const getAdjustmentByNumber = async (adjustmentNumber, excludeId = null) => {
    let sql = `SELECT id, adjustment_number FROM adjustments WHERE adjustment_number = ?`;
    const params = [adjustmentNumber];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Update adjustment header fields
 */
const updateAdjustment = async (id, { location_id, reason, status }, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE adjustments
        SET
            location_id = ?,
            reason = ?,
            status = ?
        WHERE id = ?
    `, [location_id, reason ?? null, status, id]);

    return result.affectedRows;
};

/**
 * Update adjustment status
 */
const updateAdjustmentStatus = async (id, status, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE adjustments
        SET status = ?
        WHERE id = ?
    `, [status, id]);

    return result.affectedRows;
};

/**
 * Replace all items for an adjustment
 */
const updateAdjustmentItems = async (adjustmentId, items, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM adjustment_items WHERE adjustment_id = ?`, [adjustmentId]);

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO adjustment_items (adjustment_id, product_id, system_quantity, counted_quantity, difference)
                VALUES (?, ?, ?, ?, ?)
            `, [adjustmentId, item.product_id, item.system_quantity, item.counted_quantity, item.difference]);
        }
    }
};

/**
 * Update a specific adjustment item's system_quantity and difference during validation
 */
const updateAdjustmentItemValues = async (itemId, systemQuantity, difference, client) => {
    const [result] = await client.query(`
        UPDATE adjustment_items
        SET system_quantity = ?, difference = ?
        WHERE id = ?
    `, [systemQuantity, difference, itemId]);

    return result.affectedRows;
};

/**
 * Delete an adjustment and its line items
 */
const deleteAdjustment = async (id, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM adjustment_items WHERE adjustment_id = ?`, [id]);
    const [result] = await db.query(`DELETE FROM adjustments WHERE id = ?`, [id]);
    return result.affectedRows;
};

/**
 * Read current stock row without locking (used during draft creation/editing)
 */
const getStockQuantity = async (productId, locationId, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT id, product_id, location_id, quantity
        FROM stock
        WHERE product_id = ? AND location_id = ?
    `, [productId, locationId]);

    return rows[0] || null;
};

/**
 * Lock and select current stock record for update inside an active transaction
 */
const getStockForUpdate = async (productId, locationId, client) => {
    const [rows] = await client.query(`
        SELECT id, product_id, location_id, quantity
        FROM stock
        WHERE product_id = ? AND location_id = ?
        FOR UPDATE
    `, [productId, locationId]);

    return rows[0] || null;
};

/**
 * Update stock quantity inside an active transaction
 */
const updateStockQuantity = async (stockId, newQuantity, client) => {
    const [result] = await client.query(`
        UPDATE stock
        SET quantity = ?
        WHERE id = ?
    `, [newQuantity, stockId]);

    return result.affectedRows;
};

/**
 * Insert a new stock row inside an active transaction
 */
const insertStock = async (productId, locationId, quantity, client) => {
    const [result] = await client.query(`
        INSERT INTO stock (product_id, location_id, quantity)
        VALUES (?, ?, ?)
    `, [productId, locationId, quantity]);

    return result.insertId;
};

/**
 * Insert a stock ledger audit entry inside an active transaction
 */
const insertStockLedger = async ({ product_id, location_id, movement_type, reference_id, quantity_change, balance_after, created_by }, client) => {
    const [result] = await client.query(`
        INSERT INTO stock_ledger (
            product_id,
            location_id,
            movement_type,
            reference_id,
            quantity_change,
            balance_after,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        product_id,
        location_id,
        movement_type,
        reference_id ?? null,
        quantity_change,
        balance_after,
        created_by ?? null
    ]);

    return result.insertId;
};

module.exports = {
    createAdjustment,
    getAllAdjustments,
    getAdjustmentById,
    getAdjustmentItems,
    getAdjustmentByNumber,
    updateAdjustment,
    updateAdjustmentStatus,
    updateAdjustmentItems,
    updateAdjustmentItemValues,
    deleteAdjustment,
    getStockQuantity,
    getStockForUpdate,
    updateStockQuantity,
    insertStock,
    insertStockLedger
};
