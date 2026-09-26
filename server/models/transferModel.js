const pool = require("../config/database");

/**
 * Insert a new transfer and its line items
 */
const createTransfer = async ({ transfer_number, source_location_id, destination_location_id, status = "draft", created_by }, items, client = null) => {
    const db = client || pool;

    const [transferResult] = await db.query(`
        INSERT INTO transfers (transfer_number, source_location_id, destination_location_id, status, created_by)
        VALUES (?, ?, ?, ?, ?)
    `, [transfer_number, source_location_id, destination_location_id, status, created_by ?? null]);

    const transferId = transferResult.insertId;

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO transfer_items (transfer_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [transferId, item.product_id, item.quantity]);
        }
    }

    return transferId;
};

/**
 * Fetch all transfers with joined source/destination location, warehouse, user, and aggregate item statistics
 */
const getAllTransfers = async () => {
    const [rows] = await pool.query(`
        SELECT
            t.id,
            t.transfer_number,
            t.source_location_id,
            sl.name AS source_location_name,
            sw.name AS source_warehouse_name,
            t.destination_location_id,
            dl.name AS destination_location_name,
            dw.name AS destination_warehouse_name,
            t.status,
            t.created_by,
            u.name AS created_by_name,
            t.created_at,
            COUNT(ti.id) AS item_count,
            COALESCE(SUM(ti.quantity), 0) AS total_quantity
        FROM transfers t
        LEFT JOIN locations sl ON t.source_location_id = sl.id
        LEFT JOIN warehouses sw ON sl.warehouse_id = sw.id
        LEFT JOIN locations dl ON t.destination_location_id = dl.id
        LEFT JOIN warehouses dw ON dl.warehouse_id = dw.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
        GROUP BY
            t.id,
            t.transfer_number,
            t.source_location_id,
            sl.name,
            sw.name,
            t.destination_location_id,
            dl.name,
            dw.name,
            t.status,
            t.created_by,
            u.name,
            t.created_at
        ORDER BY t.id DESC
    `);

    return rows;
};

/**
 * Fetch a single transfer by ID with joined header details
 */
const getTransferById = async (id, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            t.id,
            t.transfer_number,
            t.source_location_id,
            sl.name AS source_location_name,
            sw.id AS source_warehouse_id,
            sw.name AS source_warehouse_name,
            t.destination_location_id,
            dl.name AS destination_location_name,
            dw.id AS destination_warehouse_id,
            dw.name AS destination_warehouse_name,
            t.status,
            t.created_by,
            u.name AS created_by_name,
            t.created_at
        FROM transfers t
        LEFT JOIN locations sl ON t.source_location_id = sl.id
        LEFT JOIN warehouses sw ON sl.warehouse_id = sw.id
        LEFT JOIN locations dl ON t.destination_location_id = dl.id
        LEFT JOIN warehouses dw ON dl.warehouse_id = dw.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Fetch all items for a given transfer joined with product details
 */
const getTransferItems = async (transferId, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            ti.id,
            ti.transfer_id,
            ti.product_id,
            p.name AS product_name,
            p.sku AS product_sku,
            p.unit_of_measure,
            ti.quantity
        FROM transfer_items ti
        LEFT JOIN products p ON ti.product_id = p.id
        WHERE ti.transfer_id = ?
        ORDER BY ti.id ASC
    `, [transferId]);

    return rows;
};

/**
 * Lookup transfer by transfer_number
 */
const getTransferByNumber = async (transferNumber, excludeId = null) => {
    let sql = `SELECT id, transfer_number FROM transfers WHERE transfer_number = ?`;
    const params = [transferNumber];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Update transfer header fields
 */
const updateTransfer = async (id, { source_location_id, destination_location_id, status }, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE transfers
        SET
            source_location_id = ?,
            destination_location_id = ?,
            status = ?
        WHERE id = ?
    `, [source_location_id, destination_location_id, status, id]);

    return result.affectedRows;
};

/**
 * Update transfer status
 */
const updateTransferStatus = async (id, status, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE transfers
        SET status = ?
        WHERE id = ?
    `, [status, id]);

    return result.affectedRows;
};

/**
 * Replace all items for a transfer
 */
const updateTransferItems = async (transferId, items, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM transfer_items WHERE transfer_id = ?`, [transferId]);

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO transfer_items (transfer_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [transferId, item.product_id, item.quantity]);
        }
    }
};

/**
 * Delete a transfer and its line items
 */
const deleteTransfer = async (id, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM transfer_items WHERE transfer_id = ?`, [id]);
    const [result] = await db.query(`DELETE FROM transfers WHERE id = ?`, [id]);
    return result.affectedRows;
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
    createTransfer,
    getAllTransfers,
    getTransferById,
    getTransferItems,
    getTransferByNumber,
    updateTransfer,
    updateTransferStatus,
    updateTransferItems,
    deleteTransfer,
    getStockForUpdate,
    updateStockQuantity,
    insertStock,
    insertStockLedger
};
