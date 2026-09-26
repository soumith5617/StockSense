const pool = require("../config/database");
const transferModel = require("../models/transferModel");
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
 * Validate transfer input payload
 */
async function validateTransferData(data, excludeTransferId = null) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { transfer_number, source_location_id, destination_location_id, status, items } = data;

    // 1. Validate source_location_id (required)
    if (source_location_id === undefined || source_location_id === null || source_location_id === "") {
        const error = new Error("Source location ID is required");
        error.status = 400;
        throw error;
    }

    const parsedSourceLocationId = validateId(source_location_id, "source location ID");
    const sourceLocation = await locationModel.getLocationById(parsedSourceLocationId);
    if (!sourceLocation) {
        const error = new Error(`Source location with ID ${parsedSourceLocationId} does not exist`);
        error.status = 400;
        throw error;
    }

    // 2. Validate destination_location_id (required)
    if (destination_location_id === undefined || destination_location_id === null || destination_location_id === "") {
        const error = new Error("Destination location ID is required");
        error.status = 400;
        throw error;
    }

    const parsedDestinationLocationId = validateId(destination_location_id, "destination location ID");
    const destinationLocation = await locationModel.getLocationById(parsedDestinationLocationId);
    if (!destinationLocation) {
        const error = new Error(`Destination location with ID ${parsedDestinationLocationId} does not exist`);
        error.status = 400;
        throw error;
    }

    // 3. Ensure source and destination are different
    if (parsedSourceLocationId === parsedDestinationLocationId) {
        const error = new Error("Source location and destination location must be different");
        error.status = 400;
        throw error;
    }

    // 4. Validate transfer_number (optional, unique if provided)
    let finalTransferNumber;
    if (transfer_number !== undefined && transfer_number !== null && String(transfer_number).trim() !== "") {
        finalTransferNumber = String(transfer_number).trim();
        const existingTransfer = await transferModel.getTransferByNumber(finalTransferNumber, excludeTransferId);
        if (existingTransfer) {
            const error = new Error(`Transfer with number '${finalTransferNumber}' already exists`);
            error.status = 409;
            throw error;
        }
    } else {
        finalTransferNumber = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 5. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("Transfer must contain at least one item");
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

        const { product_id, quantity } = item;

        if (product_id === undefined || product_id === null || product_id === "") {
            const error = new Error(`Product ID is required for item at index ${index}`);
            error.status = 400;
            throw error;
        }

        const parsedProductId = validateId(product_id, `product ID for item ${index + 1}`);

        if (seenProductIds.has(parsedProductId)) {
            const error = new Error(`Duplicate product ID ${parsedProductId} in transfer items`);
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

        const numQuantity = Number(quantity);
        if (quantity === undefined || quantity === null || isNaN(numQuantity) || numQuantity <= 0) {
            const error = new Error(`Quantity for product '${product.name}' must be a positive number greater than zero`);
            error.status = 400;
            throw error;
        }

        validatedItems.push({
            product_id: parsedProductId,
            quantity: numQuantity
        });
    }

    // 6. Validate status (defaults to draft)
    const validStatuses = ["draft", "waiting", "ready"];
    let finalStatus = "draft";
    if (status !== undefined && status !== null) {
        if (!validStatuses.includes(status)) {
            const error = new Error(`Invalid status '${status}'. Allowed statuses during creation/edit: ${validStatuses.join(", ")}`);
            error.status = 400;
            throw error;
        }
        finalStatus = status;
    }

    return {
        transfer_number: finalTransferNumber,
        source_location_id: parsedSourceLocationId,
        destination_location_id: parsedDestinationLocationId,
        status: finalStatus,
        items: validatedItems
    };
}

/**
 * Create a new transfer
 */
