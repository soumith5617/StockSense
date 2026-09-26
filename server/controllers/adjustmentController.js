const adjustmentService = require("../services/adjustmentService");

/**
 * Handle adjustment controller errors cleanly
 */
function handleAdjustmentError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "An adjustment with this adjustment number already exists"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot modify or delete adjustment: it is referenced by other records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled adjustment error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/adjustments
 */
const createAdjustment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const adjustment = await adjustmentService.createAdjustment(req.body || {}, userId);

        res.status(201).json({
            success: true,
            message: "Adjustment created successfully",
            data: adjustment
        });
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

/**
 * GET /api/adjustments
 */
const getAdjustments = async (req, res, next) => {
    try {
        const adjustments = await adjustmentService.getAdjustments();

        res.status(200).json({
            success: true,
            data: adjustments
        });
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

/**
 * GET /api/adjustments/:id
 */
const getAdjustmentById = async (req, res, next) => {
    try {
        const adjustment = await adjustmentService.getAdjustment(req.params.id);

        res.status(200).json({
            success: true,
            data: adjustment
        });
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

/**
 * PUT /api/adjustments/:id
 */
const updateAdjustment = async (req, res, next) => {
    try {
        const adjustment = await adjustmentService.updateAdjustment(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Adjustment updated successfully",
            data: adjustment
        });
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

/**
 * POST /api/adjustments/:id/cancel
 */
const cancelAdjustment = async (req, res, next) => {
    try {
        const result = await adjustmentService.cancelAdjustment(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

/**
 * POST /api/adjustments/:id/validate
 */
const validateAdjustment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const simulateFailure = req.headers["x-simulate-failure"] === "true";
        const adjustment = await adjustmentService.validateAdjustment(req.params.id, userId, simulateFailure);

        res.status(200).json({
            success: true,
            message: "Adjustment validated and stock adjusted successfully",
            data: adjustment
        });
    } catch (error) {
        handleAdjustmentError(error, res, next);
    }
};

module.exports = {
    createAdjustment,
    getAdjustments,
    getAdjustmentById,
    updateAdjustment,
    cancelAdjustment,
    validateAdjustment
};
