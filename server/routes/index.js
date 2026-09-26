const express = require("express");

const healthRoutes = require("./healthRoutes");
const productRoutes = require("./productRoutes");
const authRoutes = require("./authRoutes");
const warehouseRoutes = require("./warehouseRoutes");
const locationRoutes = require("./locationRoutes");
const supplierRoutes = require("./supplierRoutes");
const receiptRoutes = require("./receiptRoutes");
const deliveryRoutes = require("./deliveryRoutes");
const transferRoutes = require("./transferRoutes");
const adjustmentRoutes = require("./adjustmentRoutes");
const stockLedgerRoutes = require("./stockLedgerRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/products", productRoutes);
router.use("/auth", authRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/locations", locationRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/receipts", receiptRoutes);
router.use("/deliveries", deliveryRoutes);
router.use("/transfers", transferRoutes);
router.use("/adjustments", adjustmentRoutes);
router.use("/stock-ledger", stockLedgerRoutes);

module.exports = router;