const pool = require("../config/database");
const receiptModel = require("../models/receiptModel");
const locationModel = require("../models/locationModel");
const supplierModel = require("../models/supplierModel");
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
 * Validate receipt payload data
 */
async function validateReceiptData(data, excludeReceiptId = null) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { receipt_number, supplier_id, location_id, status, items } = data;

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

    // 2. Validate supplier_id (optional, but must exist if provided)
    let parsedSupplierId = null;
    if (supplier_id !== undefined && supplier_id !== null && supplier_id !== "") {
        parsedSupplierId = validateId(supplier_id, "supplier ID");
        const supplier = await supplierModel.getSupplierById(parsedSupplierId);
        if (!supplier) {
            const error = new Error(`Supplier with ID ${parsedSupplierId} does not exist`);
            error.status = 400;
            throw error;
        }
    }

    // 3. Validate receipt_number
    let finalReceiptNumber;
    if (receipt_number !== undefined && receipt_number !== null && String(receipt_number).trim() !== "") {
        finalReceiptNumber = String(receipt_number).trim();
        const existingReceipt = await receiptModel.getReceiptByNumber(finalReceiptNumber, excludeReceiptId);
        if (existingReceipt) {
            const error = new Error(`Receipt with number '${finalReceiptNumber}' already exists`);
            error.status = 409;
            throw error;
        }
    } else {
        finalReceiptNumber = `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("Receipt must contain at least one item");
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
            const error = new Error(`Duplicate product ID ${parsedProductId} in receipt items`);
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

    // 5. Validate status (defaults to draft)
    const validInitialStatuses = ["draft", "waiting", "ready"];
    let finalStatus = "draft";
    if (status !== undefined && status !== null && String(status).trim() !== "") {
        const trimmedStatus = String(status).trim().toLowerCase();
        if (!validInitialStatuses.includes(trimmedStatus)) {
            const error = new Error(`Invalid initial receipt status: ${status}. Must be one of: ${validInitialStatuses.join(", ")}`);
            error.status = 400;
            throw error;
        }
        finalStatus = trimmedStatus;
    }

    return {
        receipt_number: finalReceiptNumber,
        supplier_id: parsedSupplierId,
        location_id: parsedLocationId,
        status: finalStatus,
        items: validatedItems
    };
}

/**
 * Create a new incoming stock receipt
 */
const createReceipt = async (data, authenticatedUserId = null) => {
    const validated = await validateReceiptData(data);

    const receiptId = await receiptModel.createReceipt({
        receipt_number: validated.receipt_number,
        supplier_id: validated.supplier_id,
        location_id: validated.location_id,
        status: validated.status,
        created_by: authenticatedUserId
    }, validated.items);

    return await getReceipt(receiptId);
};

/**
 * Fetch all receipts
 */
const getReceipts = async () => {
    return await receiptModel.getAllReceipts();
};

/**
 * Fetch single receipt by ID including items
 */
const getReceipt = async (id) => {
    const parsedId = validateId(id, "receipt ID");

    const receipt = await receiptModel.getReceiptById(parsedId);
    if (!receipt) {
        const error = new Error("Receipt not found");
        error.status = 404;
        throw error;
    }

    const items = await receiptModel.getReceiptItems(parsedId);
    receipt.items = items;

    return receipt;
};

/**
 * Update an existing receipt
 */
const updateReceipt = async (id, data) => {
    const parsedId = validateId(id, "receipt ID");

    const existingReceipt = await receiptModel.getReceiptById(parsedId);
    if (!existingReceipt) {
        const error = new Error("Receipt not found");
        error.status = 404;
        throw error;
    }

    if (existingReceipt.status === "done") {
        const error = new Error("Cannot modify a receipt that has already been validated and marked as done");
        error.status = 400;
        throw error;
    }

    if (existingReceipt.status === "canceled") {
        const error = new Error("Cannot modify a canceled receipt");
        error.status = 400;
        throw error;
    }

    const validated = await validateReceiptData(data, parsedId);

    await receiptModel.updateReceipt(parsedId, {
        supplier_id: validated.supplier_id,
        location_id: validated.location_id,
        status: validated.status
    });

    await receiptModel.updateReceiptItems(parsedId, validated.items);

    return await getReceipt(parsedId);
};

/**
 * Cancel a receipt
 */
const cancelReceipt = async (id) => {
    const parsedId = validateId(id, "receipt ID");

    const receipt = await receiptModel.getReceiptById(parsedId);
    if (!receipt) {
        const error = new Error("Receipt not found");
        error.status = 404;
        throw error;
    }

    if (receipt.status === "done") {
        const error = new Error("Cannot cancel a receipt that has already been completed and validated");
        error.status = 400;
        throw error;
    }

    if (receipt.status === "canceled") {
        const error = new Error("Receipt is already canceled");
        error.status = 400;
        throw error;
    }

    await receiptModel.updateReceiptStatus(parsedId, "canceled");

    return {
        success: true,
        message: "Receipt canceled successfully"
    };
};

/**
 * Validate incoming receipt and update inventory stock + ledger in an atomic transaction
 */
const validateReceipt = async (id, authenticatedUserId = null, simulateFailure = false) => {
    const parsedId = validateId(id, "receipt ID");

    // 1. Verify receipt exists
    const receipt = await receiptModel.getReceiptById(parsedId);
    if (!receipt) {
        const error = new Error("Receipt not found");
        error.status = 404;
        throw error;
    }

    // 2. Verify receipt status is not done
    if (receipt.status === "done") {
        const error = new Error("Receipt has already been validated and completed");
        error.status = 409;
        throw error;
    }

    // 3. Verify receipt status is not canceled
    if (receipt.status === "canceled") {
        const error = new Error("Canceled receipts cannot be validated");
        error.status = 409;
        throw error;
    }

    // 4. Fetch and verify items
    const items = await receiptModel.getReceiptItems(parsedId);
    if (!items || items.length === 0) {
        const error = new Error("Receipt contains no items to validate");
        error.status = 400;
        throw error;
    }

    // 5. Verify location still exists
    const location = await locationModel.getLocationById(receipt.location_id);
    if (!location) {
        const error = new Error(`Location with ID ${receipt.location_id} no longer exists`);
        error.status = 400;
        throw error;
    }

    // 6. Verify products and quantities
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

    // 7. Atomic transaction execution
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of items) {
            const receivedQty = Number(item.quantity);

            // Lock and read existing stock record for (product_id, location_id)
            const existingStock = await receiptModel.getStockForUpdate(
                item.product_id,
                receipt.location_id,
                connection
            );

            let balanceAfter = 0;

            if (existingStock) {
                const currentQty = Number(existingStock.quantity);
                balanceAfter = Number((currentQty + receivedQty).toFixed(2));
                await receiptModel.updateStockQuantity(existingStock.id, balanceAfter, connection);
            } else {
                balanceAfter = Number(receivedQty.toFixed(2));
                await receiptModel.insertStock(
                    item.product_id,
                    receipt.location_id,
                    balanceAfter,
                    connection
                );
            }

            // Create stock_ledger entry
            await receiptModel.insertStockLedger({
                product_id: item.product_id,
                location_id: receipt.location_id,
                movement_type: "receipt",
                reference_id: receipt.id,
                quantity_change: receivedQty,
                balance_after: balanceAfter,
                created_by: authenticatedUserId || receipt.created_by || null
            }, connection);
        }

        // Update receipt status to 'done'
        await receiptModel.updateReceiptStatus(receipt.id, "done", connection);

        // Simulated failure for transaction rollback verification
        if (process.env.NODE_ENV === "test" && simulateFailure) {
            throw new Error("Simulated database failure during transaction");
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return await getReceipt(parsedId);
};

module.exports = {
    createReceipt,
    getReceipts,
    getReceipt,
    updateReceipt,
    cancelReceipt,
    validateReceipt
};
