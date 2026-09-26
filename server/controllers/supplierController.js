const supplierService = require("../services/supplierService");

/**
 * Handle supplier controller errors cleanly
 */
function handleSupplierError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot delete supplier: it is referenced by existing receipt records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled supplier error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/suppliers
 */
const createSupplier = async (req, res, next) => {
    try {
        const supplier = await supplierService.createSupplier(req.body || {});

        res.status(201).json({
            success: true,
            message: "Supplier created successfully",
            data: supplier
        });
    } catch (error) {
        handleSupplierError(error, res, next);
    }
};

/**
 * GET /api/suppliers
 */
const getSuppliers = async (req, res, next) => {
    try {
        const suppliers = await supplierService.getSuppliers();

        res.status(200).json({
            success: true,
            data: suppliers
        });
    } catch (error) {
        handleSupplierError(error, res, next);
    }
};

/**
 * GET /api/suppliers/:id
 */
const getSupplierById = async (req, res, next) => {
    try {
        const supplier = await supplierService.getSupplier(req.params.id);

        res.status(200).json({
            success: true,
            data: supplier
        });
    } catch (error) {
        handleSupplierError(error, res, next);
    }
};

/**
 * PUT /api/suppliers/:id
 */
const updateSupplier = async (req, res, next) => {
    try {
        const supplier = await supplierService.updateSupplier(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Supplier updated successfully",
            data: supplier
        });
    } catch (error) {
        handleSupplierError(error, res, next);
    }
};

/**
 * DELETE /api/suppliers/:id
 */
const deleteSupplier = async (req, res, next) => {
    try {
        const result = await supplierService.deleteSupplier(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleSupplierError(error, res, next);
    }
};

module.exports = {
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
};
