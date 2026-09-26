const pool = require("../config/database");

/**
 * Insert a new delivery and its line items
 */
const createDelivery = async ({ delivery_number, customer_name, location_id, status = "draft", created_by }, items, client = null) => {
    const db = client || pool;

    const [deliveryResult] = await db.query(`
        INSERT INTO deliveries (delivery_number, customer_name, location_id, status, created_by)
        VALUES (?, ?, ?, ?, ?)
    `, [delivery_number, customer_name ?? null, location_id, status, created_by ?? null]);

    const deliveryId = deliveryResult.insertId;

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO delivery_items (delivery_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [deliveryId, item.product_id, item.quantity]);
        }
    }

    return deliveryId;
};

/**
 * Fetch all deliveries with location, warehouse, user, and aggregate item details
 */
const getAllDeliveries = async () => {
    const [rows] = await pool.query(`
        SELECT
            d.id,
            d.delivery_number,
            d.customer_name,
            d.location_id,
            l.name AS location_name,
            w.name AS warehouse_name,
            d.status,
            d.created_by,
            u.name AS created_by_name,
            d.created_at,
            COUNT(di.id) AS item_count,
            COALESCE(SUM(di.quantity), 0) AS total_quantity
        FROM deliveries d
        LEFT JOIN locations l ON d.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON d.created_by = u.id
        LEFT JOIN delivery_items di ON d.id = di.delivery_id
        GROUP BY
            d.id,
            d.delivery_number,
            d.customer_name,
            d.location_id,
            l.name,
            w.name,
            d.status,
            d.created_by,
            u.name,
            d.created_at
        ORDER BY d.id DESC
    `);

    return rows;
};

/**
 * Fetch a single delivery by ID with joined header info
 */
const getDeliveryById = async (id, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            d.id,
            d.delivery_number,
            d.customer_name,
            d.location_id,
            l.name AS location_name,
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            d.status,
            d.created_by,
            u.name AS created_by_name,
            d.created_at
        FROM deliveries d
        LEFT JOIN locations l ON d.location_id = l.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        LEFT JOIN users u ON d.created_by = u.id
        WHERE d.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Fetch all items for a given delivery joined with product details
 */
const getDeliveryItems = async (deliveryId, client = null) => {
    const db = client || pool;

    const [rows] = await db.query(`
        SELECT
            di.id,
            di.delivery_id,
            di.product_id,
            p.name AS product_name,
            p.sku AS product_sku,
            p.unit_of_measure,
            di.quantity
        FROM delivery_items di
        LEFT JOIN products p ON di.product_id = p.id
        WHERE di.delivery_id = ?
        ORDER BY di.id ASC
    `, [deliveryId]);

    return rows;
};

/**
 * Lookup delivery by delivery_number
 */
const getDeliveryByNumber = async (deliveryNumber, excludeId = null) => {
    let sql = `SELECT id, delivery_number FROM deliveries WHERE delivery_number = ?`;
    const params = [deliveryNumber];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Update delivery header fields
 */
const updateDelivery = async (id, { customer_name, location_id, status }, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE deliveries
        SET
            customer_name = ?,
            location_id = ?,
            status = ?
        WHERE id = ?
    `, [customer_name ?? null, location_id, status, id]);

    return result.affectedRows;
};

/**
 * Update delivery status
 */
const updateDeliveryStatus = async (id, status, client = null) => {
    const db = client || pool;

    const [result] = await db.query(`
        UPDATE deliveries
        SET status = ?
        WHERE id = ?
    `, [status, id]);

    return result.affectedRows;
};

/**
 * Replace all items for a delivery
 */
const updateDeliveryItems = async (deliveryId, items, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM delivery_items WHERE delivery_id = ?`, [deliveryId]);

    if (items && items.length > 0) {
        for (const item of items) {
            await db.query(`
                INSERT INTO delivery_items (delivery_id, product_id, quantity)
                VALUES (?, ?, ?)
            `, [deliveryId, item.product_id, item.quantity]);
        }
    }
};

/**
 * Delete a delivery and its line items
 */
const deleteDelivery = async (id, client = null) => {
    const db = client || pool;

    await db.query(`DELETE FROM delivery_items WHERE delivery_id = ?`, [id]);
    const [result] = await db.query(`DELETE FROM deliveries WHERE id = ?`, [id]);
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
    createDelivery,
    getAllDeliveries,
    getDeliveryById,
    getDeliveryItems,
    getDeliveryByNumber,
    updateDelivery,
    updateDeliveryStatus,
    updateDeliveryItems,
    deleteDelivery,
    getStockForUpdate,
    updateStockQuantity,
    insertStockLedger
};
