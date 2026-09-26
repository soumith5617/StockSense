const productModel = require("../models/productModel");

/**
 * Validate product payload data
 */
function validateProductData(data) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { name, sku, unit_of_measure, reorder_level, category_id } = data;

    // Validate name
    if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
        const error = new Error("Product name is required");
        error.status = 400;
        throw error;
    }

    // Validate sku
    if (sku === undefined || sku === null || typeof sku !== "string" || !sku.trim()) {
        const error = new Error("Product SKU is required");
        error.status = 400;
        throw error;
    }

    // Validate unit_of_measure
    if (unit_of_measure === undefined || unit_of_measure === null || typeof unit_of_measure !== "string" || !unit_of_measure.trim()) {
        const error = new Error("Unit of measure is required");
        error.status = 400;
        throw error;
    }

    // Validate reorder_level (must not be negative)
    let parsedReorderLevel = 0;
    if (reorder_level !== undefined && reorder_level !== null && reorder_level !== "") {
        const num = Number(reorder_level);
        if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            const error = new Error("Reorder level must be a non-negative integer");
            error.status = 400;
            throw error;
        }
        parsedReorderLevel = num;
    }

    // Validate category_id (optional, but must be valid positive integer if provided)
    let parsedCategoryId = null;
    if (category_id !== undefined && category_id !== null && category_id !== "") {
        const num = Number(category_id);
        if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
            const error = new Error("Invalid category_id: must be a positive integer");
            error.status = 400;
            throw error;
        }
        parsedCategoryId = num;
    }

    return {
        name: name.trim(),
        sku: sku.trim(),
        category_id: parsedCategoryId,
        unit_of_measure: unit_of_measure.trim(),
        reorder_level: parsedReorderLevel
    };
}

/**
 * Validate numeric ID from params
 */
function validateId(id) {
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error("Invalid product ID: must be a positive integer");
        error.status = 400;
        throw error;
    }
    return parsedId;
}

/**
 * Fetch all products
 */
const getProducts = async () => {
    return await productModel.getAllProducts();
};

/**
 * Fetch a single product by ID
 */
const getProduct = async (id) => {
    const parsedId = validateId(id);
    return await productModel.getProductById(parsedId);
};

/**
 * Create a new product with validation
 */
const addProduct = async (productData) => {
    const validated = validateProductData(productData);

    // SKU uniqueness validation
    const existingSku = await productModel.getProductBySku(validated.sku);
    if (existingSku) {
        const error = new Error(`Product with SKU '${validated.sku}' already exists`);
        error.status = 409;
        throw error;
    }

    // Category validation if category_id provided
    if (validated.category_id) {
        const category = await productModel.getCategoryById(validated.category_id);
        if (!category) {
            const error = new Error(`Category with ID ${validated.category_id} does not exist`);
            error.status = 400;
            throw error;
        }
    }

    const productId = await productModel.createProduct(validated);
    return await productModel.getProductById(productId);
};

/**
 * Update an existing product
 */
const updateProduct = async (id, productData) => {
    const parsedId = validateId(id);

    const existingProduct = await productModel.getProductById(parsedId);
    if (!existingProduct) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
    }

    const validated = validateProductData(productData);

    // SKU uniqueness validation excluding current product ID
    const duplicateSku = await productModel.getProductBySku(validated.sku, parsedId);
    if (duplicateSku) {
        const error = new Error(`Product with SKU '${validated.sku}' already exists`);
        error.status = 409;
        throw error;
    }

    // Category validation if category_id provided
    if (validated.category_id) {
        const category = await productModel.getCategoryById(validated.category_id);
        if (!category) {
            const error = new Error(`Category with ID ${validated.category_id} does not exist`);
            error.status = 400;
            throw error;
        }
    }

    await productModel.updateProduct(parsedId, validated);
    return await productModel.getProductById(parsedId);
};

/**
 * Delete a product safely (checking for references)
 */
const deleteProduct = async (id) => {
    const parsedId = validateId(id);

    const existingProduct = await productModel.getProductById(parsedId);
    if (!existingProduct) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
    }

    // Check for foreign key references in stock, ledger, receipts, deliveries, transfers, adjustments
    const { isReferenced, references } = await productModel.checkProductReferences(parsedId);
    if (isReferenced) {
        const reasons = [];
        if (references.stockCount > 0 || references.totalStockQty > 0) {
            reasons.push(`inventory stock (${references.totalStockQty} units across ${references.stockCount} record(s))`);
        }
        if (references.ledgerCount > 0) {
            reasons.push(`${references.ledgerCount} stock ledger entry(ies)`);
        }
        if (references.receiptCount > 0) {
            reasons.push(`${references.receiptCount} receipt item(s)`);
        }
        if (references.deliveryCount > 0) {
            reasons.push(`${references.deliveryCount} delivery item(s)`);
        }
        if (references.transferCount > 0) {
            reasons.push(`${references.transferCount} transfer item(s)`);
        }
        if (references.adjustmentCount > 0) {
            reasons.push(`${references.adjustmentCount} adjustment item(s)`);
        }

        const reasonText = reasons.length > 0 ? `: referenced by ${reasons.join(", ")}` : "";
        const error = new Error(`Cannot delete product${reasonText}. Deletion rejected to maintain data integrity.`);
        error.status = 409;
        throw error;
    }

    await productModel.deleteProduct(parsedId);
    return { success: true, message: "Product deleted successfully" };
};

module.exports = {
    getProducts,
    getProduct,
    addProduct,
    updateProduct,
    deleteProduct
};