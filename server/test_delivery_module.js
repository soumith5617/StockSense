process.env.NODE_ENV = "test";
require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Delivery / Outgoing Stock Verification Test Suite
 * Tests 32 comprehensive scenarios covering authentication, validation,
 * status transitions, atomic stock deductions, negative ledger entries,
 * insufficient stock protections, transaction rollbacks, and cleanup.
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
        console.log("  StockSense Delivery / Outgoing Stock Verification");
        console.log("=================================================\n");

        // Start temporary HTTP test server on an ephemeral port
        server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;
        console.log(`Temporary test server running on ${baseUrl}\n`);

        const apiRequest = async (method, endpoint, body = null, token = null, headers = {}) => {
            const options = {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...headers
                }
            };
            if (token) {
                options.headers["Authorization"] = `Bearer ${token}`;
            }
            if (body !== null) {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(`${baseUrl}${endpoint}`, options);
            const data = await res.json();
            return { status: res.status, body: data };
        };

        // ==================== SETUP TEST CONTEXT ====================
        console.log("Setup: Registering authenticated user, warehouse, location, products, and initial stock...");

        const userEmail = `delivery.officer.${Date.now()}@stocksense.test`;
        const resUser = await apiRequest("POST", "/api/auth/register", {
            name: "Outbound Logistics Specialist",
            email: userEmail,
            password: "SecurePassword123!"
        });
        const testUserId = resUser.body.data.id;

        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "SecurePassword123!"
        });
        const authToken = resLogin.body.token;

        const whCode = `WH-DEL-${Date.now()}`;
        const resWh = await apiRequest("POST", "/api/warehouses", {
            name: "Dallas Outbound Hub",
            code: whCode
        });
        const testWhId = resWh.body.data.id;

        const resLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Dispatch Bay A",
            code: "DISP-BAY-A"
        });
        const testLocId = resLoc.body.data.id;

        const resProd1 = await apiRequest("POST", "/api/products", {
            name: "Industrial Packaging Tape",
            sku: `SKU-TAPE-${Date.now()}`,
            unit_of_measure: "rolls",
            reorder_level: 25
        });
        const testProd1Id = resProd1.body.productId;

        const resProd2 = await apiRequest("POST", "/api/products", {
            name: "Corrugated Shipping Box XL",
            sku: `SKU-BOXXL-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 50
        });
        const testProd2Id = resProd2.body.productId;

        // Populate initial stock for testing outgoing deductions
        // Product 1: 100 rolls, Product 2: 50 boxes
        await pool.query(
            "INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?), (?, ?, ?)",
            [testProd1Id, testLocId, 100, testProd2Id, testLocId, 50]
        );

        console.log(`Context ready: User ${testUserId}, Warehouse ${testWhId}, Location ${testLocId}, Initial Stock [P1: 100, P2: 50]\n`);

        // ==================== TEST STEPS ====================

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with status message",
            JSON.stringify(resHealth.body)
        );

        // 2. Unauthenticated delivery creation rejected
        console.log("\nStep 2: Unauthenticated delivery creation rejected");
        const resNoAuth = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        });
        assert(
            resNoAuth.status === 401 && resNoAuth.body.success === false,
            "POST /api/deliveries without Bearer token rejected with 401 Unauthorized",
            JSON.stringify(resNoAuth.body)
        );

        // 3. Invalid location rejected
        console.log("\nStep 3: Invalid location rejected");
        const resBadLoc = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: 999999,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resBadLoc.status === 400 && resBadLoc.body.success === false,
            "POST /api/deliveries with non-existent location rejected with 400",
            JSON.stringify(resBadLoc.body)
        );

        // 4. Empty items rejected
        console.log("\nStep 4: Empty items rejected");
        const resEmptyItems = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: testLocId,
            items: []
        }, authToken);
        assert(
            resEmptyItems.status === 400 && resEmptyItems.body.success === false,
            "POST /api/deliveries with empty items array rejected with 400",
            JSON.stringify(resEmptyItems.body)
        );

        // 5. Invalid product rejected
        console.log("\nStep 5: Invalid product rejected");
        const resBadProd = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: testLocId,
            items: [{ product_id: 999999, quantity: 10 }]
        }, authToken);
        assert(
            resBadProd.status === 400 && resBadProd.body.success === false,
            "POST /api/deliveries with non-existent product rejected with 400",
            JSON.stringify(resBadProd.body)
        );

        // 6. Zero quantity rejected
        console.log("\nStep 6: Zero quantity rejected");
        const resZeroQty = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 0 }]
        }, authToken);
        assert(
            resZeroQty.status === 400 && resZeroQty.body.success === false,
            "POST /api/deliveries with quantity = 0 rejected with 400",
            JSON.stringify(resZeroQty.body)
        );

        // 7. Negative quantity rejected
        console.log("\nStep 7: Negative quantity rejected");
        const resNegQty = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Acme Corp",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: -15 }]
        }, authToken);
        assert(
            resNegQty.status === 400 && resNegQty.body.success === false,
            "POST /api/deliveries with negative quantity rejected with 400",
            JSON.stringify(resNegQty.body)
        );

        // 8. Valid delivery creation
        console.log("\nStep 8: Valid delivery creation");
        const resCreateDel1 = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Apex Retail Solutions",
            location_id: testLocId,
            items: [
                { product_id: testProd1Id, quantity: 20 },
                { product_id: testProd2Id, quantity: 15 }
            ]
        }, authToken);
        assert(
            resCreateDel1.status === 201 && resCreateDel1.body.success === true && resCreateDel1.body.data.id > 0,
            "POST /api/deliveries creates delivery with 201 Created",
            JSON.stringify(resCreateDel1.body)
        );
        const del1 = resCreateDel1.body.data;
        const del1Id = del1.id;

        // 9. created_by comes from JWT
        console.log("\nStep 9: created_by securely assigned from JWT");
        assert(
            del1.created_by === testUserId,
            "Delivery created_by matches authenticated user ID",
            `created_by: ${del1.created_by}, expected: ${testUserId}`
        );

        // 10. Delivery number generated safely
        console.log("\nStep 10: Auto-generated delivery number");
        assert(
            del1.delivery_number && del1.delivery_number.startsWith("DEL-"),
            "Delivery number automatically generated with 'DEL-' prefix",
            `delivery_number: ${del1.delivery_number}`
        );

        // 11. Get all deliveries
        console.log("\nStep 11: Get all deliveries");
        const resGetAllDel = await apiRequest("GET", "/api/deliveries", null, authToken);
        assert(
            resGetAllDel.status === 200 && Array.isArray(resGetAllDel.body.data) && resGetAllDel.body.data.length >= 1,
            "GET /api/deliveries returns 200 with delivery summary list",
            `Count: ${resGetAllDel.body.data?.length}`
        );

        // 12. Get delivery by ID
        console.log(`\nStep 12: Get delivery by ID (${del1Id})`);
        const resGetDel1 = await apiRequest("GET", `/api/deliveries/${del1Id}`, null, authToken);
        assert(
            resGetDel1.status === 200 && resGetDel1.body.data.customer_name === "Apex Retail Solutions",
            `GET /api/deliveries/${del1Id} returns 200 with matching header details`,
            JSON.stringify(resGetDel1.body.data)
        );

        // 13. Delivery items returned
        console.log("\nStep 13: Delivery items returned with product details");
        const delItems = resGetDel1.body.data.items;
        assert(
            Array.isArray(delItems) && delItems.length === 2 && delItems[0].product_name && delItems[0].product_sku,
            "Delivery response includes line items with joined product details",
            JSON.stringify(delItems)
        );

        // 14. Draft -> ready transition
        console.log("\nStep 14: Draft -> ready transition");
        const resUpdateDel1 = await apiRequest("PUT", `/api/deliveries/${del1Id}`, {
            status: "ready",
            customer_name: "Apex Retail Solutions Inc.",
            location_id: testLocId,
            items: [
                { product_id: testProd1Id, quantity: 20 },
                { product_id: testProd2Id, quantity: 15 }
            ]
        }, authToken);
        assert(
            resUpdateDel1.status === 200 && resUpdateDel1.body.data.status === "ready",
            "PUT /api/deliveries/:id successfully transitions status to 'ready'",
            `Status: ${resUpdateDel1.body.data.status}`
        );

        // 15. Validate delivery successfully
        console.log(`\nStep 15: Validate delivery successfully (Delivery ${del1Id})`);
        const resValidateDel1 = await apiRequest("POST", `/api/deliveries/${del1Id}/validate`, null, authToken);
        assert(
            resValidateDel1.status === 200 && resValidateDel1.body.success === true,
            "POST /api/deliveries/:id/validate returns 200 OK",
            JSON.stringify(resValidateDel1.body)
        );

        // 16. Existing stock decreases correctly
        console.log("\nStep 16: Existing stock decreases correctly");
        const [stockP1After] = await pool.query("SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?", [testProd1Id, testLocId]);
        const [stockP2After] = await pool.query("SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?", [testProd2Id, testLocId]);
        assert(
            Number(stockP1After[0].quantity) === 80 && Number(stockP2After[0].quantity) === 35,
            "Stock rows accurately decreased (P1: 100 - 20 = 80, P2: 50 - 15 = 35)",
            `P1: ${stockP1After[0]?.quantity}, P2: ${stockP2After[0]?.quantity}`
        );

        // 17. Stock never becomes negative
        console.log("\nStep 17: Stock never becomes negative");
        assert(
            Number(stockP1After[0].quantity) >= 0 && Number(stockP2After[0].quantity) >= 0,
            "Both stock balances remain strictly non-negative",
            `P1: ${stockP1After[0]?.quantity}, P2: ${stockP2After[0]?.quantity}`
        );

        // 18. Delivery ledger entry created
        console.log("\nStep 18: Delivery ledger entry created");
        const [ledgerEntries] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'delivery' ORDER BY id ASC",
            [del1Id]
        );
        assert(
            ledgerEntries.length === 2 && ledgerEntries[0].created_by === testUserId,
            "Stock ledger records created with movement_type 'delivery' and authenticated user ID",
            JSON.stringify(ledgerEntries)
        );

        // 19. Ledger quantity_change is negative
        console.log("\nStep 19: Ledger quantity_change is negative");
        assert(
            Number(ledgerEntries[0].quantity_change) === -20 && Number(ledgerEntries[1].quantity_change) === -15,
            "Ledger quantity_change records negative delivery amounts (-20, -15)",
            `Changes: [${ledgerEntries[0].quantity_change}, ${ledgerEntries[1].quantity_change}]`
        );

        // 20. Ledger balance_after is correct
        console.log("\nStep 20: Ledger balance_after is correct");
        assert(
            Number(ledgerEntries[0].balance_after) === 80 && Number(ledgerEntries[1].balance_after) === 35,
            "Ledger balance_after matches final stock balance snapshots (80, 35)",
            `Balances: [${ledgerEntries[0].balance_after}, ${ledgerEntries[1].balance_after}]`
        );

        // 21. Delivery becomes done
        console.log("\nStep 21: Delivery becomes done");
        const resGetDoneDel = await apiRequest("GET", `/api/deliveries/${del1Id}`, null, authToken);
        assert(
            resGetDoneDel.body.data.status === "done",
            "Delivery status updated to 'done' after successful validation",
            `Status: ${resGetDoneDel.body.data.status}`
        );

        // 22. Second validation rejected
        console.log("\nStep 22: Second validation rejected");
        const resSecondValidate = await apiRequest("POST", `/api/deliveries/${del1Id}/validate`, null, authToken);
        assert(
            resSecondValidate.status === 409 && resSecondValidate.body.success === false,
            "Second validation on a done delivery rejected with 409 Conflict",
            JSON.stringify(resSecondValidate.body)
        );

        // 23. Done delivery cannot be edited
        console.log("\nStep 23: Done delivery cannot be edited");
        const resEditDone = await apiRequest("PUT", `/api/deliveries/${del1Id}`, {
            customer_name: "Illegal Edit",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resEditDone.status === 400 && resEditDone.body.success === false,
            "PUT /api/deliveries/:id on completed delivery rejected with 400 Bad Request",
            JSON.stringify(resEditDone.body)
        );

        // 24. Canceled delivery cannot be validated
        console.log("\nStep 24: Canceled delivery cannot be validated");
        const resDelCancel = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Cancelled Customer Order",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 5 }]
        }, authToken);
        const cancelDelId = resDelCancel.body.data.id;

        await apiRequest("POST", `/api/deliveries/${cancelDelId}/cancel`, null, authToken);

        const resValidateCanceled = await apiRequest("POST", `/api/deliveries/${cancelDelId}/validate`, null, authToken);
        assert(
            resValidateCanceled.status === 409 && resValidateCanceled.body.success === false,
            "POST /api/deliveries/:id/validate on canceled delivery rejected with 409 Conflict",
            JSON.stringify(resValidateCanceled.body)
        );

        // 25. Insufficient stock rejected
        console.log("\nStep 25: Insufficient stock rejected");
        // Product 1 available is 80, request 200
        const resDelExcess = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Bulk Overbuyer Inc.",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 200 }]
        }, authToken);
        const excessDelId = resDelExcess.body.data.id;

        const resValidateExcess = await apiRequest("POST", `/api/deliveries/${excessDelId}/validate`, null, authToken);
        assert(
            resValidateExcess.status === 409 && resValidateExcess.body.success === false,
            "Validation rejected with 409 Conflict when requested quantity exceeds available stock",
            JSON.stringify(resValidateExcess.body)
        );

        // 26. Insufficient-stock attempt does not change stock
        console.log("\nStep 26: Insufficient-stock attempt does not change stock");
        const [stockP1ExcessCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        assert(
            Number(stockP1ExcessCheck[0].quantity) === 80,
            "Stock quantity untouched at 80.00 after rejected excess delivery",
            `Current quantity: ${stockP1ExcessCheck[0].quantity}`
        );

        // 27. Insufficient-stock attempt creates no ledger
        console.log("\nStep 27: Insufficient-stock attempt creates no ledger");
        const [ledgerExcessCheck] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'delivery'",
            [excessDelId]
        );
        assert(
            ledgerExcessCheck.length === 0,
            "Zero stock_ledger entries created for rejected excess delivery",
            `Ledger count: ${ledgerExcessCheck.length}`
        );

        // 28. Transaction rollback test
        console.log("\nStep 28: Transaction rollback test with simulated failure");
        const resDelRollback = await apiRequest("POST", "/api/deliveries", {
            customer_name: "Rollback Test Order",
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        const rollbackDelId = resDelRollback.body.data.id;

        const resSimulateFail = await apiRequest(
            "POST",
            `/api/deliveries/${rollbackDelId}/validate`,
            null,
            authToken,
            { "x-simulate-failure": "true" }
        );
        assert(
            resSimulateFail.status === 500 && resSimulateFail.body.success === false,
            "Simulated validation failure caught and returned 500 response",
            JSON.stringify(resSimulateFail.body)
        );

        // 29. Rollback leaves delivery status unchanged
        console.log("\nStep 29: Rollback leaves delivery status unchanged");
        const [delRollbackCheck] = await pool.query("SELECT status FROM deliveries WHERE id = ?", [rollbackDelId]);
        assert(
            delRollbackCheck[0].status === "draft",
            "Delivery status remains 'draft' (not marked 'done') after transaction rollback",
            `Status: ${delRollbackCheck[0].status}`
        );

        // 30. Rollback leaves stock unchanged
        console.log("\nStep 30: Rollback leaves stock unchanged");
        const [stockP1RollbackCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        assert(
            Number(stockP1RollbackCheck[0].quantity) === 80,
            "Stock quantity remains 80.00 (not deducted to 70) after rollback",
            `Current quantity: ${stockP1RollbackCheck[0].quantity}`
        );

        // 31. Rollback leaves ledger unchanged
        console.log("\nStep 31: Rollback leaves ledger unchanged");
        const [ledgerRollbackCheck] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'delivery'",
            [rollbackDelId]
        );
        assert(
            ledgerRollbackCheck.length === 0,
            "Zero stock_ledger entries created for rolled back delivery",
            `Ledger count: ${ledgerRollbackCheck.length}`
        );

        // 32. Temporary test data cleanup
        console.log("\nStep 32: Temporary test data cleanup");
        const allTestDeliveryIds = [del1Id, cancelDelId, excessDelId, rollbackDelId];

        await pool.query("DELETE FROM stock_ledger WHERE reference_id IN (?) AND movement_type = 'delivery'", [allTestDeliveryIds]);
        await pool.query("DELETE FROM delivery_items WHERE delivery_id IN (?)", [allTestDeliveryIds]);
        await pool.query("DELETE FROM deliveries WHERE id IN (?)", [allTestDeliveryIds]);
        await pool.query("DELETE FROM stock WHERE location_id = ?", [testLocId]);
        await pool.query("DELETE FROM locations WHERE id = ?", [testLocId]);
        await pool.query("DELETE FROM warehouses WHERE id = ?", [testWhId]);
        await pool.query("DELETE FROM products WHERE id IN (?, ?)", [testProd1Id, testProd2Id]);
        await pool.query("DELETE FROM users WHERE id = ?", [testUserId]);

        const [remDels] = await pool.query("SELECT id FROM deliveries WHERE id IN (?)", [allTestDeliveryIds]);
        const [remStock] = await pool.query("SELECT id FROM stock WHERE location_id = ?", [testLocId]);
        assert(
            remDels.length === 0 && remStock.length === 0,
            "All test deliveries, items, stock, and ledger entries successfully cleaned up",
            `Remaining deliveries: ${remDels.length}, Stock: ${remStock.length}`
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
