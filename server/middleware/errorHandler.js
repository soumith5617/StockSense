function errorHandler(err, req, res, next) {
    console.error(err);

    let status = err.status || err.statusCode || 500;
    let message = err.message || "Internal server error";

    // Handle MySQL errors if not already handled
    if (err.code === "ER_DUP_ENTRY") {
        status = 409;
        message = "A record with this unique value already exists";
    } else if (err.code === "ER_NO_REFERENCED_ROW_2") {
        status = 400;
        message = "Referenced record does not exist";
    } else if (err.code === "ER_ROW_IS_REFERENCED_2") {
        status = 409;
        message = "Cannot delete or update record because it is referenced by other records";
    } else if (err.code && err.code.startsWith("ER_")) {
        status = 500;
        message = "A database error occurred";
    }

    res.status(status).json({
        success: false,
        message
    });
}

module.exports = errorHandler;
