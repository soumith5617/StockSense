const pool = require("../config/database");

/**
 * Insert a new warehouse
 */
const createWarehouse = async ({ name, code, address }) => {
    const [result] = await pool.query(`
        INSERT INTO warehouses (name, code, address)
        VALUES (?, ?, ?)
    `, [name, code, address ?? null]);

    return result.insertId;
};

/**
 * Fetch all warehouses ordered by ID DESC
 */
const getAllWarehouses = async () => {
    const [rows] = await pool.query(`
        SELECT id, name, code, address, created_at
        FROM warehouses
        ORDER BY id DESC
    `);

    return rows;
};

/**
 * Fetch warehouse by ID
 */
const getWarehouseById = async (id) => {
    const [rows] = await pool.query(`
        SELECT id, name, code, address, created_at
        FROM warehouses
        WHERE id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Find warehouse by unique code (optionally excluding a specific warehouse ID)
 */
const getWarehouseByCode = async (code, excludeId = null) => {
    let sql = `SELECT id, name, code, address, created_at FROM warehouses WHERE code = ?`;
    const params = [code];

    if (excludeId !== null && excludeId !== undefined) {
        sql += ` AND id != ?`;
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
};

/**
 * Check count of locations associated with a warehouse
 */
const getWarehouseLocationCount = async (warehouseId) => {
    const [rows] = await pool.query(`
        SELECT COUNT(*) AS location_count
        FROM locations
        WHERE warehouse_id = ?
    `, [warehouseId]);

    return Number(rows[0]?.location_count || 0);
};

/**
 * Update an existing warehouse
 */
const updateWarehouse = async (id, { name, code, address }) => {
    const [result] = await pool.query(`
        UPDATE warehouses
        SET
            name = ?,
            code = ?,
            address = ?
        WHERE id = ?
    `, [name, code, address ?? null, id]);

    return result.affectedRows;
};

/**
 * Delete a warehouse by ID
 */
const deleteWarehouse = async (id) => {
    const [result] = await pool.query(`
        DELETE FROM warehouses
        WHERE id = ?
    `, [id]);

    return result.affectedRows;
};

module.exports = {
    createWarehouse,
    getAllWarehouses,
    getWarehouseById,
    getWarehouseByCode,
    getWarehouseLocationCount,
    updateWarehouse,
    deleteWarehouse
};
