const express = require("express");
const {
    createDelivery,
    getDeliveries,
    getDeliveryById,
    updateDelivery,
    cancelDelivery,
    validateDelivery
} = require("../controllers/deliveryController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createDelivery);
router.get("/", authenticate, getDeliveries);
router.get("/:id", authenticate, getDeliveryById);
router.put("/:id", authenticate, updateDelivery);
router.post("/:id/cancel", authenticate, cancelDelivery);
router.post("/:id/validate", authenticate, validateDelivery);

module.exports = router;
