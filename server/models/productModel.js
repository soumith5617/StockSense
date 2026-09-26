const pool = require("../config/database");

/**
 * Fetch all products with their category name
 */
const getAllProducts = async () => {
    const [rows] = await pool.query(`
        SELECT
            p.id,
            p.name,
            p.sku,
            p.category_id,
            c.name AS category_name,
            p.unit_of_measure,
            p.reorder_level,
            p.created_at
        FROM products p
        LEFT JOIN categories c
            ON p.category_id = c.id
        ORDER BY p.id DESC
    `);

    return rows;
};

/**
 * Fetch a single product by ID with its category name
 */
const getProductById = async (id) => {
    const [rows] = await pool.query(`
        SELECT
            p.id,
            p.name,
            p.sku,
            p.category_id,
            c.name AS category_name,
            p.unit_of_measure,
            p.reorder_level,
            p.created_at
        FROM products p
        LEFT JOIN categories c
            ON p.category_id = c.id
        WHERE p.id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Find a product by SKU (optionally excluding a specific product ID)
 */
const getProductBySku = async (sku, excludeId = null) => {
    let sql = `SELECT id, sku, name FROM products WHERE sku = ?`;
    const params = [sku];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Check if a category exists by ID
 */
const getCategoryById = async (categoryId) => {
    const [rows] = await pool.query(`
        SELECT id, name FROM categories WHERE id = ?
    `, [categoryId]);

    return rows[0] || null;
};

/**
 * Check references to a product across inventory and transaction tables
 */
const checkProductReferences = async (id) => {
    const [rows] = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM stock WHERE product_id = ?) AS stock_count,
            (SELECT COALESCE(SUM(quantity), 0) FROM stock WHERE product_id = ?) AS total_stock_qty,
            (SELECT COUNT(*) FROM stock_ledger WHERE product_id = ?) AS ledger_count,
            (SELECT COUNT(*) FROM receipt_items WHERE product_id = ?) AS receipt_count,
            (SELECT COUNT(*) FROM delivery_items WHERE product_id = ?) AS delivery_count,
            (SELECT COUNT(*) FROM transfer_items WHERE product_id = ?) AS transfer_count,
            (SELECT COUNT(*) FROM adjustment_items WHERE product_id = ?) AS adjustment_count
    `, [id, id, id, id, id, id, id]);

    const stats = rows[0] || {};
    const stockCount = Number(stats.stock_count || 0);
    const totalStockQty = Number(stats.total_stock_qty || 0);
    const ledgerCount = Number(stats.ledger_count || 0);
    const receiptCount = Number(stats.receipt_count || 0);
    const deliveryCount = Number(stats.delivery_count || 0);
    const transferCount = Number(stats.transfer_count || 0);
    const adjustmentCount = Number(stats.adjustment_count || 0);

    const isReferenced = (
        stockCount > 0 ||
        totalStockQty > 0 ||
        ledgerCount > 0 ||
        receiptCount > 0 ||
        deliveryCount > 0 ||
        transferCount > 0 ||
        adjustmentCount > 0
    );

    return {
        isReferenced,
        references: {
            stockCount,
            totalStockQty,
            ledgerCount,
            receiptCount,
            deliveryCount,
            transferCount,
            adjustmentCount
        }
    };
};

/**
 * Insert a new product
 */
const createProduct = async (product) => {
    const {
        name,
        sku,
        category_id,
        unit_of_measure,
        reorder_level
    } = product;

    const [result] = await pool.query(`
        INSERT INTO products (
            name,
            sku,
            category_id,
            unit_of_measure,
            reorder_level
        )
        VALUES (?, ?, ?, ?, ?)
    `, [
        name,
        sku,
        category_id ?? null,
        unit_of_measure,
        reorder_level ?? 0
    ]);

    return result.insertId;
};

/**
 * Update an existing product
 */
const updateProduct = async (id, product) => {
    const {
        name,
        sku,
        category_id,
        unit_of_measure,
        reorder_level
    } = product;

    const [result] = await pool.query(`
        UPDATE products
        SET
            name = ?,
            sku = ?,
            category_id = ?,
            unit_of_measure = ?,
            reorder_level = ?
        WHERE id = ?
    `, [
        name,
        sku,
        category_id ?? null,
        unit_of_measure,
        reorder_level ?? 0,
        id
    ]);

    return result.affectedRows;
};

/**
 * Delete a product by ID
 */
const deleteProduct = async (id) => {
    const [result] = await pool.query(`
        DELETE FROM products WHERE id = ?
    `, [id]);

    return result.affectedRows;
};

module.exports = {
    getAllProducts,
    getProductById,
    getProductBySku,
    getCategoryById,
    checkProductReferences,
    createProduct,
    updateProduct,
    deleteProduct
};