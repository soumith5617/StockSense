process.env.NODE_ENV = "test";
require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Warehouse & Location Management Verification Test Suite
 * Tests all Warehouse and Location endpoints, validation, joins, code scoping,
 * safe deletion rules, and clean data teardown.
 */
async function runTests() {
    let server;
    let testsPassed = 0;
    let testsFailed = 0;

    function assert(condition, testName, details = "") {
        if (condition) {
            console.log(`  [PASS] ${testName}`);
            testsPassed++;
        } else {
            console.error(`  [FAIL] ${testName} - ${details}`);
            testsFailed++;
            throw new Error(`Test failed: ${testName} - ${details}`);
        }
    }

    try {
        console.log("=================================================");
        console.log("  StockSense Warehouse & Location Verification");
        console.log("=================================================\n");

        // Start temporary HTTP test server on an ephemeral port
        server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;
        console.log(`Temporary test server running on ${baseUrl}\n`);

        const apiRequest = async (method, endpoint, body = null) => {
            const options = {
                method,
                headers: { "Content-Type": "application/json" }
            };
            if (body !== null) {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(`${baseUrl}${endpoint}`, options);
            const data = await res.json();
            return { status: res.status, body: data };
        };

        // ==================== WAREHOUSE TESTS ====================

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with status message",
            JSON.stringify(resHealth.body)
        );

        // 2. Missing warehouse name rejected
        console.log("\nStep 2: Missing warehouse name rejected");
        const resNoWhName = await apiRequest("POST", "/api/warehouses", {
            code: "WH-NORTH"
        });
        assert(
            resNoWhName.status === 400 && resNoWhName.body.success === false,
            "POST /api/warehouses rejects missing name with 400",
            JSON.stringify(resNoWhName.body)
        );

        // 3. Missing warehouse code rejected
        console.log("\nStep 3: Missing warehouse code rejected");
        const resNoWhCode = await apiRequest("POST", "/api/warehouses", {
            name: "North Hub"
        });
        assert(
            resNoWhCode.status === 400 && resNoWhCode.body.success === false,
            "POST /api/warehouses rejects missing code with 400",
            JSON.stringify(resNoWhCode.body)
        );

        // 4. Warehouse creation
        console.log("\nStep 4: Warehouse creation");
        const whCode1 = `WH-A-${Date.now()}`;
        const resCreateWh1 = await apiRequest("POST", "/api/warehouses", {
            name: "Main Distribution Center",
            code: whCode1,
            address: "100 Logistics Blvd, Dallas, TX"
        });
        assert(
            resCreateWh1.status === 201 && resCreateWh1.body.success === true && resCreateWh1.body.data.id > 0,
            "POST /api/warehouses creates warehouse with 201 Created",
            JSON.stringify(resCreateWh1.body)
        );
        const warehouse1 = resCreateWh1.body.data;
        const wh1Id = warehouse1.id;

        // 5. Duplicate warehouse code rejected
        console.log("\nStep 5: Duplicate warehouse code rejected");
        const resDupWhCode = await apiRequest("POST", "/api/warehouses", {
            name: "Duplicate DC",
            code: whCode1,
            address: "Another address"
        });
        assert(
            resDupWhCode.status === 409 && resDupWhCode.body.success === false,
            "POST /api/warehouses rejects duplicate code with 409 Conflict",
            JSON.stringify(resDupWhCode.body)
        );

        // Create second warehouse for multi-warehouse location tests
        const whCode2 = `WH-B-${Date.now()}`;
        const resCreateWh2 = await apiRequest("POST", "/api/warehouses", {
            name: "East Coast Facility",
            code: whCode2,
            address: "250 Atlantic Ave, Newark, NJ"
        });
        assert(
            resCreateWh2.status === 201 && resCreateWh2.body.data.id > 0,
            "Second warehouse created for cross-warehouse testing",
            JSON.stringify(resCreateWh2.body)
        );
        const wh2Id = resCreateWh2.body.data.id;

        // 6. Get warehouses
        console.log("\nStep 6: Get warehouses");
        const resGetWhs = await apiRequest("GET", "/api/warehouses");
        assert(
            resGetWhs.status === 200 && Array.isArray(resGetWhs.body.data) && resGetWhs.body.data.length >= 2,
            "GET /api/warehouses returns 200 with warehouse array",
            `Count: ${resGetWhs.body.data?.length}`
        );

        // 7. Get warehouse by ID
        console.log(`\nStep 7: Get warehouse by ID (${wh1Id})`);
        const resGetWh1 = await apiRequest("GET", `/api/warehouses/${wh1Id}`);
        assert(
            resGetWh1.status === 200 && resGetWh1.body.data.code === whCode1,
            `GET /api/warehouses/${wh1Id} returns 200 with matching warehouse details`,
            JSON.stringify(resGetWh1.body.data)
        );

        // 8. Update warehouse
        console.log(`\nStep 8: Update warehouse (${wh1Id})`);
        const resUpdateWh1 = await apiRequest("PUT", `/api/warehouses/${wh1Id}`, {
            name: "Main Distribution Center East",
            code: whCode1,
            address: "100 Logistics Blvd Suite 500, Dallas, TX"
        });
        assert(
            resUpdateWh1.status === 200 && resUpdateWh1.body.data.name === "Main Distribution Center East",
            "PUT /api/warehouses/:id updates warehouse successfully with 200",
            JSON.stringify(resUpdateWh1.body.data)
        );

        // 9. Invalid warehouse ID handling
        console.log("\nStep 9: Invalid warehouse ID handling");
        const resBadWhId = await apiRequest("GET", "/api/warehouses/invalid-id");
        assert(
            resBadWhId.status === 400 && resBadWhId.body.success === false,
            "GET /api/warehouses/invalid-id returns 400 Bad Request",
            JSON.stringify(resBadWhId.body)
        );
        const resNotFoundWh = await apiRequest("GET", "/api/warehouses/999999");
        assert(
            resNotFoundWh.status === 404 && resNotFoundWh.body.success === false,
            "GET /api/warehouses/999999 returns 404 Not Found",
            JSON.stringify(resNotFoundWh.body)
        );

        // ==================== LOCATION TESTS ====================

        // 10. Missing warehouse_id rejected
        console.log("\nStep 10: Missing warehouse_id rejected");
        const resNoWhIdLoc = await apiRequest("POST", "/api/locations", {
            name: "Aisle 1",
            code: "A1"
        });
        assert(
            resNoWhIdLoc.status === 400 && resNoWhIdLoc.body.success === false,
            "POST /api/locations rejects missing warehouse_id with 400",
            JSON.stringify(resNoWhIdLoc.body)
        );

        // 11. Invalid warehouse_id rejected
        console.log("\nStep 11: Invalid warehouse_id rejected");
        const resBadWhIdLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: 999999,
            name: "Aisle 1",
            code: "A1"
        });
        assert(
            resBadWhIdLoc.status === 400 && resBadWhIdLoc.body.success === false,
            "POST /api/locations rejects non-existent warehouse_id with 400",
            JSON.stringify(resBadWhIdLoc.body)
        );

        // 12. Missing location name rejected
        console.log("\nStep 12: Missing location name rejected");
        const resNoNameLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: wh1Id,
            code: "A1"
        });
        assert(
            resNoNameLoc.status === 400 && resNoNameLoc.body.success === false,
            "POST /api/locations rejects missing name with 400",
            JSON.stringify(resNoNameLoc.body)
        );

        // 13. Missing location code rejected
        console.log("\nStep 13: Missing location code rejected");
        const resNoCodeLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: wh1Id,
            name: "Aisle 1"
        });
        assert(
            resNoCodeLoc.status === 400 && resNoCodeLoc.body.success === false,
            "POST /api/locations rejects missing code with 400",
            JSON.stringify(resNoCodeLoc.body)
        );

        // 14. Location creation
        console.log("\nStep 14: Location creation");
        const locCode1 = "AISLE-01";
        const resCreateLoc1 = await apiRequest("POST", "/api/locations", {
            warehouse_id: wh1Id,
            name: "Aisle 1 Shelf B",
            code: locCode1
        });
        assert(
            resCreateLoc1.status === 201 && resCreateLoc1.body.success === true && resCreateLoc1.body.data.id > 0,
            "POST /api/locations creates location with 201 Created",
            JSON.stringify(resCreateLoc1.body)
        );
        const location1 = resCreateLoc1.body.data;
        const loc1Id = location1.id;

        // 15. Duplicate location code within same warehouse rejected
        console.log("\nStep 15: Duplicate location code within same warehouse rejected");
        const resDupLocSameWh = await apiRequest("POST", "/api/locations", {
            warehouse_id: wh1Id,
            name: "Aisle 1 Shelf C",
            code: locCode1
        });
        assert(
            resDupLocSameWh.status === 409 && resDupLocSameWh.body.success === false,
            "POST /api/locations rejects duplicate code within same warehouse with 409 Conflict",
            JSON.stringify(resDupLocSameWh.body)
        );

        // 16. Same location code in different warehouse behavior verified
        console.log("\nStep 16: Same location code in different warehouse behavior verified");
        const resSameCodeDiffWh = await apiRequest("POST", "/api/locations", {
            warehouse_id: wh2Id,
            name: "Aisle 1 in East Coast",
            code: locCode1
        });
        assert(
            resSameCodeDiffWh.status === 201 && resSameCodeDiffWh.body.success === true && resSameCodeDiffWh.body.data.id > 0,
            "POST /api/locations permits identical code in a different warehouse with 201",
            JSON.stringify(resSameCodeDiffWh.body)
        );
        const loc2Id = resSameCodeDiffWh.body.data.id;

        // 17. Get locations
        console.log("\nStep 17: Get locations");
        const resGetLocs = await apiRequest("GET", "/api/locations");
        assert(
            resGetLocs.status === 200 && Array.isArray(resGetLocs.body.data) && resGetLocs.body.data.length >= 2,
            "GET /api/locations returns 200 with locations array",
            `Count: ${resGetLocs.body.data?.length}`
        );

        // 18. Get location by ID
        console.log(`\nStep 18: Get location by ID (${loc1Id})`);
        const resGetLoc1 = await apiRequest("GET", `/api/locations/${loc1Id}`);
        assert(
            resGetLoc1.status === 200 && resGetLoc1.body.data.code === locCode1,
            `GET /api/locations/${loc1Id} returns 200 with location details`,
            JSON.stringify(resGetLoc1.body.data)
        );

        // 19. Warehouse JOIN information verified
        console.log("\nStep 19: Warehouse JOIN information verified in location response");
        assert(
            resGetLoc1.body.data.warehouse_id === wh1Id &&
            resGetLoc1.body.data.warehouse_name === "Main Distribution Center East" &&
            resGetLoc1.body.data.warehouse_code === whCode1,
            "Location response includes warehouse_name and warehouse_code from JOIN",
            JSON.stringify(resGetLoc1.body.data)
        );

        // 20. Update location
        console.log(`\nStep 20: Update location (${loc1Id})`);
        const resUpdateLoc1 = await apiRequest("PUT", `/api/locations/${loc1Id}`, {
            warehouse_id: wh1Id,
            name: "Aisle 1 Shelf B (Reorganized)",
            code: "AISLE-01-REORG"
        });
        assert(
            resUpdateLoc1.status === 200 && resUpdateLoc1.body.data.name === "Aisle 1 Shelf B (Reorganized)",
            "PUT /api/locations/:id updates location successfully with 200",
            JSON.stringify(resUpdateLoc1.body.data)
        );

        // ==================== SAFE DELETION TESTS ====================

        // 21. Warehouse deletion blocked while locations exist
        console.log(`\nStep 21: Warehouse deletion blocked while locations exist (Warehouse ${wh1Id})`);
        const resDeleteWhBlocked = await apiRequest("DELETE", `/api/warehouses/${wh1Id}`);
        assert(
            resDeleteWhBlocked.status === 409 && resDeleteWhBlocked.body.success === false,
            "DELETE /api/warehouses/:id is blocked with 409 when locations belong to warehouse",
            JSON.stringify(resDeleteWhBlocked.body)
        );

        // 22. Location deletion blocked while referenced by stock/inventory data
        console.log(`\nStep 22: Location deletion blocked while referenced by stock data`);
        // Create temporary product to attach stock
        const testSku = `SKU-LOC-${Date.now()}`;
        const [prodResult] = await pool.query(
            "INSERT INTO products (name, sku, unit_of_measure, reorder_level) VALUES (?, ?, ?, ?)",
            ["Reference Test Item", testSku, "pcs", 5]
        );
        const tempProductId = prodResult.insertId;

        // Insert stock pointing to loc1Id
        await pool.query(
            "INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)",
            [tempProductId, loc1Id, 50]
        );

        const resDeleteLocBlocked = await apiRequest("DELETE", `/api/locations/${loc1Id}`);
        assert(
            resDeleteLocBlocked.status === 409 && resDeleteLocBlocked.body.success === false,
            "DELETE /api/locations/:id is blocked with 409 when referenced in stock",
            JSON.stringify(resDeleteLocBlocked.body)
        );

        // 23. Location successfully deleted after references are cleaned
        console.log("\nStep 23: Location successfully deleted after references are cleaned");
        await pool.query("DELETE FROM stock WHERE location_id = ?", [loc1Id]);
        await pool.query("DELETE FROM products WHERE id = ?", [tempProductId]);

        const resDeleteLoc1 = await apiRequest("DELETE", `/api/locations/${loc1Id}`);
        assert(
            resDeleteLoc1.status === 200 && resDeleteLoc1.body.success === true,
            "DELETE /api/locations/:id succeeds with 200 after stock reference cleared",
            JSON.stringify(resDeleteLoc1.body)
        );

        // Delete location 2 in warehouse 2
        const resDeleteLoc2 = await apiRequest("DELETE", `/api/locations/${loc2Id}`);
        assert(
            resDeleteLoc2.status === 200,
            "DELETE /api/locations/:id for second location succeeds with 200",
            JSON.stringify(resDeleteLoc2.body)
        );

        // 24. Warehouse successfully deleted after its locations are removed
        console.log("\nStep 24: Warehouse successfully deleted after locations are removed");
        const resDeleteWh1 = await apiRequest("DELETE", `/api/warehouses/${wh1Id}`);
        assert(
            resDeleteWh1.status === 200 && resDeleteWh1.body.success === true,
            "DELETE /api/warehouses/:id succeeds with 200 once its locations are deleted",
            JSON.stringify(resDeleteWh1.body)
        );

        const resDeleteWh2 = await apiRequest("DELETE", `/api/warehouses/${wh2Id}`);
        assert(
            resDeleteWh2.status === 200 && resDeleteWh2.body.success === true,
            "DELETE /api/warehouses/:id for warehouse 2 succeeds with 200",
            JSON.stringify(resDeleteWh2.body)
        );

        // 25. Final cleanup verification
        console.log("\nStep 25: Final cleanup verification");
        const [remainingWhs] = await pool.query("SELECT id FROM warehouses WHERE id IN (?, ?)", [wh1Id, wh2Id]);
        const [remainingLocs] = await pool.query("SELECT id FROM locations WHERE id IN (?, ?)", [loc1Id, loc2Id]);
        assert(
            remainingWhs.length === 0 && remainingLocs.length === 0,
            "All test warehouses and locations cleanly purged from database",
            `Remaining WHs: ${remainingWhs.length}, Locations: ${remainingLocs.length}`
        );

        console.log("\n=================================================");
        console.log(`  VERIFICATION COMPLETE: ${testsPassed} passed, ${testsFailed} failed`);
        console.log("=================================================\n");
    } catch (err) {
        console.error("\n*** VERIFICATION FAILED ***", err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
        await pool.end();
        process.exit();
    }
}

runTests();
