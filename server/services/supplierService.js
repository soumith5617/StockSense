const supplierModel = require("../models/supplierModel");

/**
 * Validate email format using standard regex
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === "string" && emailRegex.test(email.trim());
}

/**
 * Validate numeric ID
 */
function validateId(id) {
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error("Invalid supplier ID: must be a positive integer");
        error.status = 400;
        throw error;
    }
    return parsedId;
}

/**
 * Validate supplier payload data
 */
function validateSupplierData(data) {
    if (!data || typeof data !== "object") {
        const error = new Error("Invalid request body");
        error.status = 400;
        throw error;
    }

    const { name, email, phone, address } = data;

    // Validate name
    if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
        const error = new Error("Supplier name is required");
        error.status = 400;
        throw error;
    }

    // Validate email if provided
    let parsedEmail = null;
    if (email !== undefined && email !== null && String(email).trim() !== "") {
        if (!isValidEmail(email)) {
            const error = new Error("A valid email address is required");
            error.status = 400;
            throw error;
        }
        parsedEmail = String(email).trim().toLowerCase();
    }

    // Phone & address optional
    const parsedPhone = phone !== undefined && phone !== null && String(phone).trim() !== ""
        ? String(phone).trim()
        : null;

    const parsedAddress = address !== undefined && address !== null && String(address).trim() !== ""
        ? String(address).trim()
        : null;

    return {
        name: name.trim(),
        email: parsedEmail,
        phone: parsedPhone,
        address: parsedAddress
    };
}

/**
 * Create a new supplier
 */
const createSupplier = async (data) => {
    const validated = validateSupplierData(data);
    const supplierId = await supplierModel.createSupplier(validated);
    return await supplierModel.getSupplierById(supplierId);
};

/**
 * Fetch all suppliers
 */
const getSuppliers = async () => {
    return await supplierModel.getAllSuppliers();
};

/**
 * Fetch single supplier by ID
 */
const getSupplier = async (id) => {
    const parsedId = validateId(id);
    const supplier = await supplierModel.getSupplierById(parsedId);
    if (!supplier) {
        const error = new Error("Supplier not found");
        error.status = 404;
        throw error;
    }
    return supplier;
};

/**
 * Update an existing supplier
 */
const updateSupplier = async (id, data) => {
    const parsedId = validateId(id);

    const existingSupplier = await supplierModel.getSupplierById(parsedId);
    if (!existingSupplier) {
        const error = new Error("Supplier not found");
        error.status = 404;
        throw error;
    }

    const validated = validateSupplierData(data);
    await supplierModel.updateSupplier(parsedId, validated);
    return await supplierModel.getSupplierById(parsedId);
};

/**
 * Safely delete a supplier after checking for receipt references
 */
const deleteSupplier = async (id) => {
    const parsedId = validateId(id);

    const existingSupplier = await supplierModel.getSupplierById(parsedId);
    if (!existingSupplier) {
        const error = new Error("Supplier not found");
        error.status = 404;
        throw error;
    }

    const receiptCount = await supplierModel.getSupplierReceiptCount(parsedId);
    if (receiptCount > 0) {
        const error = new Error(
            `Cannot delete supplier: referenced by ${receiptCount} historical receipt record(s). Deletion blocked to preserve transaction history.`
        );
        error.status = 409;
        throw error;
    }

    await supplierModel.deleteSupplier(parsedId);
    return {
        success: true,
        message: "Supplier deleted successfully"
    };
};

module.exports = {
    createSupplier,
    getSuppliers,
    getSupplier,
    updateSupplier,
    deleteSupplier
};
