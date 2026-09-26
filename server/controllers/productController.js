const productService = require("../services/productService");

/**
 * Helper to handle errors cleanly with proper HTTP status codes and JSON formatting
 */
function handleControllerError(error, res, next) {
    // Handled service / validation error with assigned HTTP status
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    // Specific MySQL error codes
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "A product with this SKU already exists"
        });
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({
            success: false,
            message: "Referenced category does not exist"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot delete product: it is referenced by existing inventory or transaction records"
        });
    }

    if (error.code === "ER_DATA_TOO_LONG") {
        return res.status(400).json({
            success: false,
            message: "One of the provided fields exceeds maximum allowable length"
        });
    }

    // Pass to global error handler or respond with clean 500
    if (next) {
        return next(error);
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * GET /api/products
 * Fetch all products
 */
const getProducts = async (req, res, next) => {
    try {
        const products = await productService.getProducts();

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * GET /api/products/:id
 * Fetch single product by ID
 */
const getProduct = async (req, res, next) => {
    try {
        const product = await productService.getProduct(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * POST /api/products
 * Create a new product
 */
const createProduct = async (req, res, next) => {
    try {
        const product = await productService.addProduct(req.body);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            productId: product.id,
            data: product
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * PUT /api/products/:id
 * Update an existing product
 */
const updateProduct = async (req, res, next) => {
    try {
        const updatedProduct = await productService.updateProduct(req.params.id, req.body);

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: updatedProduct
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * DELETE /api/products/:id
 * Delete a product
 */
const deleteProduct = async (req, res, next) => {
    try {
        const result = await productService.deleteProduct(req.params.id);

        res.status(200).json({
            success: true,
            message: result.message || "Product deleted successfully"
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
};