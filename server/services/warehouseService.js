const warehouseModel = require("../models/warehouseModel");

/**
 * Validate numeric ID
 */
function validateId(id) {
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error("Invalid warehouse ID: must be a positive integer");
        error.status = 400;
        throw error;
    }
    return parsedId;
}

/**
 * Validate warehouse input payload
 */
function validateWarehouseData(data) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { name, code, address } = data;

    if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
        const error = new Error("Warehouse name is required");
        error.status = 400;
        throw error;
    }

    if (code === undefined || code === null || typeof code !== "string" || !code.trim()) {
        const error = new Error("Warehouse code is required");
        error.status = 400;
        throw error;
    }

    return {
        name: name.trim(),
        code: code.trim(),
        address: address !== undefined && address !== null && typeof address === "string" && address.trim() !== ""
            ? address.trim()
            : null
    };
}

/**
 * Create a new warehouse
 */
const createWarehouse = async (data) => {
    const validated = validateWarehouseData(data);

    // Uniqueness validation for warehouse code
    const existingCode = await warehouseModel.getWarehouseByCode(validated.code);
    if (existingCode) {
        const error = new Error(`Warehouse with code '${validated.code}' already exists`);
        error.status = 409;
        throw error;
    }

    const warehouseId = await warehouseModel.createWarehouse(validated);
    return await warehouseModel.getWarehouseById(warehouseId);
};

/**
 * Fetch all warehouses
 */
const getWarehouses = async () => {
    return await warehouseModel.getAllWarehouses();
};

/**
 * Fetch a single warehouse by ID
 */
const getWarehouse = async (id) => {
    const parsedId = validateId(id);
    const warehouse = await warehouseModel.getWarehouseById(parsedId);
    if (!warehouse) {
        const error = new Error("Warehouse not found");
        error.status = 404;
        throw error;
    }
    return warehouse;
};

/**
 * Update an existing warehouse
 */
const updateWarehouse = async (id, data) => {
    const parsedId = validateId(id);

    const existingWarehouse = await warehouseModel.getWarehouseById(parsedId);
    if (!existingWarehouse) {
        const error = new Error("Warehouse not found");
        error.status = 404;
        throw error;
    }

    const validated = validateWarehouseData(data);

    // Uniqueness check excluding current warehouse
    const duplicateCode = await warehouseModel.getWarehouseByCode(validated.code, parsedId);
    if (duplicateCode) {
        const error = new Error(`Warehouse with code '${validated.code}' already exists`);
        error.status = 409;
        throw error;
    }

    await warehouseModel.updateWarehouse(parsedId, validated);
    return await warehouseModel.getWarehouseById(parsedId);
};

/**
 * Safely delete a warehouse after verifying no locations are attached
 */
const deleteWarehouse = async (id) => {
    const parsedId = validateId(id);

    const existingWarehouse = await warehouseModel.getWarehouseById(parsedId);
    if (!existingWarehouse) {
        const error = new Error("Warehouse not found");
        error.status = 404;
        throw error;
    }

    // Check for locations belonging to this warehouse
    const locationCount = await warehouseModel.getWarehouseLocationCount(parsedId);
    if (locationCount > 0) {
        const error = new Error(
            `Cannot delete warehouse: it has ${locationCount} associated location(s). Delete or reassign locations first.`
        );
        error.status = 409;
        throw error;
    }

    await warehouseModel.deleteWarehouse(parsedId);
    return {
        success: true,
        message: "Warehouse deleted successfully"
    };
};

module.exports = {
    createWarehouse,
    getWarehouses,
    getWarehouse,
    updateWarehouse,
    deleteWarehouse
};
