require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Product Management Verification Test Suite
 * Tests all Product endpoints, validations, joins, error handling, and safe deletion.
 */
async function runTests() {
    let server;
    let testsPassed = 0;
    let testsFailed = 0;

    // Helper for asserting conditions
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
        console.log("  StockSense Product Management Verification Test");
        console.log("=================================================\n");

        // Start temporary HTTP test server on an ephemeral port (port 0)
        server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;
        console.log(`Temporary test server running on ${baseUrl}\n`);

        // HTTP request helper using native fetch
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

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with health message",
            JSON.stringify(resHealth.body)
        );

        // 2. Setup category for testing joins
        console.log("\nStep 2: Category setup for join verification");
        const [catResult] = await pool.query(
            "INSERT INTO categories (name, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
            ["Electronics", "Hardware & gadgets"]
        );
        const testCategoryId = catResult.insertId;
        assert(testCategoryId > 0, "Test category created/retrieved in database", `ID: ${testCategoryId}`);

        // 3. Validation: required name
        console.log("\nStep 3: Required-field validation - name");
        const resNoName = await apiRequest("POST", "/api/products", {
            sku: "TEST-SKU-NONAME",
            unit_of_measure: "pcs"
        });
        assert(
            resNoName.status === 400 && resNoName.body.success === false,
            "POST /api/products rejects missing name with 400",
            JSON.stringify(resNoName.body)
        );

        // 4. Validation: required sku
        console.log("\nStep 4: Required-field validation - sku");
        const resNoSku = await apiRequest("POST", "/api/products", {
            name: "Test Name",
            unit_of_measure: "pcs"
        });
        assert(
            resNoSku.status === 400 && resNoSku.body.success === false,
            "POST /api/products rejects missing sku with 400",
            JSON.stringify(resNoSku.body)
        );

        // 5. Validation: required unit_of_measure
        console.log("\nStep 5: Required-field validation - unit_of_measure");
        const resNoUom = await apiRequest("POST", "/api/products", {
            name: "Test Name",
            sku: "TEST-SKU-NOUOM"
        });
        assert(
            resNoUom.status === 400 && resNoUom.body.success === false,
            "POST /api/products rejects missing unit_of_measure with 400",
            JSON.stringify(resNoUom.body)
        );

        // 6. Validation: negative reorder_level
        console.log("\nStep 6: Negative reorder_level validation");
        const resNegReorder = await apiRequest("POST", "/api/products", {
            name: "Test Name",
            sku: "TEST-SKU-NEGREORDER",
            unit_of_measure: "pcs",
            reorder_level: -5
        });
        assert(
            resNegReorder.status === 400 && resNegReorder.body.success === false,
            "POST /api/products rejects negative reorder_level with 400",
            JSON.stringify(resNegReorder.body)
        );

        // 7. Validation: invalid category_id
        console.log("\nStep 7: Invalid category validation");
        const resBadCategory = await apiRequest("POST", "/api/products", {
            name: "Test Name",
            sku: "TEST-SKU-BADCAT",
            unit_of_measure: "pcs",
            category_id: 999999
        });
        assert(
            resBadCategory.status === 400 && resBadCategory.body.success === false,
            "POST /api/products rejects non-existent category_id with 400",
            JSON.stringify(resBadCategory.body)
        );

        // 8. Product creation (with category)
        console.log("\nStep 8: Product creation with category");
        const testSku1 = `SKU-${Date.now()}-1`;
        const resCreate1 = await apiRequest("POST", "/api/products", {
            name: "Logitech MX Master 3S",
            sku: testSku1,
            category_id: testCategoryId,
            unit_of_measure: "pcs",
            reorder_level: 5
        });
        assert(
            resCreate1.status === 201 && resCreate1.body.success === true && resCreate1.body.productId > 0,
            "POST /api/products creates product successfully with 201",
            JSON.stringify(resCreate1.body)
        );
        const product1Id = resCreate1.body.productId;

        // 9. Duplicate SKU rejection during creation
        console.log("\nStep 9: Duplicate SKU rejection on create");
        const resDupSku = await apiRequest("POST", "/api/products", {
            name: "Duplicate Mouse",
            sku: testSku1,
            unit_of_measure: "pcs"
        });
        assert(
            resDupSku.status === 409 && resDupSku.body.success === false,
            "POST /api/products rejects duplicate SKU with 409 Conflict",
            JSON.stringify(resDupSku.body)
        );

        // 10. Product creation without category (tests NULL category join)
        console.log("\nStep 10: Product creation without category");
        const testSku2 = `SKU-${Date.now()}-2`;
        const resCreate2 = await apiRequest("POST", "/api/products", {
            name: "USB-C to HDMI Cable",
            sku: testSku2,
            unit_of_measure: "meters",
            reorder_level: 20
        });
        assert(
            resCreate2.status === 201 && resCreate2.body.success === true,
            "POST /api/products creates product without category with 201",
            JSON.stringify(resCreate2.body)
        );
        const product2Id = resCreate2.body.productId;

        // 11. Get all products & category join
        console.log("\nStep 11: Get all products and category join verification");
        const resGetAll = await apiRequest("GET", "/api/products");
        assert(
            resGetAll.status === 200 && Array.isArray(resGetAll.body.data),
            "GET /api/products returns 200 with product array",
            `Count: ${resGetAll.body.data?.length}`
        );
        const item1 = resGetAll.body.data.find((p) => p.id === product1Id);
        const item2 = resGetAll.body.data.find((p) => p.id === product2Id);
        assert(
            item1 && item1.category_name === "Electronics",
            "Product with category_id returns category_name via LEFT JOIN",
            `category_name: ${item1?.category_name}`
        );
        assert(
            item2 && item2.category_name === null,
            "Product without category returns null category_name cleanly",
            `category_name: ${item2?.category_name}`
        );

        // 12. Get product by ID
        console.log(`\nStep 12: Get product by ID (GET /api/products/${product1Id})`);
        const resGetById = await apiRequest("GET", `/api/products/${product1Id}`);
        assert(
            resGetById.status === 200 && resGetById.body.data.sku === testSku1 && resGetById.body.data.category_name === "Electronics",
            `GET /api/products/${product1Id} returns 200 with matching details and category_name`,
            JSON.stringify(resGetById.body.data)
        );

        // 13. Update product
        console.log(`\nStep 13: Update product (PUT /api/products/${product1Id})`);
        const resUpdate = await apiRequest("PUT", `/api/products/${product1Id}`, {
            name: "Logitech MX Master 3S Wireless Mouse",
            sku: testSku1,
            category_id: testCategoryId,
            unit_of_measure: "pcs",
            reorder_level: 12
        });
        assert(
            resUpdate.status === 200 && resUpdate.body.data.name === "Logitech MX Master 3S Wireless Mouse" && resUpdate.body.data.reorder_level === 12,
            "PUT /api/products/:id successfully updates product with 200",
            JSON.stringify(resUpdate.body.data)
        );

        // 14. Duplicate SKU rejection during update
        console.log(`\nStep 14: Duplicate SKU rejection during update (PUT /api/products/${product2Id})`);
        const resUpdateDup = await apiRequest("PUT", `/api/products/${product2Id}`, {
            name: "USB Cable",
            sku: testSku1, // SKU belonging to product 1
            unit_of_measure: "meters"
        });
        assert(
            resUpdateDup.status === 409 && resUpdateDup.body.success === false,
            "PUT /api/products/:id rejects conflicting SKU taken by another product with 409",
            JSON.stringify(resUpdateDup.body)
        );

        // 15. Safe deletion behavior when product is referenced
        console.log(`\nStep 15: Safe deletion behavior when product is referenced`);
        const [whRes] = await pool.query(
            "INSERT INTO warehouses (name, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
            ["Test Main Warehouse", "TWH-01"]
        );
        const whId = whRes.insertId;
        const [locRes] = await pool.query(
            "INSERT INTO locations (warehouse_id, name, code) VALUES (?, ?, ?)",
            [whId, "Test Shelf A", "TLOC-01"]
        );
        const locId = locRes.insertId;
        await pool.query(
            "INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)",
            [product1Id, locId, 50]
        );

        const resDeleteBlocked = await apiRequest("DELETE", `/api/products/${product1Id}`);
        assert(
            resDeleteBlocked.status === 409 && resDeleteBlocked.body.success === false,
            "DELETE /api/products/:id is safely blocked with 409 when product is referenced in inventory stock",
            JSON.stringify(resDeleteBlocked.body)
        );

        // Clean up reference
        await pool.query("DELETE FROM stock WHERE product_id = ?", [product1Id]);
        await pool.query("DELETE FROM locations WHERE id = ?", [locId]);
        await pool.query("DELETE FROM warehouses WHERE id = ?", [whId]);

        // 16. Successful deletion after references cleaned up
        console.log(`\nStep 16: Successful deletion after references cleared`);
        const resDeleteOk = await apiRequest("DELETE", `/api/products/${product1Id}`);
        assert(
            resDeleteOk.status === 200 && resDeleteOk.body.success === true,
            "DELETE /api/products/:id successfully deletes unreferenced product with 200",
            JSON.stringify(resDeleteOk.body)
        );

        // Verify product 1 is gone
        const resGetDeleted = await apiRequest("GET", `/api/products/${product1Id}`);
        assert(
            resGetDeleted.status === 404 && resGetDeleted.body.success === false,
            "GET on deleted product returns 404 Not Found",
            JSON.stringify(resGetDeleted.body)
        );

        // 17. Final cleanup of test data
        console.log("\nStep 17: Final cleanup of test data");
        await apiRequest("DELETE", `/api/products/${product2Id}`);
        await pool.query("DELETE FROM categories WHERE id = ?", [testCategoryId]);
        const [remainingProducts] = await pool.query("SELECT id FROM products WHERE id IN (?, ?)", [product1Id, product2Id]);
        assert(
            remainingProducts.length === 0,
            "Test products cleanly removed from database",
            `Remaining count: ${remainingProducts.length}`
        );

        console.log("\n=================================================");
        console.log(`  VERIFICATION COMPLETE: ${testsPassed} passed, ${testsFailed} failed`);
        console.log("=================================================\n");
    } catch (err) {
        console.error("\n*** VERIFICATION FAILED ***", err.message);
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
