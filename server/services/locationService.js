const locationModel = require("../models/locationModel");
const warehouseModel = require("../models/warehouseModel");

/**
 * Validate numeric ID
 */
function validateId(id, fieldName = "location ID") {
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error(`Invalid ${fieldName}: must be a positive integer`);
        error.status = 400;
        throw error;
    }
    return parsedId;
}

/**
 * Validate location payload data
 */
async function validateLocationData(data) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { warehouse_id, name, code } = data;

    // Validate warehouse_id
    if (warehouse_id === undefined || warehouse_id === null || warehouse_id === "") {
        const error = new Error("Warehouse ID is required");
        error.status = 400;
        throw error;
    }

    const parsedWarehouseId = validateId(warehouse_id, "warehouse ID");

    // Verify warehouse exists
    const warehouse = await warehouseModel.getWarehouseById(parsedWarehouseId);
    if (!warehouse) {
        const error = new Error(`Warehouse with ID ${parsedWarehouseId} does not exist`);
        error.status = 400;
        throw error;
    }

    // Validate location name
    if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
        const error = new Error("Location name is required");
        error.status = 400;
        throw error;
    }

    // Validate location code
    if (code === undefined || code === null || typeof code !== "string" || !code.trim()) {
        const error = new Error("Location code is required");
        error.status = 400;
        throw error;
    }

    return {
        warehouse_id: parsedWarehouseId,
        name: name.trim(),
        code: code.trim()
    };
}

/**
 * Create a new location
 */
const createLocation = async (data) => {
    const validated = await validateLocationData(data);

    // Enforce uniqueness of code within the specific warehouse
    const existingLocation = await locationModel.getLocationByWarehouseAndCode(
        validated.warehouse_id,
        validated.code
    );

    if (existingLocation) {
        const error = new Error(
            `Location with code '${validated.code}' already exists in this warehouse`
        );
        error.status = 409;
        throw error;
    }

    const locationId = await locationModel.createLocation(validated);
    return await locationModel.getLocationById(locationId);
};

/**
 * Fetch all locations with warehouse details
 */
const getLocations = async () => {
    return await locationModel.getAllLocations();
};

/**
 * Fetch single location by ID
 */
const getLocation = async (id) => {
    const parsedId = validateId(id);
    const location = await locationModel.getLocationById(parsedId);
    if (!location) {
        const error = new Error("Location not found");
        error.status = 404;
        throw error;
    }
    return location;
};

/**
 * Update an existing location
 */
const updateLocation = async (id, data) => {
    const parsedId = validateId(id);

    const existingLocation = await locationModel.getLocationById(parsedId);
    if (!existingLocation) {
        const error = new Error("Location not found");
        error.status = 404;
        throw error;
    }

    const validated = await validateLocationData(data);

    // Enforce uniqueness of code within warehouse excluding current location
    const duplicateLocation = await locationModel.getLocationByWarehouseAndCode(
        validated.warehouse_id,
        validated.code,
        parsedId
    );

    if (duplicateLocation) {
        const error = new Error(
            `Location with code '${validated.code}' already exists in this warehouse`
        );
        error.status = 409;
        throw error;
    }

    await locationModel.updateLocation(parsedId, validated);
    return await locationModel.getLocationById(parsedId);
};

/**
 * Safely delete a location after verifying no inventory or transaction references exist
 */
const deleteLocation = async (id) => {
    const parsedId = validateId(id);

    const existingLocation = await locationModel.getLocationById(parsedId);
    if (!existingLocation) {
        const error = new Error("Location not found");
        error.status = 404;
        throw error;
    }

    // Check references across stock, receipts, deliveries, transfers, adjustments, stock_ledger
    const { isReferenced, references } = await locationModel.checkLocationReferences(parsedId);
    if (isReferenced) {
        const reasons = [];
        if (references.stockCount > 0 || references.totalStockQty > 0) {
            reasons.push(`inventory stock (${references.totalStockQty} units across ${references.stockCount} record(s))`);
        }
        if (references.receiptCount > 0) {
            reasons.push(`${references.receiptCount} receipt record(s)`);
        }
        if (references.deliveryCount > 0) {
            reasons.push(`${references.deliveryCount} delivery record(s)`);
        }
        if (references.transferCount > 0) {
            reasons.push(`${references.transferCount} transfer record(s)`);
        }
        if (references.adjustmentCount > 0) {
            reasons.push(`${references.adjustmentCount} adjustment record(s)`);
        }
        if (references.ledgerCount > 0) {
            reasons.push(`${references.ledgerCount} stock ledger entry(ies)`);
        }

        const detail = reasons.length > 0 ? `: referenced by ${reasons.join(", ")}` : "";
        const error = new Error(
            `Cannot delete location${detail}. Deletion blocked to protect inventory and audit history.`
        );
        error.status = 409;
        throw error;
    }

    await locationModel.deleteLocation(parsedId);
    return {
        success: true,
        message: "Location deleted successfully"
    };
};

module.exports = {
    createLocation,
    getLocations,
    getLocation,
    updateLocation,
    deleteLocation
};
