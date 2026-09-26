const pool = require("../config/database");
const adjustmentModel = require("../models/adjustmentModel");
const locationModel = require("../models/locationModel");
const productModel = require("../models/productModel");

/**
 * Validate numeric ID
 */
function validateId(id, fieldName = "ID") {
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error(`Invalid ${fieldName}: must be a positive integer`);
        error.status = 400;
        throw error;
    }
    return parsedId;
}

/**
 * Validate adjustment input payload and compute initial system quantities and differences
 */
async function validateAdjustmentData(data, excludeAdjustmentId = null) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { adjustment_number, location_id, reason, status, items } = data;

    // 1. Validate location_id (required)
    if (location_id === undefined || location_id === null || location_id === "") {
        const error = new Error("Location ID is required");
        error.status = 400;
        throw error;
    }

    const parsedLocationId = validateId(location_id, "location ID");
    const location = await locationModel.getLocationById(parsedLocationId);
    if (!location) {
        const error = new Error(`Location with ID ${parsedLocationId} does not exist`);
        error.status = 400;
        throw error;
    }

    // 2. Validate reason (optional)
    const parsedReason = reason !== undefined && reason !== null && String(reason).trim() !== ""
        ? String(reason).trim()
        : null;

    // 3. Validate adjustment_number (optional, unique if provided)
    let finalAdjustmentNumber;
    if (adjustment_number !== undefined && adjustment_number !== null && String(adjustment_number).trim() !== "") {
        finalAdjustmentNumber = String(adjustment_number).trim();
        const existingAdjustment = await adjustmentModel.getAdjustmentByNumber(finalAdjustmentNumber, excludeAdjustmentId);
        if (existingAdjustment) {
            const error = new Error(`Adjustment with number '${finalAdjustmentNumber}' already exists`);
            error.status = 409;
            throw error;
        }
    } else {
        finalAdjustmentNumber = `ADJ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("Adjustment must contain at least one item");
        error.status = 400;
        throw error;
    }

    const validatedItems = [];
    const seenProductIds = new Set();

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!item || typeof item !== "object") {
            const error = new Error(`Invalid item at index ${index}`);
            error.status = 400;
            throw error;
        }

        const { product_id, counted_quantity } = item;

        if (product_id === undefined || product_id === null || product_id === "") {
            const error = new Error(`Product ID is required for item at index ${index}`);
            error.status = 400;
            throw error;
        }

        const parsedProductId = validateId(product_id, `product ID for item ${index + 1}`);

        if (seenProductIds.has(parsedProductId)) {
            const error = new Error(`Duplicate product ID ${parsedProductId} in adjustment items`);
            error.status = 400;
            throw error;
        }
        seenProductIds.add(parsedProductId);

        const product = await productModel.getProductById(parsedProductId);
        if (!product) {
            const error = new Error(`Product with ID ${parsedProductId} does not exist`);
            error.status = 400;
            throw error;
        }

        const numCounted = Number(counted_quantity);
        if (counted_quantity === undefined || counted_quantity === null || isNaN(numCounted) || numCounted < 0) {
            const error = new Error(`Counted quantity for product '${product.name}' must be a non-negative number (0 or greater)`);
            error.status = 400;
            throw error;
        }

        // Capture CURRENT system quantity for this product at this location
        const stockRow = await adjustmentModel.getStockQuantity(parsedProductId, parsedLocationId);
        const systemQuantity = stockRow ? Number(stockRow.quantity) : 0;
        const difference = Number((numCounted - systemQuantity).toFixed(2));

        validatedItems.push({
            product_id: parsedProductId,
            system_quantity: systemQuantity,
            counted_quantity: numCounted,
            difference
        });
    }

    // 5. Validate status (defaults to draft)
    const validStatuses = ["draft"];
    let finalStatus = "draft";
    if (status !== undefined && status !== null) {
        if (!validStatuses.includes(status)) {
            const error = new Error(`Invalid status '${status}'. Allowed status during creation/edit: draft`);
            error.status = 400;
            throw error;
        }
        finalStatus = status;
    }

    return {
        adjustment_number: finalAdjustmentNumber,
        location_id: parsedLocationId,
        reason: parsedReason,
        status: finalStatus,
        items: validatedItems
    };
}

/**
 * Create a new adjustment draft
 */
const createAdjustment = async (data, authenticatedUserId) => {
    const validatedData = await validateAdjustmentData(data);

    const adjustmentId = await adjustmentModel.createAdjustment({
        adjustment_number: validatedData.adjustment_number,
        location_id: validatedData.location_id,
        reason: validatedData.reason,
        status: validatedData.status,
        created_by: authenticatedUserId || null
    }, validatedData.items);

    return {
        id: adjustmentId,
        adjustment_number: validatedData.adjustment_number,
        location_id: validatedData.location_id,
        reason: validatedData.reason,
        status: validatedData.status,
        created_by: authenticatedUserId || null,
        items: validatedData.items
    };
};

/**
 * Fetch all adjustments
 */
const getAdjustments = async () => {
    return await adjustmentModel.getAllAdjustments();
};

/**
 * Fetch a single adjustment with its line items
 */
const getAdjustment = async (id) => {
    const parsedId = validateId(id, "adjustment ID");

    const adjustment = await adjustmentModel.getAdjustmentById(parsedId);
    if (!adjustment) {
        const error = new Error(`Adjustment with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    const items = await adjustmentModel.getAdjustmentItems(parsedId);
    return {
        ...adjustment,
        items
    };
};

