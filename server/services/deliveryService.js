const pool = require("../config/database");
const deliveryModel = require("../models/deliveryModel");
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
 * Validate delivery input payload
 */
async function validateDeliveryData(data, excludeDeliveryId = null) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { delivery_number, customer_name, location_id, status, items } = data;

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

    // 2. Validate customer_name (optional)
    const parsedCustomerName = customer_name !== undefined && customer_name !== null && String(customer_name).trim() !== ""
        ? String(customer_name).trim()
        : null;

    // 3. Validate delivery_number (optional, unique if provided)
    let finalDeliveryNumber;
    if (delivery_number !== undefined && delivery_number !== null && String(delivery_number).trim() !== "") {
        finalDeliveryNumber = String(delivery_number).trim();
        const existingDelivery = await deliveryModel.getDeliveryByNumber(finalDeliveryNumber, excludeDeliveryId);
        if (existingDelivery) {
            const error = new Error(`Delivery with number '${finalDeliveryNumber}' already exists`);
            error.status = 409;
            throw error;
        }
    } else {
        finalDeliveryNumber = `DEL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("Delivery must contain at least one item");
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
            const error = new Error(`Duplicate product ID ${parsedProductId} in delivery items`);
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
            const error = new Error(`Invalid initial delivery status: ${status}. Must be one of: ${validInitialStatuses.join(", ")}`);
            error.status = 400;
            throw error;
        }
        finalStatus = trimmedStatus;
    }

    return {
        delivery_number: finalDeliveryNumber,
        customer_name: parsedCustomerName,
        location_id: parsedLocationId,
        status: finalStatus,
        items: validatedItems
    };
}

/**
 * Create a new outgoing stock delivery
 */
const createDelivery = async (data, authenticatedUserId = null) => {
    const validated = await validateDeliveryData(data);

    const deliveryId = await deliveryModel.createDelivery({
        delivery_number: validated.delivery_number,
        customer_name: validated.customer_name,
        location_id: validated.location_id,
        status: validated.status,
        created_by: authenticatedUserId
    }, validated.items);

    return await getDelivery(deliveryId);
};

/**
 * Fetch all deliveries
 */
const getDeliveries = async () => {
    return await deliveryModel.getAllDeliveries();
};

/**
 * Fetch single delivery by ID with items
 */
const getDelivery = async (id) => {
    const parsedId = validateId(id, "delivery ID");

    const delivery = await deliveryModel.getDeliveryById(parsedId);
    if (!delivery) {
        const error = new Error("Delivery not found");
        error.status = 404;
        throw error;
    }

    const items = await deliveryModel.getDeliveryItems(parsedId);
    delivery.items = items;

    return delivery;
};

/**
 * Update an existing delivery (prior to validation/completion)
 */
const updateDelivery = async (id, data) => {
    const parsedId = validateId(id, "delivery ID");

    const existingDelivery = await deliveryModel.getDeliveryById(parsedId);
    if (!existingDelivery) {
        const error = new Error("Delivery not found");
        error.status = 404;
        throw error;
    }

    if (existingDelivery.status === "done") {
        const error = new Error("Cannot modify a delivery that has already been validated and completed");
        error.status = 400;
        throw error;
    }

    if (existingDelivery.status === "canceled") {
        const error = new Error("Cannot modify a canceled delivery");
        error.status = 400;
        throw error;
    }

    const validated = await validateDeliveryData(data, parsedId);

    await deliveryModel.updateDelivery(parsedId, {
        customer_name: validated.customer_name,
        location_id: validated.location_id,
        status: validated.status
    });

    await deliveryModel.updateDeliveryItems(parsedId, validated.items);

    return await getDelivery(parsedId);
};

/**
 * Cancel a delivery
 */
const cancelDelivery = async (id) => {
    const parsedId = validateId(id, "delivery ID");

    const delivery = await deliveryModel.getDeliveryById(parsedId);
    if (!delivery) {
        const error = new Error("Delivery not found");
        error.status = 404;
        throw error;
    }

    if (delivery.status === "done") {
        const error = new Error("Cannot cancel a delivery that has already been completed and validated");
        error.status = 400;
        throw error;
    }

    if (delivery.status === "canceled") {
        const error = new Error("Delivery is already canceled");
        error.status = 400;
        throw error;
    }

    await deliveryModel.updateDeliveryStatus(parsedId, "canceled");

    return {
        success: true,
        message: "Delivery canceled successfully"
    };
};

/**
 * Validate delivery and deduct stock + create negative ledger entries in an atomic transaction
 */
const validateDelivery = async (id, authenticatedUserId = null, simulateFailure = false) => {
    const parsedId = validateId(id, "delivery ID");

    // 1. Verify delivery exists
    const delivery = await deliveryModel.getDeliveryById(parsedId);
    if (!delivery) {
        const error = new Error("Delivery not found");
        error.status = 404;
        throw error;
    }

    // 2. Verify status
    if (delivery.status === "done") {
        const error = new Error("Delivery has already been validated and completed");
        error.status = 409;
        throw error;
    }

    if (delivery.status === "canceled") {
        const error = new Error("Canceled deliveries cannot be validated");
        error.status = 409;
        throw error;
    }

    // 3. Fetch items
    const items = await deliveryModel.getDeliveryItems(parsedId);
    if (!items || items.length === 0) {
        const error = new Error("Delivery contains no items to validate");
        error.status = 400;
        throw error;
    }

    // 4. Verify location still exists
    const location = await locationModel.getLocationById(delivery.location_id);
    if (!location) {
        const error = new Error(`Location with ID ${delivery.location_id} no longer exists`);
        error.status = 400;
        throw error;
    }

    // 5. Pre-verify products
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

    // 6. Transaction execution
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of items) {
            const requestedQty = Number(item.quantity);

            // Lock and read stock record using SELECT ... FOR UPDATE
            const stockRow = await deliveryModel.getStockForUpdate(
                item.product_id,
                delivery.location_id,
                connection
            );

            if (!stockRow) {
                const error = new Error(
                    `Insufficient stock: no stock available for product ID ${item.product_id} at location ID ${delivery.location_id}`
                );
                error.status = 409;
                throw error;
            }

            const currentQty = Number(stockRow.quantity);

            if (currentQty < requestedQty) {
                const error = new Error(
                    `Insufficient stock for product ID ${item.product_id}: available ${currentQty}, requested ${requestedQty}`
                );
                error.status = 409;
                throw error;
            }

            // Decrease stock (prevent negative stock!)
            const newBalance = Number((currentQty - requestedQty).toFixed(2));
            await deliveryModel.updateStockQuantity(stockRow.id, newBalance, connection);

            // Insert stock ledger record (movement_type = 'delivery', negative quantity_change)
            await deliveryModel.insertStockLedger({
                product_id: item.product_id,
                location_id: delivery.location_id,
                movement_type: "delivery",
                reference_id: delivery.id,
                quantity_change: -requestedQty,
                balance_after: newBalance,
                created_by: authenticatedUserId || delivery.created_by || null
            }, connection);
        }

        // Mark delivery as 'done'
        await deliveryModel.updateDeliveryStatus(delivery.id, "done", connection);

        // Simulated failure for transaction rollback testing
        if (process.env.NODE_ENV === "test" && simulateFailure) {
            throw new Error("Simulated database failure during delivery transaction");
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return await getDelivery(parsedId);
};

module.exports = {
    createDelivery,
    getDeliveries,
    getDelivery,
    updateDelivery,
    cancelDelivery,
    validateDelivery
};
