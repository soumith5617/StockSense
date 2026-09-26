const stockLedgerService = require("../services/stockLedgerService");

/**
 * Error handler for stock ledger controller operations
 */
function handleLedgerError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled stock ledger error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * GET /api/stock-ledger
 * Query stock ledger movements with optional filters & pagination
 */
const getLedger = async (req, res, next) => {
    try {
        const result = await stockLedgerService.getLedger(req.query || {});

        res.status(200).json({
            success: true,
            data: result.data,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages
        });
    } catch (error) {
        handleLedgerError(error, res, next);
    }
};

/**
 * GET /api/stock-ledger/:id
 * Retrieve a single stock ledger entry by ID
 */
const getLedgerById = async (req, res, next) => {
    try {
        const entry = await stockLedgerService.getLedgerById(req.params.id);

        res.status(200).json({
            success: true,
            data: entry
        });
    } catch (error) {
        handleLedgerError(error, res, next);
    }
};

module.exports = {
    getLedger,
    getLedgerById
};
