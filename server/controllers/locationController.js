const locationService = require("../services/locationService");

/**
 * Handle location controller errors cleanly
 */
function handleLocationError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({
            success: false,
            message: "Referenced warehouse does not exist"
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            success: false,
            message: "Cannot delete location: it is referenced by existing inventory or transaction records"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled location error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/locations
 */
const createLocation = async (req, res, next) => {
    try {
        const location = await locationService.createLocation(req.body || {});

        res.status(201).json({
            success: true,
            message: "Location created successfully",
            data: location
        });
    } catch (error) {
        handleLocationError(error, res, next);
    }
};

/**
 * GET /api/locations
 */
const getLocations = async (req, res, next) => {
    try {
        const locations = await locationService.getLocations();

        res.status(200).json({
            success: true,
            data: locations
        });
    } catch (error) {
        handleLocationError(error, res, next);
    }
};

/**
 * GET /api/locations/:id
 */
const getLocationById = async (req, res, next) => {
    try {
        const location = await locationService.getLocation(req.params.id);

        res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        handleLocationError(error, res, next);
    }
};

/**
 * PUT /api/locations/:id
 */
const updateLocation = async (req, res, next) => {
    try {
        const location = await locationService.updateLocation(req.params.id, req.body || {});

        res.status(200).json({
            success: true,
            message: "Location updated successfully",
            data: location
        });
    } catch (error) {
        handleLocationError(error, res, next);
    }
};

/**
 * DELETE /api/locations/:id
 */
const deleteLocation = async (req, res, next) => {
    try {
        const result = await locationService.deleteLocation(req.params.id);

        res.status(200).json(result);
    } catch (error) {
        handleLocationError(error, res, next);
    }
};

module.exports = {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation
};