const createTransfer = async (data, authenticatedUserId) => {
    const validatedData = await validateTransferData(data);

    const transferId = await transferModel.createTransfer({
        transfer_number: validatedData.transfer_number,
        source_location_id: validatedData.source_location_id,
        destination_location_id: validatedData.destination_location_id,
        status: validatedData.status,
        created_by: authenticatedUserId || null
    }, validatedData.items);

    return {
        id: transferId,
        transfer_number: validatedData.transfer_number,
        source_location_id: validatedData.source_location_id,
        destination_location_id: validatedData.destination_location_id,
        status: validatedData.status,
        created_by: authenticatedUserId || null,
        items: validatedData.items
    };
};

/**
 * Fetch all transfers
 */
const getTransfers = async () => {
    return await transferModel.getAllTransfers();
};

/**
 * Fetch a single transfer with its line items
 */
const getTransfer = async (id) => {
    const parsedId = validateId(id, "transfer ID");

    const transfer = await transferModel.getTransferById(parsedId);
    if (!transfer) {
        const error = new Error(`Transfer with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    const items = await transferModel.getTransferItems(parsedId);
    return {
        ...transfer,
        items
    };
};

/**
 * Update an existing transfer (only before completion or cancellation)
 */
const updateTransfer = async (id, data) => {
    const parsedId = validateId(id, "transfer ID");

    const existingTransfer = await transferModel.getTransferById(parsedId);
    if (!existingTransfer) {
        const error = new Error(`Transfer with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    if (existingTransfer.status === "done" || existingTransfer.status === "canceled") {
        const error = new Error(`Cannot modify a transfer that is already completed or canceled`);
        error.status = 400;
        throw error;
    }

    const validatedData = await validateTransferData(data, parsedId);

    await transferModel.updateTransfer(parsedId, {
        source_location_id: validatedData.source_location_id,
        destination_location_id: validatedData.destination_location_id,
        status: validatedData.status
    });

    await transferModel.updateTransferItems(parsedId, validatedData.items);

    return await getTransfer(parsedId);
};

/**
 * Cancel a transfer before completion
 */
const cancelTransfer = async (id) => {
    const parsedId = validateId(id, "transfer ID");

    const existingTransfer = await transferModel.getTransferById(parsedId);
    if (!existingTransfer) {
        const error = new Error(`Transfer with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    if (existingTransfer.status === "done") {
        const error = new Error("Cannot cancel a transfer that is already completed");
        error.status = 409;
        throw error;
    }

    if (existingTransfer.status === "canceled") {
        const error = new Error("Transfer is already canceled");
        error.status = 409;
        throw error;
    }

    await transferModel.updateTransferStatus(parsedId, "canceled");

    return {
        success: true,
        message: "Transfer canceled successfully",
        data: {
            id: parsedId,
            status: "canceled"
        }
    };
};

/**
 * Validate transfer, check sufficient stock, transfer stock atomically, log two ledger entries per item, mark as done
 */
const validateTransfer = async (id, authenticatedUserId, simulateFailure = false) => {
    const parsedId = validateId(id, "transfer ID");

    // 1. Fetch transfer header
    const transfer = await transferModel.getTransferById(parsedId);
    if (!transfer) {
        const error = new Error(`Transfer with ID ${parsedId} not found`);
        error.status = 404;
        throw error;
    }

    // 2. Validate transfer status
    if (transfer.status === "done") {
        const error = new Error("Transfer is already completed and cannot be validated again");
        error.status = 409;
        throw error;
    }

    if (transfer.status === "canceled") {
        const error = new Error("Cannot validate a canceled transfer");
        error.status = 409;
        throw error;
    }

    // 3. Fetch items
    const items = await transferModel.getTransferItems(parsedId);
    if (!items || items.length === 0) {
        const error = new Error("Transfer contains no items to validate");
        error.status = 400;
        throw error;
    }

    // 4. Verify source and destination locations still exist
    const sourceLoc = await locationModel.getLocationById(transfer.source_location_id);
    if (!sourceLoc) {
        const error = new Error(`Source location with ID ${transfer.source_location_id} no longer exists`);
        error.status = 400;
        throw error;
    }

    const destLoc = await locationModel.getLocationById(transfer.destination_location_id);
    if (!destLoc) {
        const error = new Error(`Destination location with ID ${transfer.destination_location_id} no longer exists`);
        error.status = 400;
        throw error;
    }

    if (transfer.source_location_id === transfer.destination_location_id) {
        const error = new Error("Source location and destination location must be different");
        error.status = 400;
        throw error;
    }

    // 5. Pre-verify products and positive quantities
    for (const item of items) {
        const product = await productModel.getProductById(item.product_id);
        if (!product) {
            const error = new Error(`Product with ID ${item.product_id} no longer exists`);
            error.status = 400;
            throw error;
        }

        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0) {
            const error = new Error(`Invalid quantity ${item.quantity} for product ID ${item.product_id}`);
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

        // Check and lock ALL source stock rows first before modifying anything
        const sourceStockMap = new Map();
        for (const item of sortedItems) {
            const requestedQty = Number(item.quantity);

            // Lock source stock record
            const sourceStock = await transferModel.getStockForUpdate(
                item.product_id,
                transfer.source_location_id,
                connection
            );

            if (!sourceStock) {
                const error = new Error(
                    `Insufficient stock: no stock available for product ID ${item.product_id} at source location ID ${transfer.source_location_id}`
                );
                error.status = 409;
                throw error;
            }

            const currentSourceQty = Number(sourceStock.quantity);
            if (currentSourceQty < requestedQty) {
                const error = new Error(
                    `Insufficient stock for product ID ${item.product_id} at source location: available ${currentSourceQty}, requested ${requestedQty}`
                );
                error.status = 409;
                throw error;
            }

            sourceStockMap.set(item.product_id, {
                row: sourceStock,
                currentQty: currentSourceQty,
                requestedQty
            });
        }

        // Process stock transfer and ledger records for all items
        for (const item of sortedItems) {
            const { row: sourceStock, currentQty: currentSourceQty, requestedQty } = sourceStockMap.get(item.product_id);

            // 1. Deduct source stock
            const newSourceBalance = Number((currentSourceQty - requestedQty).toFixed(2));
            await transferModel.updateStockQuantity(sourceStock.id, newSourceBalance, connection);

            // 2. Lock destination stock
            const destStock = await transferModel.getStockForUpdate(
                item.product_id,
                transfer.destination_location_id,
                connection
            );

            let newDestBalance = 0;
            if (destStock) {
                const currentDestQty = Number(destStock.quantity);
                newDestBalance = Number((currentDestQty + requestedQty).toFixed(2));
                await transferModel.updateStockQuantity(destStock.id, newDestBalance, connection);
            } else {
                newDestBalance = Number(requestedQty.toFixed(2));
                await transferModel.insertStock(
                    item.product_id,
                    transfer.destination_location_id,
                    newDestBalance,
                    connection
                );
            }

            // 3. Create SOURCE ledger entry (transfer_out, negative quantity)
            await transferModel.insertStockLedger({
                product_id: item.product_id,
                location_id: transfer.source_location_id,
                movement_type: "transfer_out",
                reference_id: transfer.id,
                quantity_change: -requestedQty,
                balance_after: newSourceBalance,
                created_by: authenticatedUserId || transfer.created_by || null
            }, connection);

            // 4. Create DESTINATION ledger entry (transfer_in, positive quantity)
            await transferModel.insertStockLedger({
                product_id: item.product_id,
                location_id: transfer.destination_location_id,
                movement_type: "transfer_in",
                reference_id: transfer.id,
                quantity_change: requestedQty,
                balance_after: newDestBalance,
                created_by: authenticatedUserId || transfer.created_by || null
            }, connection);
        }

        // Mark transfer as 'done'
        await transferModel.updateTransferStatus(transfer.id, "done", connection);

        // Simulated failure for transaction rollback verification
        if (process.env.NODE_ENV === "test" && simulateFailure) {
            throw new Error("Simulated database failure during transfer transaction");
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return await getTransfer(parsedId);
};

module.exports = {
    createTransfer,
    getTransfers,
    getTransfer,
    updateTransfer,
    cancelTransfer,
    validateTransfer
};
