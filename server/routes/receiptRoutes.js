const express = require("express");
const {
    createReceipt,
    getReceipts,
    getReceiptById,
    updateReceipt,
    cancelReceipt,
    validateReceipt
} = require("../controllers/receiptController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createReceipt);
router.get("/", authenticate, getReceipts);
router.get("/:id", authenticate, getReceiptById);
router.put("/:id", authenticate, updateReceipt);
router.post("/:id/cancel", authenticate, cancelReceipt);
router.post("/:id/validate", authenticate, validateReceipt);

module.exports = router;
