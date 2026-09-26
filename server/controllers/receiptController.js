const receiptService = require("../services/receiptService");

/**
 * Handle receipt controller errors cleanly
 */
function handleReceiptError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "A receipt with this receipt number already exists"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot modify or delete receipt: it is referenced by other records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled receipt error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/receipts
 */
const createReceipt = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const receipt = await receiptService.createReceipt(req.body || {}, userId);

        res.status(201).json({
            success: true,
            message: "Receipt created successfully",
            data: receipt
        });
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

/**
 * GET /api/receipts
 */
const getReceipts = async (req, res, next) => {
    try {
        const receipts = await receiptService.getReceipts();

        res.status(200).json({
            success: true,
            data: receipts
        });
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

/**
 * GET /api/receipts/:id
 */
const getReceiptById = async (req, res, next) => {
    try {
        const receipt = await receiptService.getReceipt(req.params.id);

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

/**
 * PUT /api/receipts/:id
 */
const updateReceipt = async (req, res, next) => {
    try {
        const receipt = await receiptService.updateReceipt(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Receipt updated successfully",
            data: receipt
        });
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

/**
 * POST /api/receipts/:id/cancel
 */
const cancelReceipt = async (req, res, next) => {
    try {
        const result = await receiptService.cancelReceipt(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

/**
 * POST /api/receipts/:id/validate
 */
const validateReceipt = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const simulateFailure = req.headers["x-simulate-failure"] === "true";
        const receipt = await receiptService.validateReceipt(req.params.id, userId, simulateFailure);

        res.status(200).json({
            success: true,
            message: "Receipt validated and stock updated successfully",
            data: receipt
        });
    } catch (error) {
        handleReceiptError(error, res, next);
    }
};

module.exports = {
    createReceipt,
    getReceipts,
    getReceiptById,
    updateReceipt,
    cancelReceipt,
    validateReceipt
};
