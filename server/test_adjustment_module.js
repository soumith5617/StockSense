process.env.NODE_ENV = "test";
require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Inventory Adjustments Verification Test Suite
 * Tests 39 comprehensive scenarios covering authentication, validation,
 * draft calculation, re-calculation on edit, cancellation, negative/positive/zero
 * adjustments, authoritative stock row locking, preventing stale overwrites,
 * transaction rollbacks, and cleanup.
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
        console.log("  StockSense Inventory Adjustments Verification");
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

        const userEmail = `adjustment.auditor.${Date.now()}@stocksense.test`;
        const resUser = await apiRequest("POST", "/api/auth/register", {
            name: "Inventory Audit Specialist",
            email: userEmail,
            password: "SecurePassword123!"
        });
        const testUserId = resUser.body.data.id;

        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "SecurePassword123!"
        });
        const authToken = resLogin.body.token;

        const whCode = `WH-ADJ-${Date.now()}`;
        const resWh = await apiRequest("POST", "/api/warehouses", {
            name: "Phoenix Regional Warehouse",
            code: whCode
        });
        const testWhId = resWh.body.data.id;

        const resLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Main Storage Bin A1",
            code: `BIN-A1-${Date.now()}`
        });
        const testLocId = resLoc.body.data.id;

        const resProd1 = await apiRequest("POST", "/api/products", {
            name: "Precision Micro Bearing",
            sku: `SKU-BEAR-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 25
        });
        const testProd1Id = resProd1.body.productId;

        const resProd2 = await apiRequest("POST", "/api/products", {
            name: "Thermal Conductive Paste 50g",
            sku: `SKU-PASTE-${Date.now()}`,
            unit_of_measure: "tubes",
            reorder_level: 10
        });
        const testProd2Id = resProd2.body.productId;

        // Initialize stock: Product 1 = 100 pcs, Product 2 = 50 tubes
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

        // 2. Unauthenticated adjustment creation rejected
        console.log("\nStep 2: Unauthenticated adjustment creation rejected");
        const resNoAuth = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, counted_quantity: 97 }]
        });
        assert(
            resNoAuth.status === 401 && resNoAuth.body.success === false,
            "POST /api/adjustments without Bearer token rejected with 401 Unauthorized",
            JSON.stringify(resNoAuth.body)
        );

        // 3. Invalid location rejected
        console.log("\nStep 3: Invalid location rejected");
        const resBadLoc = await apiRequest("POST", "/api/adjustments", {
            location_id: 999999,
            items: [{ product_id: testProd1Id, counted_quantity: 97 }]
        }, authToken);
        assert(
            resBadLoc.status === 400 && resBadLoc.body.message.includes("Location with ID"),
            "POST /api/adjustments with non-existent location rejected with 400",
            JSON.stringify(resBadLoc.body)
        );

        // 4. Empty items rejected
        console.log("\nStep 4: Empty items rejected");
        const resEmptyItems = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            items: []
        }, authToken);
        assert(
            resEmptyItems.status === 400 && resEmptyItems.body.message.includes("at least one item"),
            "POST /api/adjustments with empty items array rejected with 400",
            JSON.stringify(resEmptyItems.body)
        );

        // 5. Invalid product rejected
        console.log("\nStep 5: Invalid product rejected");
        const resBadProd = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            items: [{ product_id: 999999, counted_quantity: 97 }]
        }, authToken);
        assert(
            resBadProd.status === 400 && resBadProd.body.message.includes("does not exist"),
            "POST /api/adjustments with non-existent product rejected with 400",
            JSON.stringify(resBadProd.body)
        );

        // 6. Negative counted quantity rejected
        console.log("\nStep 6: Negative counted quantity rejected");
        const resNegCount = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, counted_quantity: -5 }]
        }, authToken);
        assert(
            resNegCount.status === 400 && resNegCount.body.message.includes("non-negative"),
            "POST /api/adjustments with negative counted quantity rejected with 400",
            JSON.stringify(resNegCount.body)
        );

        // 7. Valid adjustment creation
        console.log("\nStep 7: Valid adjustment creation");
        const resCreate = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            reason: "Annual Cycle Count Audit",
            items: [
                { product_id: testProd1Id, counted_quantity: 97 }
            ]
        }, authToken);
        assert(
            resCreate.status === 201 && resCreate.body.success === true && resCreate.body.data.id > 0,
            "POST /api/adjustments creates adjustment with 201 Created",
            JSON.stringify(resCreate.body)
        );
        const adj1Id = resCreate.body.data.id;

        // 8. created_by comes from JWT
        console.log("\nStep 8: created_by securely assigned from JWT");
        assert(
            resCreate.body.data.created_by === testUserId,
            "Adjustment created_by matches authenticated user ID",
            `Created by: ${resCreate.body.data.created_by}, expected: ${testUserId}`
        );

        // 9. Adjustment number generated
        console.log("\nStep 9: Auto-generated adjustment number");
        assert(
            typeof resCreate.body.data.adjustment_number === "string" && resCreate.body.data.adjustment_number.startsWith("ADJ-"),
            "Adjustment number automatically generated with 'ADJ-' prefix",
            `Adjustment number: ${resCreate.body.data.adjustment_number}`
        );

        // 10. system_quantity captured correctly
        console.log("\nStep 10: system_quantity captured correctly");
        const item1 = resCreate.body.data.items[0];
        assert(
            Number(item1.system_quantity) === 100,
            "system_quantity captured correctly as 100.00",
            `system_quantity: ${item1.system_quantity}`
        );

        // 11. difference calculated correctly
        console.log("\nStep 11: difference calculated correctly");
        assert(
            Number(item1.difference) === -3,
            "difference calculated correctly (97 - 100 = -3)",
            `difference: ${item1.difference}`
        );

        // 12. Get all adjustments
        console.log("\nStep 12: Get all adjustments");
        const resGetAll = await apiRequest("GET", "/api/adjustments", null, authToken);
        assert(
            resGetAll.status === 200 && Array.isArray(resGetAll.body.data) && resGetAll.body.data.length > 0,
            "GET /api/adjustments returns 200 with adjustment list",
            `Count: ${resGetAll.body.data?.length}`
        );

        // 13. Get adjustment by ID
        console.log(`\nStep 13: Get adjustment by ID (${adj1Id})`);
        const resGetById = await apiRequest("GET", `/api/adjustments/${adj1Id}`, null, authToken);
        assert(
            resGetById.status === 200 &&
            resGetById.body.data.id === adj1Id &&
            resGetById.body.data.location_id === testLocId,
            "GET /api/adjustments/:id returns 200 with matching header details",
            JSON.stringify(resGetById.body)
        );

        // 14. Adjustment items returned correctly
        console.log("\nStep 14: Adjustment items returned with product details");
        assert(
            Array.isArray(resGetById.body.data.items) &&
            resGetById.body.data.items.length === 1 &&
            resGetById.body.data.items[0].product_name !== undefined,
            "Adjustment response includes items with joined product details",
            `Items count: ${resGetById.body.data.items?.length}`
        );

        // 15. Draft update works
        console.log("\nStep 15: Draft update works");
        const resUpdateDraft = await apiRequest("PUT", `/api/adjustments/${adj1Id}`, {
            location_id: testLocId,
            reason: "Updated physical recount count",
            items: [
                { product_id: testProd1Id, counted_quantity: 95 }
            ]
        }, authToken);
        assert(
            resUpdateDraft.status === 200 && resUpdateDraft.body.success === true,
            "PUT /api/adjustments/:id successfully updates draft adjustment",
            JSON.stringify(resUpdateDraft.body)
        );

        // 16. Update recalculates system_quantity/difference
        console.log("\nStep 16: Update recalculates system_quantity/difference");
        const updatedItem = resUpdateDraft.body.data.items[0];
        assert(
            Number(updatedItem.counted_quantity) === 95 &&
            Number(updatedItem.system_quantity) === 100 &&
            Number(updatedItem.difference) === -5,
            "Update recalculates system_quantity (100) and difference (95 - 100 = -5)",
            `Count: ${updatedItem.counted_quantity}, Diff: ${updatedItem.difference}`
        );

        // 17. Canceled adjustment cannot be edited
        console.log("\nStep 17: Canceled adjustment cannot be edited");
        const resCancelDraft = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            items: [{ product_id: testProd2Id, counted_quantity: 48 }]
        }, authToken);
        const cancelAdjId = resCancelDraft.body.data.id;
        await apiRequest("POST", `/api/adjustments/${cancelAdjId}/cancel`, null, authToken);

        const resEditCanceled = await apiRequest("PUT", `/api/adjustments/${cancelAdjId}`, {
            location_id: testLocId,
            items: [{ product_id: testProd2Id, counted_quantity: 49 }]
        }, authToken);
        assert(
            resEditCanceled.status === 400 && resEditCanceled.body.success === false,
            "PUT /api/adjustments/:id on canceled adjustment rejected with 400 Bad Request",
            JSON.stringify(resEditCanceled.body)
        );

        // 18. Canceled adjustment cannot be validated
        console.log("\nStep 18: Canceled adjustment cannot be validated");
        const resValidateCanceled = await apiRequest("POST", `/api/adjustments/${cancelAdjId}/validate`, null, authToken);
        assert(
            resValidateCanceled.status === 409 && resValidateCanceled.body.success === false,
            "POST /api/adjustments/:id/validate on canceled adjustment rejected with 409 Conflict",
            JSON.stringify(resValidateCanceled.body)
        );

        // 19. Successful negative adjustment
        console.log(`\nStep 19: Successful negative adjustment (Adjustment ${adj1Id})`);
        const resValidateAdj1 = await apiRequest("POST", `/api/adjustments/${adj1Id}/validate`, null, authToken);
        assert(
            resValidateAdj1.status === 200 && resValidateAdj1.body.success === true,
            "POST /api/adjustments/:id/validate returns 200 OK for negative adjustment",
            JSON.stringify(resValidateAdj1.body)
        );

        // 20. Stock becomes exact counted quantity
        console.log("\nStep 20: Stock becomes exact counted quantity");
        const [stockP1AfterAdj1] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        assert(
            Number(stockP1AfterAdj1[0].quantity) === 95,
            "Stock quantity accurately updated to exact physical count (95.00)",
            `Stock quantity: ${stockP1AfterAdj1[0]?.quantity}`
        );

        // 21. Negative adjustment ledger created
        console.log("\nStep 21: Negative adjustment ledger created");
        const [ledgerAdj1] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'adjustment'",
            [adj1Id]
        );
        assert(
            ledgerAdj1.length === 1,
            "Stock ledger record created with movement_type 'adjustment'",
            `Ledger count: ${ledgerAdj1.length}`
        );

        // 22. Ledger quantity_change correct
        console.log("\nStep 22: Ledger quantity_change correct");
        assert(
            Number(ledgerAdj1[0].quantity_change) === -5,
            "Ledger quantity_change correctly records negative adjustment (-5.00)",
            `quantity_change: ${ledgerAdj1[0]?.quantity_change}`
        );

        // 23. Ledger balance_after correct
        console.log("\nStep 23: Ledger balance_after correct");
        assert(
            Number(ledgerAdj1[0].balance_after) === 95,
            "Ledger balance_after correctly records snapshot balance (95.00)",
            `balance_after: ${ledgerAdj1[0]?.balance_after}`
        );

        // 24. Successful positive adjustment
        console.log("\nStep 24: Successful positive adjustment");
        // Current stock is 95. We count 103 (difference = +8).
        const resPosAdj = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            reason: "Found unrecorded carton",
            items: [{ product_id: testProd1Id, counted_quantity: 103 }]
        }, authToken);
        const posAdjId = resPosAdj.body.data.id;

        const resValidatePos = await apiRequest("POST", `/api/adjustments/${posAdjId}/validate`, null, authToken);
        assert(
            resValidatePos.status === 200 && resValidatePos.body.success === true,
            "POST /api/adjustments/:id/validate returns 200 OK for positive adjustment",
            JSON.stringify(resValidatePos.body)
        );

        // 25. Stock increases to exact counted quantity
        console.log("\nStep 25: Stock increases to exact counted quantity");
        const [stockP1AfterPos] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        assert(
            Number(stockP1AfterPos[0].quantity) === 103,
            "Stock quantity increased to exact physical count (103.00)",
            `Stock quantity: ${stockP1AfterPos[0]?.quantity}`
        );

        // 26. Positive adjustment ledger created
        console.log("\nStep 26: Positive adjustment ledger created");
        const [ledgerPos] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'adjustment'",
            [posAdjId]
        );
        assert(
            ledgerPos.length === 1 &&
            Number(ledgerPos[0].quantity_change) === 8 &&
            Number(ledgerPos[0].balance_after) === 103,
            "Positive adjustment ledger created with quantity_change = +8 and balance_after = 103",
            `Change: ${ledgerPos[0]?.quantity_change}, Balance: ${ledgerPos[0]?.balance_after}`
        );

        // 27. Zero-difference adjustment succeeds
        console.log("\nStep 27: Zero-difference adjustment succeeds");
        // Current stock is 103. We count exactly 103 (difference = 0).
        const resZeroAdj = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            reason: "Confirmed accurate physical inventory",
            items: [{ product_id: testProd1Id, counted_quantity: 103 }]
        }, authToken);
        const zeroAdjId = resZeroAdj.body.data.id;

        const resValidateZero = await apiRequest("POST", `/api/adjustments/${zeroAdjId}/validate`, null, authToken);
        assert(
            resValidateZero.status === 200 && resValidateZero.body.success === true,
            "POST /api/adjustments/:id/validate returns 200 OK for zero-difference adjustment",
            JSON.stringify(resValidateZero.body)
        );

        // 28. Zero-difference adjustment creates NO ledger entry
        console.log("\nStep 28: Zero-difference adjustment creates NO ledger entry");
        const [ledgerZero] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'adjustment'",
            [zeroAdjId]
        );
        assert(
            ledgerZero.length === 0,
            "Zero-difference adjustment creates NO unnecessary stock_ledger entry",
            `Ledger count: ${ledgerZero.length}`
        );

        // 29. Adjustment becomes done
        console.log("\nStep 29: Adjustment becomes done");
        const [adj1StatusCheck] = await pool.query("SELECT status FROM adjustments WHERE id = ?", [adj1Id]);
        assert(
            adj1StatusCheck[0].status === "done",
            "Adjustment status updated to 'done' after successful validation",
            `Status: ${adj1StatusCheck[0]?.status}`
        );

        // 30. Second validation rejected
        console.log("\nStep 30: Second validation rejected");
        const resSecondValidate = await apiRequest("POST", `/api/adjustments/${adj1Id}/validate`, null, authToken);
        assert(
            resSecondValidate.status === 409 && resSecondValidate.body.success === false,
            "Second validation on a done adjustment rejected with 409 Conflict",
            JSON.stringify(resSecondValidate.body)
        );

        // 31. Done adjustment cannot be edited
        console.log("\nStep 31: Done adjustment cannot be edited");
        const resEditDone = await apiRequest("PUT", `/api/adjustments/${adj1Id}`, {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, counted_quantity: 90 }]
        }, authToken);
        assert(
            resEditDone.status === 400 && resEditDone.body.success === false,
            "PUT /api/adjustments/:id on completed adjustment rejected with 400 Bad Request",
            JSON.stringify(resEditDone.body)
        );

        // 32. Done adjustment cannot be canceled
        console.log("\nStep 32: Done adjustment cannot be canceled");
        const resCancelDone = await apiRequest("POST", `/api/adjustments/${adj1Id}/cancel`, null, authToken);
        assert(
            resCancelDone.status === 409 && resCancelDone.body.success === false,
            "POST /api/adjustments/:id/cancel on completed adjustment rejected with 409 Conflict",
            JSON.stringify(resCancelDone.body)
        );

        // 33. Stale system_quantity is not blindly trusted
        console.log("\nStep 33: Stale system_quantity is not blindly trusted");
        // Current stock is 103. Create draft counting 90.
        // Draft system_quantity is recorded as 103, difference = -13.
        const resStaleDraft = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            reason: "Audit draft prior to intervening movement",
            items: [{ product_id: testProd1Id, counted_quantity: 90 }]
        }, authToken);
        const staleAdjId = resStaleDraft.body.data.id;

        // Simulate an intervening inventory movement that updates stock from 103 to 120
        await pool.query(
            "UPDATE stock SET quantity = 120 WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );

        // Validate the draft adjustment that had draft system_quantity = 103
        const resValidateStale = await apiRequest("POST", `/api/adjustments/${staleAdjId}/validate`, null, authToken);
        assert(
            resValidateStale.status === 200 && resValidateStale.body.success === true,
            "Validation succeeds by re-evaluating live locked stock",
            JSON.stringify(resValidateStale.body)
        );

        // 34. Validation uses current locked stock
        console.log("\nStep 34: Validation uses current locked stock");
        // Stock must now be 90.
        // Difference must have been calculated as 90 - 120 = -30 (NOT 90 - 103 = -13!).
        const [stockAfterStale] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        const [ledgerStale] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'adjustment'",
            [staleAdjId]
        );
        assert(
            Number(stockAfterStale[0].quantity) === 90 &&
            Number(ledgerStale[0].quantity_change) === -30 &&
            Number(ledgerStale[0].balance_after) === 90,
            "Validation locked live stock (120) and correctly applied actual difference (-30.00)",
            `Stock: ${stockAfterStale[0]?.quantity}, Ledger Change: ${ledgerStale[0]?.quantity_change}`
        );

        // 35. Transaction rollback with simulated failure
        console.log("\nStep 35: Transaction rollback with simulated failure");
        const resRollbackAdj = await apiRequest("POST", "/api/adjustments", {
            location_id: testLocId,
            reason: "Rollback Test Audit",
            items: [{ product_id: testProd1Id, counted_quantity: 75 }]
        }, authToken);
        const rollbackAdjId = resRollbackAdj.body.data.id;

        const resSimulateFail = await apiRequest(
            "POST",
            `/api/adjustments/${rollbackAdjId}/validate`,
            null,
            authToken,
            { "x-simulate-failure": "true" }
        );
        assert(
            resSimulateFail.status === 500 && resSimulateFail.body.success === false,
            "Simulated validation failure caught and returned 500 response",
            JSON.stringify(resSimulateFail.body)
        );

        // 36. Rollback leaves stock unchanged
        console.log("\nStep 36: Rollback leaves stock unchanged");
        const [stockRollbackCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, testLocId]
        );
        assert(
            Number(stockRollbackCheck[0].quantity) === 90,
            "Stock quantity remains 90.00 (not modified to 75) after rollback",
            `Stock quantity: ${stockRollbackCheck[0]?.quantity}`
        );

        // 37. Rollback leaves ledger unchanged
        console.log("\nStep 37: Rollback leaves ledger unchanged");
        const [ledgerRollbackCheck] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ?",
            [rollbackAdjId]
        );
        assert(
            ledgerRollbackCheck.length === 0,
            "Zero stock_ledger entries created for rolled back adjustment",
            `Ledger count: ${ledgerRollbackCheck.length}`
        );

        // 38. Rollback leaves adjustment status unchanged
        console.log("\nStep 38: Rollback leaves adjustment status unchanged");
        const [adjRollbackStatusCheck] = await pool.query(
            "SELECT status FROM adjustments WHERE id = ?",
            [rollbackAdjId]
        );
        assert(
            adjRollbackStatusCheck[0].status === "draft",
            "Adjustment status remains 'draft' (not marked 'done') after rollback",
            `Status: ${adjRollbackStatusCheck[0]?.status}`
        );

        // 39. Temporary test data cleanup
        console.log("\nStep 39: Temporary test data cleanup");
        const allTestAdjustmentIds = [adj1Id, cancelAdjId, posAdjId, zeroAdjId, staleAdjId, rollbackAdjId];

        await pool.query("DELETE FROM stock_ledger WHERE reference_id IN (?)", [allTestAdjustmentIds]);
        await pool.query("DELETE FROM adjustment_items WHERE adjustment_id IN (?)", [allTestAdjustmentIds]);
        await pool.query("DELETE FROM adjustments WHERE id IN (?)", [allTestAdjustmentIds]);
        await pool.query("DELETE FROM stock WHERE location_id = ?", [testLocId]);
        await pool.query("DELETE FROM locations WHERE id = ?", [testLocId]);
        await pool.query("DELETE FROM warehouses WHERE id = ?", [testWhId]);
        await pool.query("DELETE FROM products WHERE id IN (?, ?)", [testProd1Id, testProd2Id]);
        await pool.query("DELETE FROM users WHERE id = ?", [testUserId]);

        const [remAdjs] = await pool.query("SELECT id FROM adjustments WHERE id IN (?)", [allTestAdjustmentIds]);
        const [remStock] = await pool.query("SELECT id FROM stock WHERE location_id = ?", [testLocId]);
        assert(
            remAdjs.length === 0 && remStock.length === 0,
            "All test adjustments, items, stock, and ledger entries successfully cleaned up",
            `Remaining adjustments: ${remAdjs.length}, Stock: ${remStock.length}`
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
