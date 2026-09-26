const pool = require("../config/database");

/**
 * Insert a new supplier
 */
const createSupplier = async ({ name, email, phone, address }) => {
    const [result] = await pool.query(`
        INSERT INTO suppliers (name, email, phone, address)
        VALUES (?, ?, ?, ?)
    `, [name, email ?? null, phone ?? null, address ?? null]);

    return result.insertId;
};

/**
 * Fetch all suppliers ordered by ID DESC
 */
const getAllSuppliers = async () => {
    const [rows] = await pool.query(`
        SELECT id, name, email, phone, address, created_at
        FROM suppliers
        ORDER BY id DESC
    `);

    return rows;
};

/**
 * Fetch supplier by ID
 */
const getSupplierById = async (id) => {
    const [rows] = await pool.query(`
        SELECT id, name, email, phone, address, created_at
        FROM suppliers
        WHERE id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Update an existing supplier
 */
const updateSupplier = async (id, { name, email, phone, address }) => {
    const [result] = await pool.query(`
        UPDATE suppliers
        SET
            name = ?,
            email = ?,
            phone = ?,
            address = ?
        WHERE id = ?
    `, [name, email ?? null, phone ?? null, address ?? null, id]);

    return result.affectedRows;
};

/**
 * Delete a supplier by ID
 */
const deleteSupplier = async (id) => {
    const [result] = await pool.query(`
        DELETE FROM suppliers
        WHERE id = ?
    `, [id]);

    return result.affectedRows;
};

/**
 * Check count of receipts referencing this supplier
 */
const getSupplierReceiptCount = async (supplierId) => {
    const [rows] = await pool.query(`
        SELECT COUNT(*) AS receipt_count
        FROM receipts
        WHERE supplier_id = ?
    `, [supplierId]);

    return Number(rows[0]?.receipt_count || 0);
};

module.exports = {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier,
    getSupplierReceiptCount
};
