const pool = require("../config/database");

/**
 * Insert a new user record
 */
const createUser = async ({ name, email, password, role = "staff" }) => {
    const [result] = await pool.query(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    `, [name, email, password, role]);

    return result.insertId;
};

/**
 * Find user by email (includes password hash for authentication)
 */
const findUserByEmail = async (email) => {
    const [rows] = await pool.query(`
        SELECT id, name, email, password, role, created_at
        FROM users
        WHERE email = ?
    `, [email]);

    return rows[0] || null;
};

/**
 * Find user by ID (excludes password hash for safety)
 */
const findUserById = async (id) => {
    const [rows] = await pool.query(`
        SELECT id, name, email, role, created_at
        FROM users
        WHERE id = ?
    `, [id]);

    return rows[0] || null;
};

/**
 * Update user password
 */
const updateUserPassword = async (id, hashedPassword) => {
    const [result] = await pool.query(`
        UPDATE users
        SET password = ?
        WHERE id = ?
    `, [hashedPassword, id]);

    return result.affectedRows;
};

/**
 * Delete user by ID (useful for tests and cleanup)
 */
const deleteUserById = async (id) => {
    const [result] = await pool.query(`
        DELETE FROM users
        WHERE id = ?
    `, [id]);

    return result.affectedRows;
};

module.exports = {
    createUser,
    findUserByEmail,
    findUserById,
    updateUserPassword,
    deleteUserById
};
