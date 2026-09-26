const pool = require("../config/database");

/**
 * Insert a new receipt and its items
 */
const createReceipt = async ({ receipt_number, supplier_id, location_id, status = "draft", created_by }, items, client = null) => {
    const db = client || pool;

    const [receiptResult] = await db.query(`
        INSERT INTO receipts (receipt_number, supplier_id, location_id, status, created_by)
        VALUES (?, ?, ?, ?, ?)
    `, [receipt_number, supplier_id ?? null, location_id, status, created_by ?? null]);

    const receiptId = receiptResult.insertId;

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO receipt_items (receipt_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [receiptId, item.product_id, item.quantity]);
        }
    }

    return receiptId;
};

/**
 * Fetch all receipts with joined supplier, location, warehouse, user, and item aggregate statistics
 */
const getAllReceipts = async () => {
    const [rows] = await pool.query(`
        SELECT
            r.id,
            r.receipt_number,
            r.supplier_id,
            s.name AS supplier_name,
            r.location_id,
            l.name AS location_name,
            w.name AS warehouse_name,
            r.status,
            r.created_by,
            u.name AS created_by_name,
            r.created_at,
            COUNT(ri.id) AS item_count,
            COALESCE(SUM(ri.quantity), 0) AS total_quantity
        FROM receipts r
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        LEFT JOIN locations l ON r.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
        GROUP BY
            r.id,
            r.receipt_number,
            r.supplier_id,
            s.name,
            r.location_id,
            l.name,
            w.name,
            r.status,
            r.created_by,
            u.name,
            r.created_at
        ORDER BY r.id DESC
    `);

    return rows;
};

/**
 * Fetch a single receipt by ID with joined header info
 */
const getReceiptById = async (id, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            r.id,
            r.receipt_number,
            r.supplier_id,
            s.name AS supplier_name,
            r.location_id,
            l.name AS location_name,
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            r.status,
            r.created_by,
            u.name AS created_by_name,
            r.created_at
        FROM receipts r
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        LEFT JOIN locations l ON r.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Fetch all items for a given receipt joined with product details
 */
const getReceiptItems = async (receiptId, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            ri.id,
            ri.receipt_id,
            ri.product_id,
            p.name AS product_name,
            p.sku AS product_sku,
            p.unit_of_measure,
            ri.quantity
        FROM receipt_items ri
        LEFT JOIN products p ON ri.product_id = p.id
        WHERE ri.receipt_id = ?
        ORDER BY ri.id ASC
    `, [receiptId]);

    return rows;
};

/**
 * Lookup receipt by receipt_number (optionally excluding a specific receipt ID)
 */
const getReceiptByNumber = async (receiptNumber, excludeId = null) => {
    let sql = `SELECT id, receipt_number FROM receipts WHERE receipt_number = ?`;
    const params = [receiptNumber];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Update receipt header information
 */
const updateReceipt = async (id, { supplier_id, location_id, status }, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE receipts
        SET
            supplier_id = ?,
            location_id = ?,
            status = ?
        WHERE id = ?
    `, [supplier_id ?? null, location_id, status, id]);

    return result.affectedRows;
};

/**
 * Update receipt status
 */
const updateReceiptStatus = async (id, status, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE receipts
        SET status = ?
        WHERE id = ?
    `, [status, id]);

    return result.affectedRows;
};

/**
 * Replace all items for a receipt
 */
const updateReceiptItems = async (receiptId, items, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM receipt_items WHERE receipt_id = ?`, [receiptId]);

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO receipt_items (receipt_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [receiptId, item.product_id, item.quantity]);
        }
    }
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
 * Update stock quantity inside transaction
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
 * Insert a new stock row inside transaction
 */
const insertStock = async (productId, locationId, quantity, client) => {
    const [result] = await client.query(`
        INSERT INTO stock (product_id, location_id, quantity)
        VALUES (?, ?, ?)
    `, [productId, locationId, quantity]);

    return result.insertId;
};

/**
 * Insert a stock ledger audit entry inside transaction
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
    createReceipt,
    getAllReceipts,
    getReceiptById,
    getReceiptItems,
    getReceiptByNumber,
    updateReceipt,
    updateReceiptStatus,
    updateReceiptItems,
    getStockForUpdate,
    updateStockQuantity,
    insertStock,
    insertStockLedger
};
