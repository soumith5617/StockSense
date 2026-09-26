const transferService = require("../services/transferService");

/**
 * Handle transfer controller errors cleanly
 */
function handleTransferError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "A transfer with this transfer number already exists"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot modify or delete transfer: it is referenced by other records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled transfer error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/transfers
 */
const createTransfer = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const transfer = await transferService.createTransfer(req.body || {}, userId);

        res.status(201).json({
            success: true,
            message: "Transfer created successfully",
            data: transfer
        });
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

/**
 * GET /api/transfers
 */
const getTransfers = async (req, res, next) => {
    try {
        const transfers = await transferService.getTransfers();

        res.status(200).json({
            success: true,
            data: transfers
        });
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

/**
 * GET /api/transfers/:id
 */
const getTransferById = async (req, res, next) => {
    try {
        const transfer = await transferService.getTransfer(req.params.id);

        res.status(200).json({
            success: true,
            data: transfer
        });
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

/**
 * PUT /api/transfers/:id
 */
const updateTransfer = async (req, res, next) => {
    try {
        const transfer = await transferService.updateTransfer(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Transfer updated successfully",
            data: transfer
        });
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

/**
 * POST /api/transfers/:id/cancel
 */
const cancelTransfer = async (req, res, next) => {
    try {
        const result = await transferService.cancelTransfer(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

/**
 * POST /api/transfers/:id/validate
 */
const validateTransfer = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const simulateFailure = req.headers["x-simulate-failure"] === "true";
        const transfer = await transferService.validateTransfer(req.params.id, userId, simulateFailure);

        res.status(200).json({
            success: true,
            message: "Transfer validated and stock moved successfully",
            data: transfer
        });
    } catch (error) {
        handleTransferError(error, res, next);
    }
};

module.exports = {
    createTransfer,
    getTransfers,
    getTransferById,
    updateTransfer,
    cancelTransfer,
    validateTransfer
};
