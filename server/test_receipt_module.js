process.env.NODE_ENV = "test";
require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Supplier Management & Receipt (Incoming Stock) Verification Test Suite
 * Tests 34 comprehensive scenarios covering suppliers, receipts, validations,
 * status transitions, atomic stock/ledger movements, transaction rollback, and cleanup.
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
        console.log("  StockSense Supplier & Receipt Verification");
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
        console.log("Setup: Registering authenticated user, warehouse, location, and products...");
        const userEmail = `receipt.manager.${Date.now()}@stocksense.test`;
        const resUser = await apiRequest("POST", "/api/auth/register", {
            name: "Receipt Operations Manager",
            email: userEmail,
            password: "SecurePassword123!"
        });
        const testUserId = resUser.body.data.id;

        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "SecurePassword123!"
        });
        const authToken = resLogin.body.token;

        const whCode = `WH-REC-${Date.now()}`;
        const resWh = await apiRequest("POST", "/api/warehouses", {
            name: "Receipt Receiving Facility",
            code: whCode
        });
        const testWhId = resWh.body.data.id;

        const resLoc = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Inbound Staging Bay 1",
            code: "IN-BAY-01"
        });
        const testLocId = resLoc.body.data.id;

        const resProd1 = await apiRequest("POST", "/api/products", {
            name: "Thermal Receipt Paper Roll",
            sku: `SKU-ROLL-${Date.now()}`,
            unit_of_measure: "box",
            reorder_level: 20
        });
        const testProd1Id = resProd1.body.productId;

        const resProd2 = await apiRequest("POST", "/api/products", {
            name: "Barcode Scanner Handheld",
            sku: `SKU-SCAN-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 10
        });
        const testProd2Id = resProd2.body.productId;

        console.log(`Context ready: User ${testUserId}, Warehouse ${testWhId}, Location ${testLocId}, Products [${testProd1Id}, ${testProd2Id}]\n`);

        // ==================== PART 1: SUPPLIER TESTS ====================

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with status message",
            JSON.stringify(resHealth.body)
        );

        // 2. Supplier creation
        console.log("\nStep 2: Supplier creation");
        const resCreateSup = await apiRequest("POST", "/api/suppliers", {
            name: "Global Logistics Supplies Co.",
            email: "contact@globallogistics.test",
            phone: "+1-800-555-0199",
            address: "500 Industrial Pkwy, Chicago, IL"
        });
        assert(
            resCreateSup.status === 201 && resCreateSup.body.success === true && resCreateSup.body.data.id > 0,
            "POST /api/suppliers creates supplier with 201 Created",
            JSON.stringify(resCreateSup.body)
        );
        const testSupId = resCreateSup.body.data.id;

        // 3. Supplier validation
        console.log("\nStep 3: Supplier validation");
        const resNoNameSup = await apiRequest("POST", "/api/suppliers", {
            email: "invalid@supplier.test"
        });
        assert(
            resNoNameSup.status === 400 && resNoNameSup.body.success === false,
            "POST /api/suppliers rejects missing name with 400",
            JSON.stringify(resNoNameSup.body)
        );
        const resBadEmailSup = await apiRequest("POST", "/api/suppliers", {
            name: "Faulty Email Vendor",
            email: "not-an-email"
        });
        assert(
            resBadEmailSup.status === 400 && resBadEmailSup.body.success === false,
            "POST /api/suppliers rejects invalid email format with 400",
            JSON.stringify(resBadEmailSup.body)
        );

        // 4. Get suppliers
        console.log("\nStep 4: Get suppliers");
        const resGetSups = await apiRequest("GET", "/api/suppliers");
        assert(
            resGetSups.status === 200 && Array.isArray(resGetSups.body.data) && resGetSups.body.data.length >= 1,
            "GET /api/suppliers returns 200 with supplier array",
            `Count: ${resGetSups.body.data?.length}`
        );

        // 5. Get supplier by ID
        console.log(`\nStep 5: Get supplier by ID (${testSupId})`);
        const resGetSup1 = await apiRequest("GET", `/api/suppliers/${testSupId}`);
        assert(
            resGetSup1.status === 200 && resGetSup1.body.data.name === "Global Logistics Supplies Co.",
            `GET /api/suppliers/${testSupId} returns 200 with matching details`,
            JSON.stringify(resGetSup1.body.data)
        );

        // 6. Update supplier
        console.log(`\nStep 6: Update supplier (${testSupId})`);
        const resUpdateSup = await apiRequest("PUT", `/api/suppliers/${testSupId}`, {
            name: "Global Logistics Supplies International",
            email: "support@globallogistics.test",
            phone: "+1-800-555-0100"
        });
        assert(
            resUpdateSup.status === 200 && resUpdateSup.body.data.name === "Global Logistics Supplies International",
            "PUT /api/suppliers/:id updates supplier with 200",
            JSON.stringify(resUpdateSup.body.data)
        );

        // 7. Supplier deletion protection when referenced
        console.log("\nStep 7: Supplier deletion protection when referenced");
        // Create an initial receipt referencing this supplier
        const resSupRefReceipt = await apiRequest("POST", "/api/receipts", {
            supplier_id: testSupId,
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 15 }]
        }, authToken);
        const supRefReceiptId = resSupRefReceipt.body.data.id;

        const resDeleteSupBlocked = await apiRequest("DELETE", `/api/suppliers/${testSupId}`);
        assert(
            resDeleteSupBlocked.status === 409 && resDeleteSupBlocked.body.success === false,
            "DELETE /api/suppliers/:id blocked with 409 when historical receipts reference it",
            JSON.stringify(resDeleteSupBlocked.body)
        );

        // ==================== PART 2: RECEIPT TESTS ====================

        // 8. Authentication requirement
        console.log("\nStep 8: Authentication requirement for receipts");
        const resNoAuthReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        });
        assert(
            resNoAuthReceipt.status === 401 && resNoAuthReceipt.body.success === false,
            "POST /api/receipts without Bearer token rejected with 401 Unauthorized",
            JSON.stringify(resNoAuthReceipt.body)
        );

        // 9. Invalid location rejection
        console.log("\nStep 9: Invalid location rejection");
        const resBadLocReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: 999999,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resBadLocReceipt.status === 400 && resBadLocReceipt.body.success === false,
            "POST /api/receipts with non-existent location rejected with 400",
            JSON.stringify(resBadLocReceipt.body)
        );

        // 10. Invalid supplier rejection
        console.log("\nStep 10: Invalid supplier rejection");
        const resBadSupReceipt = await apiRequest("POST", "/api/receipts", {
            supplier_id: 999999,
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resBadSupReceipt.status === 400 && resBadSupReceipt.body.success === false,
            "POST /api/receipts with non-existent supplier rejected with 400",
            JSON.stringify(resBadSupReceipt.body)
        );

        // 11. Empty items rejection
        console.log("\nStep 11: Empty items rejection");
        const resEmptyItemsReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: []
        }, authToken);
        assert(
            resEmptyItemsReceipt.status === 400 && resEmptyItemsReceipt.body.success === false,
            "POST /api/receipts with empty items array rejected with 400",
            JSON.stringify(resEmptyItemsReceipt.body)
        );

        // 12. Invalid product rejection
        console.log("\nStep 12: Invalid product rejection");
        const resBadProdReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: 999999, quantity: 10 }]
        }, authToken);
        assert(
            resBadProdReceipt.status === 400 && resBadProdReceipt.body.success === false,
            "POST /api/receipts with non-existent product rejected with 400",
            JSON.stringify(resBadProdReceipt.body)
        );

        // 13. Zero quantity rejection
        console.log("\nStep 13: Zero quantity rejection");
        const resZeroQtyReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 0 }]
        }, authToken);
        assert(
            resZeroQtyReceipt.status === 400 && resZeroQtyReceipt.body.success === false,
            "POST /api/receipts with quantity = 0 rejected with 400",
            JSON.stringify(resZeroQtyReceipt.body)
        );

        // 14. Negative quantity rejection
        console.log("\nStep 14: Negative quantity rejection");
        const resNegQtyReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: -25 }]
        }, authToken);
        assert(
            resNegQtyReceipt.status === 400 && resNegQtyReceipt.body.success === false,
            "POST /api/receipts with negative quantity rejected with 400",
            JSON.stringify(resNegQtyReceipt.body)
        );

        // 15. Receipt creation
        console.log("\nStep 15: Valid receipt creation");
        const resCreateRec = await apiRequest("POST", "/api/receipts", {
            supplier_id: testSupId,
            location_id: testLocId,
            items: [
                { product_id: testProd1Id, quantity: 100 },
                { product_id: testProd2Id, quantity: 50 }
            ]
        }, authToken);
        assert(
            resCreateRec.status === 201 && resCreateRec.body.success === true && resCreateRec.body.data.id > 0,
            "POST /api/receipts creates receipt with 201 Created and auto-generated receipt_number",
            JSON.stringify(resCreateRec.body)
        );
        const receipt1 = resCreateRec.body.data;
        const receipt1Id = receipt1.id;
        assert(
            receipt1.created_by === testUserId,
            "Receipt created_by securely assigned from authenticated JWT user ID",
            `created_by: ${receipt1.created_by}`
        );

        // 16. Get receipts
        console.log("\nStep 16: Get all receipts");
        const resGetRecs = await apiRequest("GET", "/api/receipts", null, authToken);
        assert(
            resGetRecs.status === 200 && Array.isArray(resGetRecs.body.data) && resGetRecs.body.data.length >= 2,
            "GET /api/receipts returns 200 with receipt array",
            `Count: ${resGetRecs.body.data?.length}`
        );

        // 17. Get receipt by ID
        console.log(`\nStep 17: Get receipt by ID (${receipt1Id})`);
        const resGetRec1 = await apiRequest("GET", `/api/receipts/${receipt1Id}`, null, authToken);
        assert(
            resGetRec1.status === 200 && resGetRec1.body.data.id === receipt1Id,
            `GET /api/receipts/${receipt1Id} returns 200 with receipt header details`,
            JSON.stringify(resGetRec1.body.data)
        );

        // 18. Receipt items returned correctly
        console.log("\nStep 18: Receipt items returned correctly");
        const items = resGetRec1.body.data.items;
        assert(
            Array.isArray(items) && items.length === 2 && items[0].product_name && items[0].product_sku,
            "Receipt response contains items array populated with joined product details",
            JSON.stringify(items)
        );

        // 19. Receipt status behavior
        console.log("\nStep 19: Receipt status transition behavior");
        const resUpdateStatus = await apiRequest("PUT", `/api/receipts/${receipt1Id}`, {
            status: "ready",
            location_id: testLocId,
            items: [
                { product_id: testProd1Id, quantity: 100 },
                { product_id: testProd2Id, quantity: 50 }
            ]
        }, authToken);
        assert(
            resUpdateStatus.status === 200 && resUpdateStatus.body.data.status === "ready",
            "PUT /api/receipts/:id transitions status draft -> ready successfully",
            `Status: ${resUpdateStatus.body.data.status}`
        );

        // ==================== PART 3: VALIDATION & STOCK MOVEMENTS ====================

        // 20. Validate receipt
        console.log(`\nStep 20: Validate receipt (${receipt1Id})`);
        const resValidate1 = await apiRequest("POST", `/api/receipts/${receipt1Id}/validate`, null, authToken);
        assert(
            resValidate1.status === 200 && resValidate1.body.success === true,
            "POST /api/receipts/:id/validate returns 200 OK",
            JSON.stringify(resValidate1.body)
        );

        // 21. Stock quantity increases correctly
        console.log("\nStep 21: Stock quantity increases correctly");
        const [stockP1] = await pool.query("SELECT * FROM stock WHERE product_id = ? AND location_id = ?", [testProd1Id, testLocId]);
        assert(
            stockP1.length === 1 && Number(stockP1[0].quantity) === 100,
            "Product 1 stock record quantity is exactly 100.00",
            `Quantity: ${stockP1[0]?.quantity}`
        );

        // 22. Stock row created when missing
        console.log("\nStep 22: Stock row created when missing");
        const [stockP2] = await pool.query("SELECT * FROM stock WHERE product_id = ? AND location_id = ?", [testProd2Id, testLocId]);
        assert(
            stockP2.length === 1 && Number(stockP2[0].quantity) === 50,
            "Product 2 initial stock row created with quantity 50.00",
            `Quantity: ${stockP2[0]?.quantity}`
        );

        // 23. Existing stock increases rather than creating duplicate row
        console.log("\nStep 23: Existing stock increases without creating duplicate row");
        // Create and validate a second receipt with Product 1 at the same location
        const resRec2 = await apiRequest("POST", "/api/receipts", {
            supplier_id: testSupId,
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 75 }]
        }, authToken);
        const receipt2Id = resRec2.body.data.id;

        const resValidate2 = await apiRequest("POST", `/api/receipts/${receipt2Id}/validate`, null, authToken);
        assert(resValidate2.status === 200, "Second receipt validated successfully");

        const [stockRowsAfter] = await pool.query("SELECT * FROM stock WHERE product_id = ? AND location_id = ?", [testProd1Id, testLocId]);
        assert(
            stockRowsAfter.length === 1 && Number(stockRowsAfter[0].quantity) === 175,
            "Existing stock row incremented from 100 to 175 without duplicate rows",
            `Row count: ${stockRowsAfter.length}, Quantity: ${stockRowsAfter[0]?.quantity}`
        );

        // 24. Correct stock_ledger entry created
        console.log("\nStep 24: Correct stock_ledger entry created");
        const [ledgerEntries] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'receipt' ORDER BY id ASC",
            [receipt1Id]
        );
        assert(
            ledgerEntries.length === 2 && ledgerEntries[0].created_by === testUserId,
            "Stock ledger records created with movement_type 'receipt' and authenticated user ID",
            JSON.stringify(ledgerEntries)
        );

        // 25. Ledger balance_after is correct
        console.log("\nStep 25: Ledger balance_after is correct");
        assert(
            Number(ledgerEntries[0].balance_after) === 100 && Number(ledgerEntries[1].balance_after) === 50,
            "Ledger balance_after accurately records exact snapshot balance at movement time",
            `Balances: [${ledgerEntries[0].balance_after}, ${ledgerEntries[1].balance_after}]`
        );

        // 26. Receipt becomes done
        console.log("\nStep 26: Receipt becomes done");
        const resGetDoneRec = await apiRequest("GET", `/api/receipts/${receipt1Id}`, null, authToken);
        assert(
            resGetDoneRec.body.data.status === "done",
            "Receipt status updated to 'done' after successful validation",
            `Status: ${resGetDoneRec.body.data.status}`
        );

        // 27. Second validation is rejected
        console.log("\nStep 27: Second validation is rejected");
        const resDoubleValidate = await apiRequest("POST", `/api/receipts/${receipt1Id}/validate`, null, authToken);
        assert(
            resDoubleValidate.status === 409 && resDoubleValidate.body.success === false,
            "Second validation on a done receipt rejected with 409 Conflict",
            JSON.stringify(resDoubleValidate.body)
        );

        // 28. Canceled receipt cannot be validated
        console.log("\nStep 28: Canceled receipt cannot be validated");
        const resRecCancel = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        const cancelRecId = resRecCancel.body.data.id;

        await apiRequest("POST", `/api/receipts/${cancelRecId}/cancel`, null, authToken);

        const resValidateCanceled = await apiRequest("POST", `/api/receipts/${cancelRecId}/validate`, null, authToken);
        assert(
            resValidateCanceled.status === 409 && resValidateCanceled.body.success === false,
            "POST /api/receipts/:id/validate on canceled receipt rejected with 409 Conflict",
            JSON.stringify(resValidateCanceled.body)
        );

        // 29. Done receipt cannot be modified in a way that changes stock
        console.log("\nStep 29: Done receipt cannot be modified");
        const resModifyDone = await apiRequest("PUT", `/api/receipts/${receipt1Id}`, {
            location_id: testLocId,
            items: [{ product_id: testProd1Id, quantity: 999 }]
        }, authToken);
        assert(
            resModifyDone.status === 400 && resModifyDone.body.success === false,
            "PUT /api/receipts/:id on done receipt rejected with 400 Bad Request",
            JSON.stringify(resModifyDone.body)
        );

        // ==================== PART 4: TRANSACTION SAFETY & ROLLBACK ====================

        // 30. Simulate a validation failure
        console.log("\nStep 30: Simulate a validation failure during transaction");
        const resRecFail = await apiRequest("POST", "/api/receipts", {
            location_id: testLocId,
            items: [{ product_id: testProd2Id, quantity: 300 }]
        }, authToken);
        const failRecId = resRecFail.body.data.id;

        const resSimulateFailure = await apiRequest(
            "POST",
            `/api/receipts/${failRecId}/validate`,
            null,
            authToken,
            { "x-simulate-failure": "true" }
        );
        assert(
            resSimulateFailure.status === 500 && resSimulateFailure.body.success === false,
            "Simulated validation failure caught and returned clean 500 response",
            JSON.stringify(resSimulateFailure.body)
        );

        // 31. Confirm stock was rolled back
        console.log("\nStep 31: Confirm stock was rolled back");
        const [stockP2AfterFail] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd2Id, testLocId]
        );
        assert(
            Number(stockP2AfterFail[0].quantity) === 50,
            "Stock quantity remains untouched at 50.00 (not incremented to 350)",
            `Current quantity: ${stockP2AfterFail[0].quantity}`
        );

        // 32. Confirm ledger was rolled back
        console.log("\nStep 32: Confirm ledger was rolled back");
        const [ledgerAfterFail] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ?",
            [failRecId]
        );
        assert(
            ledgerAfterFail.length === 0,
            "Zero stock_ledger entries created for rolled back transaction",
            `Ledger count: ${ledgerAfterFail.length}`
        );

        // 33. Confirm receipt was not incorrectly marked done
        console.log("\nStep 33: Confirm receipt was not incorrectly marked done");
        const [receiptAfterFail] = await pool.query("SELECT status FROM receipts WHERE id = ?", [failRecId]);
        assert(
            receiptAfterFail[0].status === "draft",
            "Receipt status remains 'draft' after transaction rollback",
            `Status: ${receiptAfterFail[0].status}`
        );

        // ==================== PART 5: CLEANUP ====================

        // 34. Remove all temporary test data safely
        console.log("\nStep 34: Remove all temporary test data safely");
        const allTestReceiptIds = [supRefReceiptId, receipt1Id, receipt2Id, cancelRecId, failRecId];

        await pool.query("DELETE FROM stock_ledger WHERE reference_id IN (?)", [allTestReceiptIds]);
        await pool.query("DELETE FROM receipt_items WHERE receipt_id IN (?)", [allTestReceiptIds]);
        await pool.query("DELETE FROM receipts WHERE id IN (?)", [allTestReceiptIds]);
        await pool.query("DELETE FROM stock WHERE location_id = ?", [testLocId]);
        await pool.query("DELETE FROM locations WHERE id = ?", [testLocId]);
        await pool.query("DELETE FROM warehouses WHERE id = ?", [testWhId]);
        await pool.query("DELETE FROM products WHERE id IN (?, ?)", [testProd1Id, testProd2Id]);
        await pool.query("DELETE FROM suppliers WHERE id = ?", [testSupId]);
        await pool.query("DELETE FROM users WHERE id = ?", [testUserId]);

        const [remRecs] = await pool.query("SELECT id FROM receipts WHERE id IN (?)", [allTestReceiptIds]);
        const [remStock] = await pool.query("SELECT id FROM stock WHERE location_id = ?", [testLocId]);
        assert(
            remRecs.length === 0 && remStock.length === 0,
            "All test receipts, items, stock, and ledger entries successfully cleaned up",
            `Remaining: ${remRecs.length}`
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