/**
 * Update an existing draft adjustment (only while status = draft)
 */
const updateAdjustment = async (id, data) => {
    const parsedId = validateId(id, "adjustment ID");

    const existingAdjustment = await adjustmentModel.getAdjustmentById(parsedId);
    if (!existingAdjustment) {
        const error = new Error(`Adjustment with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    if (existingAdjustment.status !== "draft") {
        const error = new Error(`Cannot modify an adjustment that is already completed or canceled`);
        error.status = 400;
        throw error;
    }

    const validatedData = await validateAdjustmentData(data, parsedId);

    await adjustmentModel.updateAdjustment(parsedId, {
        location_id: validatedData.location_id,
        reason: validatedData.reason,
        status: validatedData.status
    });

    await adjustmentModel.updateAdjustmentItems(parsedId, validatedData.items);

    return await getAdjustment(parsedId);
};

/**
 * Cancel a draft adjustment
 */
const cancelAdjustment = async (id) => {
    const parsedId = validateId(id, "adjustment ID");

    const existingAdjustment = await adjustmentModel.getAdjustmentById(parsedId);
    if (!existingAdjustment) {
        const error = new Error(`Adjustment with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    if (existingAdjustment.status === "done") {
        const error = new Error("Cannot cancel an adjustment that is already completed");
        error.status = 409;
        throw error;
    }

    if (existingAdjustment.status === "canceled") {
        const error = new Error("Adjustment is already canceled");
        error.status = 409;
        throw error;
    }

    await adjustmentModel.updateAdjustmentStatus(parsedId, "canceled");

    return {
        success: true,
        message: "Adjustment canceled successfully",
        data: {
            id: parsedId,
            status: "canceled"
        }
    };
};

/**
 * Validate adjustment, lock authoritative stock, update stock, log ledger, mark as done
 */
const validateAdjustment = async (id, authenticatedUserId, simulateFailure = false) => {
    const parsedId = validateId(id, "adjustment ID");

    // 1. Fetch adjustment header
    const adjustment = await adjustmentModel.getAdjustmentById(parsedId);
    if (!adjustment) {
        const error = new Error(`Adjustment with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    // 2. Validate adjustment status
    if (adjustment.status === "done") {
        const error = new Error("Adjustment is already completed and cannot be validated again");
        error.status = 409;
        throw error;
    }

    if (adjustment.status === "canceled") {
        const error = new Error("Cannot validate a canceled adjustment");
        error.status = 409;
        throw error;
    }

    // 3. Fetch items
    const items = await adjustmentModel.getAdjustmentItems(parsedId);
    if (!items || items.length === 0) {
        const error = new Error("Adjustment contains no items to validate");
        error.status = 400;
        throw error;
    }

    // 4. Verify location still exists
    const location = await locationModel.getLocationById(adjustment.location_id);
    if (!location) {
        const error = new Error(`Location with ID ${adjustment.location_id} no longer exists`);
        error.status = 400;
        throw error;
    }

    // 5. Pre-verify products and non-negative counted quantities
    for (const item of items) {
        const product = await productModel.getProductById(item.product_id);
        if (!product) {
            const error = new Error(`Product with ID ${item.product_id} no longer exists`);
            error.status = 400;
            throw error;
        }

        const countedQty = Number(item.counted_quantity);
        if (isNaN(countedQty) || countedQty < 0) {
            const error = new Error(`Invalid counted quantity for product ID ${item.product_id}`);
            error.status = 400;
            throw error;
        }
    }

    // Sort items by product_id ASC for deterministic lock acquisition
    const sortedItems = [...items].sort((a, b) => a.product_id - b.product_id);

    // 6. Transaction execution
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of sortedItems) {
            const countedQty = Number(item.counted_quantity);

            // Lock and read current authoritative stock row
            const stockRow = await adjustmentModel.getStockForUpdate(
                item.product_id,
                adjustment.location_id,
                connection
            );

            const currentLockedStock = stockRow ? Number(stockRow.quantity) : 0;
            const actualDifference = Number((countedQty - currentLockedStock).toFixed(2));

            // Update stored adjustment item with authoritative system_quantity and difference
            await adjustmentModel.updateAdjustmentItemValues(
                item.id,
                currentLockedStock,
                actualDifference,
                connection
            );

            // Update physical stock
            if (stockRow) {
                await adjustmentModel.updateStockQuantity(stockRow.id, countedQty, connection);
            } else if (countedQty > 0) {
                await adjustmentModel.insertStock(
                    item.product_id,
                    adjustment.location_id,
                    countedQty,
                    connection
                );
            }

            // Create stock ledger entry ONLY if difference != 0
            if (actualDifference !== 0) {
                await adjustmentModel.insertStockLedger({
                    product_id: item.product_id,
                    location_id: adjustment.location_id,
                    movement_type: "adjustment",
                    reference_id: adjustment.id,
                    quantity_change: actualDifference,
                    balance_after: countedQty,
                    created_by: authenticatedUserId || adjustment.created_by || null
                }, connection);
            }
        }

        // Mark adjustment as 'done'
        await adjustmentModel.updateAdjustmentStatus(adjustment.id, "done", connection);

        // Simulated failure for transaction rollback verification
        if (process.env.NODE_ENV === "test" && simulateFailure) {
            throw new Error("Simulated database failure during adjustment transaction");
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return await getAdjustment(parsedId);
};

module.exports = {
    createAdjustment,
    getAdjustments,
    getAdjustment,
    updateAdjustment,
    cancelAdjustment,
    validateAdjustment
};
