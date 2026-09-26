const express = require("express");
const {
    createAdjustment,
    getAdjustments,
    getAdjustmentById,
    updateAdjustment,
    cancelAdjustment,
    validateAdjustment
} = require("../controllers/adjustmentController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createAdjustment);
router.get("/", authenticate, getAdjustments);
router.get("/:id", authenticate, getAdjustmentById);
router.put("/:id", authenticate, updateAdjustment);
router.post("/:id/cancel", authenticate, cancelAdjustment);
router.post("/:id/validate", authenticate, validateAdjustment);

module.exports = router;
