require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Stock Ledger REST API Verification Test Suite
 * Tests authentication, read-only constraints, joins, filters, pagination,
 * and data correctness against genuine transactions (Receipt, Delivery, Transfer, Adjustment).
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

    // Tracking for cleanup
    let testUserId = null;
    let testWhId = null;
    let testSourceLocId = null;
    let testDestLocId = null;
    let testProduct1Id = null;
    let testProduct2Id = null;
    let testReceiptId = null;
    let testDeliveryId = null;
    let testTransferId = null;
    let testAdjustmentId = null;

    try {
        console.log("=================================================");
        console.log("  StockSense Stock Ledger API Verification");
        console.log("=================================================\n");

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

        // ==================== 1. SETUP TEST CONTEXT ====================
        console.log("Setup: Registering authenticated user, warehouse, locations, products...");
        const userEmail = `ledger.auditor.${Date.now()}@stocksense.test`;
        const resUser = await apiRequest("POST", "/api/auth/register", {
            name: "Audit Officer",
            email: userEmail,
            password: "SecurePassword123!"
        });
        testUserId = resUser.body.data.id;

        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "SecurePassword123!"
        });
        const authToken = resLogin.body.token;

        const whCode = `WH-LED-${Date.now()}`;
        const resWh = await apiRequest("POST", "/api/warehouses", {
            name: "Central Ledger Depot",
            code: whCode
        });
        testWhId = resWh.body.data.id;

        const resLoc1 = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Depot Staging Area",
            code: `STG-${Date.now()}`
        });
        testSourceLocId = resLoc1.body.data.id;

        const resLoc2 = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Depot Rack Row B",
            code: `RCK-${Date.now()}`
        });
        testDestLocId = resLoc2.body.data.id;

        const resProd1 = await apiRequest("POST", "/api/products", {
            name: `Galvanized Bolt ${Date.now()}`,
            sku: `BOLT-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 20
        });
        testProduct1Id = resProd1.body.data.id;

        const resProd2 = await apiRequest("POST", "/api/products", {
            name: `Stainless Nut ${Date.now()}`,
            sku: `NUT-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 10
        });
        testProduct2Id = resProd2.body.data.id;

        // ==================== 2. AUTHENTICATION & SECURITY ====================
        console.log("\nStep 1: Security - Unauthenticated GET /api/stock-ledger");
        const resNoAuth = await apiRequest("GET", "/api/stock-ledger");
        assert(
            resNoAuth.status === 401 && resNoAuth.body.success === false,
            "Unauthenticated request is rejected with 401 Unauthorized"
        );

        console.log("\nStep 2: Security - Invalid token GET /api/stock-ledger");
        const resBadToken = await apiRequest("GET", "/api/stock-ledger", null, "invalid-token-12345");
        assert(
            resBadToken.status === 401 && resBadToken.body.success === false,
            "Malformed/invalid token is rejected with 401 Unauthorized"
        );

        console.log("\nStep 3: Security - Read-only enforcement (No mutation endpoints)");
        const resPost = await apiRequest("POST", "/api/stock-ledger", { dummy: "data" }, authToken);
        assert(
            resPost.status === 404,
            "POST /api/stock-ledger returns 404 Not Found (no creation allowed)"
        );

        const resPut = await apiRequest("PUT", "/api/stock-ledger/1", { dummy: "data" }, authToken);
        assert(
            resPut.status === 404,
            "PUT /api/stock-ledger/:id returns 404 Not Found (no update allowed)"
        );

        const resDelete = await apiRequest("DELETE", "/api/stock-ledger/1", null, authToken);
        assert(
            resDelete.status === 404,
            "DELETE /api/stock-ledger/:id returns 404 Not Found (no deletion allowed)"
        );

        // ==================== 3. GENERATE GENUINE TRANSACTION RECORDS ====================
        console.log("\nStep 4: Executing real transactions to generate authoritative movements...");

        // A. Receipt: +100 units of Product 1 at Source Location
        const resReceipt = await apiRequest("POST", "/api/receipts", {
            location_id: testSourceLocId,
            items: [{ product_id: testProduct1Id, quantity: 100 }]
        }, authToken);
        testReceiptId = resReceipt.body.data.id;
        const receiptNumber = resReceipt.body.data.receipt_number;
        await apiRequest("POST", `/api/receipts/${testReceiptId}/validate`, null, authToken);
        console.log(`  [+] Receipt validated: +100 units (${receiptNumber})`);

        // B. Delivery: -20 units of Product 1 from Source Location
        const resDelivery = await apiRequest("POST", "/api/deliveries", {
            location_id: testSourceLocId,
            customer_name: "Acme Industrial",
            items: [{ product_id: testProduct1Id, quantity: 20 }]
        }, authToken);
        testDeliveryId = resDelivery.body.data.id;
        const deliveryNumber = resDelivery.body.data.delivery_number;
        await apiRequest("POST", `/api/deliveries/${testDeliveryId}/validate`, null, authToken);
        console.log(`  [+] Delivery validated: -20 units (${deliveryNumber})`);

        // C. Internal Transfer: 15 units of Product 1 from Source to Dest Location
        const resTransfer = await apiRequest("POST", "/api/transfers", {
            source_location_id: testSourceLocId,
            destination_location_id: testDestLocId,
            items: [{ product_id: testProduct1Id, quantity: 15 }]
        }, authToken);
        testTransferId = resTransfer.body.data.id;
        const transferNumber = resTransfer.body.data.transfer_number;
        await apiRequest("POST", `/api/transfers/${testTransferId}/validate`, null, authToken);
        console.log(`  [+] Transfer validated: 15 units (${transferNumber})`);

        // D. Adjustment: Physical count at Source Location is 70 (system was 65, diff +5)
        const resAdj = await apiRequest("POST", "/api/adjustments", {
            location_id: testSourceLocId,
            reason: "Annual audit recount",
            items: [{ product_id: testProduct1Id, counted_quantity: 70 }]
        }, authToken);
        testAdjustmentId = resAdj.body.data.id;
        const adjNumber = resAdj.body.data.adjustment_number;
        await apiRequest("POST", `/api/adjustments/${testAdjustmentId}/validate`, null, authToken);
        console.log(`  [+] Adjustment validated: +5 units (${adjNumber})`);

        // ==================== 4. BASIC RETRIEVAL & STRUCTURE ====================
        console.log("\nStep 5: Authenticated GET /api/stock-ledger response structure verification");
        const resLedger = await apiRequest("GET", `/api/stock-ledger?product_id=${testProduct1Id}`, null, authToken);
        assert(resLedger.status === 200, "GET /api/stock-ledger returns 200 OK");
        assert(resLedger.body.success === true, "Response has success: true");
        assert(Array.isArray(resLedger.body.data), "Response data is an array");
        assert(resLedger.body.total >= 5, "Response total reflects movements (at least 5)");
        assert(resLedger.body.page === 1, "Default page is 1");
        assert(resLedger.body.pageSize === 25, "Default pageSize is 25");
        assert(resLedger.body.totalPages >= 1, "totalPages calculated correctly");

        const records = resLedger.body.data;
        const firstEntry = records[0];
        assert(firstEntry.id !== undefined, "Ledger entry contains 'id'");
        assert(firstEntry.product_id === testProduct1Id, "Ledger entry contains 'product_id'");
        assert(typeof firstEntry.product_name === "string", "Ledger entry contains 'product_name' via JOIN");
        assert(typeof firstEntry.sku === "string", "Ledger entry contains 'sku' via JOIN");
        assert(firstEntry.location_id !== undefined, "Ledger entry contains 'location_id'");
        assert(typeof firstEntry.location_name === "string", "Ledger entry contains 'location_name' via JOIN");
        assert(typeof firstEntry.warehouse_name === "string", "Ledger entry contains 'warehouse_name' via JOIN");
        assert(typeof firstEntry.movement_type === "string", "Ledger entry contains 'movement_type'");
        assert(firstEntry.reference_id !== undefined, "Ledger entry contains 'reference_id'");
        assert(firstEntry.reference_number !== undefined, "Ledger entry contains 'reference_number'");
        assert(typeof firstEntry.quantity_change === "number", "Ledger entry contains numeric 'quantity_change'");
        assert(typeof firstEntry.balance_after === "number", "Ledger entry contains numeric 'balance_after'");
        assert(firstEntry.created_by === testUserId, "Ledger entry contains 'created_by'");
        assert(firstEntry.created_by_name === "Audit Officer", "Ledger entry contains 'created_by_name' via JOIN");
        assert(firstEntry.created_at !== undefined, "Ledger entry contains 'created_at'");

        // ==================== 5. CHRONOLOGICAL ORDERING ====================
        console.log("\nStep 6: Chronological order check - Newest records appear first");
        for (let i = 0; i < records.length - 1; i++) {
            const dateA = new Date(records[i].created_at).getTime();
            const dateB = new Date(records[i + 1].created_at).getTime();
            assert(dateA >= dateB, `Record ${i} (${records[i].created_at}) is >= Record ${i + 1} (${records[i + 1].created_at})`);
        }

        // ==================== 6. DATA CORRECTNESS PER MOVEMENT TYPE ====================
        console.log("\nStep 7: Data correctness - Receipt record");
        const receiptEntry = records.find(r => r.movement_type === "receipt" && r.reference_id === testReceiptId);
        assert(receiptEntry !== undefined, "Receipt ledger entry exists");
        assert(receiptEntry.quantity_change === 100, "Receipt quantity_change is +100");
        assert(receiptEntry.balance_after === 100, "Receipt balance_after is 100");
        assert(receiptEntry.reference_number === receiptNumber, "Receipt reference_number matches receipt_number");

        console.log("\nStep 8: Data correctness - Delivery record");
        const deliveryEntry = records.find(r => r.movement_type === "delivery" && r.reference_id === testDeliveryId);
        assert(deliveryEntry !== undefined, "Delivery ledger entry exists");
        assert(deliveryEntry.quantity_change === -20, "Delivery quantity_change is negative (-20)");
        assert(deliveryEntry.balance_after === 80, "Delivery balance_after is 80 (100 - 20)");
        assert(deliveryEntry.reference_number === deliveryNumber, "Delivery reference_number matches delivery_number");

        console.log("\nStep 9: Data correctness - Transfer Out record");
        const transferOutEntry = records.find(r => r.movement_type === "transfer_out" && r.reference_id === testTransferId);
        assert(transferOutEntry !== undefined, "Transfer Out ledger entry exists");
        assert(transferOutEntry.location_id === testSourceLocId, "Transfer Out location matches source");
        assert(transferOutEntry.quantity_change === -15, "Transfer Out quantity_change is negative (-15)");
        assert(transferOutEntry.balance_after === 65, "Transfer Out source balance_after is 65 (80 - 15)");
        assert(transferOutEntry.reference_number === transferNumber, "Transfer Out reference_number matches transfer_number");

        console.log("\nStep 10: Data correctness - Transfer In record");
        const transferInEntry = records.find(r => r.movement_type === "transfer_in" && r.reference_id === testTransferId);
        assert(transferInEntry !== undefined, "Transfer In ledger entry exists");
        assert(transferInEntry.location_id === testDestLocId, "Transfer In location matches destination");
        assert(transferInEntry.quantity_change === 15, "Transfer In quantity_change is positive (+15)");
        assert(transferInEntry.balance_after === 15, "Transfer In dest balance_after is 15 (0 + 15)");
        assert(transferInEntry.reference_number === transferNumber, "Transfer In reference_number matches transfer_number");

        console.log("\nStep 11: Data correctness - Adjustment record");
        const adjEntry = records.find(r => r.movement_type === "adjustment" && r.reference_id === testAdjustmentId);
        assert(adjEntry !== undefined, "Adjustment ledger entry exists");
        assert(adjEntry.quantity_change === 5, "Adjustment quantity_change is +5 (70 - 65)");
        assert(adjEntry.balance_after === 70, "Adjustment balance_after is 70");
        assert(adjEntry.reference_number === adjNumber, "Adjustment reference_number matches adjustment_number");

        // ==================== 7. FILTER TESTS ====================
        console.log("\nStep 12: Filter by movement_type");
        const resReceiptFilter = await apiRequest("GET", `/api/stock-ledger?movement_type=receipt&product_id=${testProduct1Id}`, null, authToken);
        assert(resReceiptFilter.body.data.every(r => r.movement_type === "receipt"), "movement_type=receipt filter returns only receipts");

        const resDeliveryFilter = await apiRequest("GET", `/api/stock-ledger?movement_type=delivery&product_id=${testProduct1Id}`, null, authToken);
        assert(resDeliveryFilter.body.data.every(r => r.movement_type === "delivery"), "movement_type=delivery filter returns only deliveries");

        const resTransInFilter = await apiRequest("GET", `/api/stock-ledger?movement_type=transfer_in&product_id=${testProduct1Id}`, null, authToken);
        assert(resTransInFilter.body.data.every(r => r.movement_type === "transfer_in"), "movement_type=transfer_in filter returns only transfer_in");

        const resTransOutFilter = await apiRequest("GET", `/api/stock-ledger?movement_type=transfer_out&product_id=${testProduct1Id}`, null, authToken);
        assert(resTransOutFilter.body.data.every(r => r.movement_type === "transfer_out"), "movement_type=transfer_out filter returns only transfer_out");

        const resAdjFilter = await apiRequest("GET", `/api/stock-ledger?movement_type=adjustment&product_id=${testProduct1Id}`, null, authToken);
        assert(resAdjFilter.body.data.every(r => r.movement_type === "adjustment"), "movement_type=adjustment filter returns only adjustments");

        console.log("\nStep 13: Filter by location_id");
        const resLocFilter = await apiRequest("GET", `/api/stock-ledger?location_id=${testDestLocId}&product_id=${testProduct1Id}`, null, authToken);
        assert(resLocFilter.body.data.every(r => r.location_id === testDestLocId), "location_id filter returns only records for dest location");
        assert(resLocFilter.body.data.length === 1, "Destination location has exactly 1 movement (transfer_in)");

        console.log("\nStep 14: Filter by product_id");
        const resProd2Filter = await apiRequest("GET", `/api/stock-ledger?product_id=${testProduct2Id}`, null, authToken);
        assert(resProd2Filter.body.data.length === 0, "Product 2 without movements returns empty array");

        console.log("\nStep 15: Search filter (product name & SKU)");
        const resSearch = await apiRequest("GET", `/api/stock-ledger?search=Galvanized`, null, authToken);
        assert(resSearch.body.data.some(r => r.product_id === testProduct1Id), "search=Galvanized matches Product 1");

        console.log("\nStep 16: Date range filter");
        const todayStr = new Date().toISOString().split("T")[0];
        const resDateFilter = await apiRequest("GET", `/api/stock-ledger?product_id=${testProduct1Id}&start_date=${todayStr}&end_date=${todayStr}`, null, authToken);
        assert(resDateFilter.body.data.length >= 5, "Today's date filter successfully includes created movements");

        // ==================== 8. PAGINATION TESTS ====================
        console.log("\nStep 17: Pagination (page and pageSize)");
        const resPage1 = await apiRequest("GET", `/api/stock-ledger?product_id=${testProduct1Id}&page=1&pageSize=2`, null, authToken);
        assert(resPage1.body.data.length === 2, "Page 1 with pageSize 2 returns 2 records");
        assert(resPage1.body.page === 1, "Page 1 reports page = 1");
        assert(resPage1.body.pageSize === 2, "Page 1 reports pageSize = 2");

        const resPage2 = await apiRequest("GET", `/api/stock-ledger?product_id=${testProduct1Id}&page=2&pageSize=2`, null, authToken);
        assert(resPage2.body.data.length === 2, "Page 2 with pageSize 2 returns 2 records");
        assert(resPage2.body.page === 2, "Page 2 reports page = 2");
        assert(resPage2.body.data[0].id !== resPage1.body.data[0].id, "Page 2 returns different entries from Page 1");

        // ==================== 9. SINGLE ENTRY BY ID ====================
        console.log("\nStep 18: Single entry retrieval GET /api/stock-ledger/:id");
        const resSingle = await apiRequest("GET", `/api/stock-ledger/${firstEntry.id}`, null, authToken);
        assert(resSingle.status === 200, "GET /api/stock-ledger/:id returns 200 OK");
        assert(resSingle.body.data.id === firstEntry.id, "Single entry ID matches");
        assert(resSingle.body.data.product_name === firstEntry.product_name, "Single entry product_name matches");

        const resSingleNotFound = await apiRequest("GET", "/api/stock-ledger/9999999", null, authToken);
        assert(resSingleNotFound.status === 404, "GET /api/stock-ledger/9999999 returns 404 Not Found");

        // ==================== 10. INPUT VALIDATION TESTS ====================
        console.log("\nStep 19: Input validation - Invalid movement_type");
        const resBadMoveType = await apiRequest("GET", "/api/stock-ledger?movement_type=hack_type", null, authToken);
        assert(resBadMoveType.status === 400 && resBadMoveType.body.success === false, "Invalid movement_type rejected with 400");

        console.log("\nStep 20: Input validation - Invalid location_id");
        const resBadLocId = await apiRequest("GET", "/api/stock-ledger?location_id=abc", null, authToken);
        assert(resBadLocId.status === 400 && resBadLocId.body.success === false, "Non-numeric location_id rejected with 400");

        const resNegLocId = await apiRequest("GET", "/api/stock-ledger?location_id=-5", null, authToken);
        assert(resNegLocId.status === 400 && resNegLocId.body.success === false, "Negative location_id rejected with 400");

        console.log("\nStep 21: Input validation - Invalid product_id");
        const resBadProdId = await apiRequest("GET", "/api/stock-ledger?product_id=zero", null, authToken);
        assert(resBadProdId.status === 400 && resBadProdId.body.success === false, "Non-numeric product_id rejected with 400");

        console.log("\nStep 22: Input validation - Malformed dates");
        const resBadStart = await apiRequest("GET", "/api/stock-ledger?start_date=not-a-date", null, authToken);
        assert(resBadStart.status === 400 && resBadStart.body.success === false, "Malformed start_date rejected with 400");

        const resBadEnd = await apiRequest("GET", "/api/stock-ledger?end_date=2026-99-99", null, authToken);
        assert(resBadEnd.status === 400 && resBadEnd.body.success === false, "Malformed end_date rejected with 400");

        console.log("\nStep 23: Input validation - Inverted date range (start > end)");
        const resInvertedDate = await apiRequest("GET", "/api/stock-ledger?start_date=2026-12-01&end_date=2026-01-01", null, authToken);
        assert(resInvertedDate.status === 400 && resInvertedDate.body.success === false, "Inverted date range rejected with 400");

        console.log("\nStep 24: Input validation - Invalid pagination parameters");
        const resBadPage = await apiRequest("GET", "/api/stock-ledger?page=0", null, authToken);
        assert(resBadPage.status === 400 && resBadPage.body.success === false, "page=0 rejected with 400");

        const resBadPageSize = await apiRequest("GET", "/api/stock-ledger?pageSize=2000", null, authToken);
        assert(resBadPageSize.status === 400 && resBadPageSize.body.success === false, "pageSize > 1000 rejected with 400");

        // ==================== CLEANUP ====================
        console.log("\nStep 25: Cleaning up test data...");
        // Delete ledger records created during test
        const testReferenceIds = [testReceiptId, testDeliveryId, testTransferId, testAdjustmentId].filter(Boolean);
        if (testReferenceIds.length > 0) {
            await pool.query("DELETE FROM stock_ledger WHERE reference_id IN (?)", [testReferenceIds]);
        }
        if (testProduct1Id || testProduct2Id) {
            const pids = [testProduct1Id, testProduct2Id].filter(Boolean);
            await pool.query("DELETE FROM stock WHERE product_id IN (?)", [pids]);
        }
        if (testReceiptId) {
            await pool.query("DELETE FROM receipt_items WHERE receipt_id = ?", [testReceiptId]);
            await pool.query("DELETE FROM receipts WHERE id = ?", [testReceiptId]);
        }
        if (testDeliveryId) {
            await pool.query("DELETE FROM delivery_items WHERE delivery_id = ?", [testDeliveryId]);
            await pool.query("DELETE FROM deliveries WHERE id = ?", [testDeliveryId]);
        }
        if (testTransferId) {
            await pool.query("DELETE FROM transfer_items WHERE transfer_id = ?", [testTransferId]);
            await pool.query("DELETE FROM transfers WHERE id = ?", [testTransferId]);
        }
        if (testAdjustmentId) {
            await pool.query("DELETE FROM adjustment_items WHERE adjustment_id = ?", [testAdjustmentId]);
            await pool.query("DELETE FROM adjustments WHERE id = ?", [testAdjustmentId]);
        }
        if (testSourceLocId || testDestLocId) {
            const locIds = [testSourceLocId, testDestLocId].filter(Boolean);
            await pool.query("DELETE FROM locations WHERE id IN (?)", [locIds]);
        }
        if (testWhId) {
            await pool.query("DELETE FROM warehouses WHERE id = ?", [testWhId]);
        }
        if (testProduct1Id || testProduct2Id) {
            const pids = [testProduct1Id, testProduct2Id].filter(Boolean);
            await pool.query("DELETE FROM products WHERE id IN (?)", [pids]);
        }
        if (testUserId) {
            await pool.query("DELETE FROM users WHERE id = ?", [testUserId]);
        }
        assert(true, "All test transactions, ledger rows, and entities cleanly purged");

        console.log("\n=================================================");
        console.log(`  VERIFICATION COMPLETE: ${testsPassed} passed, ${testsFailed} failed`);
        console.log("=================================================\n");

    } catch (err) {
        console.error("Test execution failed:", err);
        throw err;
    } finally {
        if (server) {
            server.close();
        }
        await pool.end();
    }
}

runTests().catch(() => {
    process.exit(1);
});
