const express = require("express");
const {
    createTransfer,
    getTransfers,
    getTransferById,
    updateTransfer,
    cancelTransfer,
    validateTransfer
} = require("../controllers/transferController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createTransfer);
router.get("/", authenticate, getTransfers);
router.get("/:id", authenticate, getTransferById);
router.put("/:id", authenticate, updateTransfer);
router.post("/:id/cancel", authenticate, cancelTransfer);
router.post("/:id/validate", authenticate, validateTransfer);

module.exports = router;
