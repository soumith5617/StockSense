const deliveryService = require("../services/deliveryService");

/**
 * Handle delivery controller errors cleanly
 */
function handleDeliveryError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "A delivery with this delivery number already exists"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot modify or delete delivery: it is referenced by other records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled delivery error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/deliveries
 */
const createDelivery = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const delivery = await deliveryService.createDelivery(req.body || {}, userId);

        res.status(201).json({
            success: true,
            message: "Delivery created successfully",
            data: delivery
        });
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

/**
 * GET /api/deliveries
 */
const getDeliveries = async (req, res, next) => {
    try {
        const deliveries = await deliveryService.getDeliveries();

        res.status(200).json({
            success: true,
            data: deliveries
        });
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

/**
 * GET /api/deliveries/:id
 */
const getDeliveryById = async (req, res, next) => {
    try {
        const delivery = await deliveryService.getDelivery(req.params.id);

        res.status(200).json({
            success: true,
            data: delivery
        });
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

/**
 * PUT /api/deliveries/:id
 */
const updateDelivery = async (req, res, next) => {
    try {
        const delivery = await deliveryService.updateDelivery(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Delivery updated successfully",
            data: delivery
        });
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

/**
 * POST /api/deliveries/:id/cancel
 */
const cancelDelivery = async (req, res, next) => {
    try {
        const result = await deliveryService.cancelDelivery(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

/**
 * POST /api/deliveries/:id/validate
 */
const validateDelivery = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const simulateFailure = req.headers["x-simulate-failure"] === "true";
        const delivery = await deliveryService.validateDelivery(req.params.id, userId, simulateFailure);

        res.status(200).json({
            success: true,
            message: "Delivery validated and stock updated successfully",
            data: delivery
        });
    } catch (error) {
        handleDeliveryError(error, res, next);
    }
};

module.exports = {
    createDelivery,
    getDeliveries,
    getDeliveryById,
    updateDelivery,
    cancelDelivery,
    validateDelivery
};
