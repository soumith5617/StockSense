const express = require("express");
const { getLedger, getLedgerById } = require("../controllers/stockLedgerController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// Read-only stock ledger audit endpoints (authentication required)
router.get("/", authenticate, getLedger);
router.get("/:id", authenticate, getLedgerById);

module.exports = router;
