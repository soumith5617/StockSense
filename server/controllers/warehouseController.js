const warehouseService = require("../services/warehouseService");

/**
 * Handle warehouse controller errors cleanly
 */
function handleWarehouseError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "A warehouse with this code already exists"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot delete warehouse: it is referenced by existing locations or inventory records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled warehouse error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/warehouses
 */
const createWarehouse = async (req, res, next) => {
    try {
        const warehouse = await warehouseService.createWarehouse(req.body || {});

        res.status(201).json({
            success: true,
            message: "Warehouse created successfully",
            data: warehouse
        });
    } catch (error) {
        handleWarehouseError(error, res, next);
    }
};

/**
 * GET /api/warehouses
 */
const getWarehouses = async (req, res, next) => {
    try {
        const warehouses = await warehouseService.getWarehouses();

        res.status(200).json({
            success: true,
            data: warehouses
        });
    } catch (error) {
        handleWarehouseError(error, res, next);
    }
};

/**
 * GET /api/warehouses/:id
 */
const getWarehouseById = async (req, res, next) => {
    try {
        const warehouse = await warehouseService.getWarehouse(req.params.id);

        res.status(200).json({
            success: true,
            data: warehouse
        });
    } catch (error) {
        handleWarehouseError(error, res, next);
    }
};

/**
 * PUT /api/warehouses/:id
 */
const updateWarehouse = async (req, res, next) => {
    try {
        const warehouse = await warehouseService.updateWarehouse(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Warehouse updated successfully",
            data: warehouse
        });
    } catch (error) {
        handleWarehouseError(error, res, next);
    }
};

/**
 * DELETE /api/warehouses/:id
 */
const deleteWarehouse = async (req, res, next) => {
    try {
        const result = await warehouseService.deleteWarehouse(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleWarehouseError(error, res, next);
    }
};

module.exports = {
    createWarehouse,
    getWarehouses,
    getWarehouseById,
    updateWarehouse,
    deleteWarehouse
};
