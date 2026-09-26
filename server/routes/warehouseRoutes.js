const express = require("express");
const {
    createWarehouse,
    getWarehouses,
    getWarehouseById,
    updateWarehouse,
    deleteWarehouse
} = require("../controllers/warehouseController");

const router = express.Router();

router.post("/", createWarehouse);
router.get("/", getWarehouses);
router.get("/:id", getWarehouseById);
router.put("/:id", updateWarehouse);
router.delete("/:id", deleteWarehouse);

module.exports = router;
