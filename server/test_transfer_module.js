process.env.NODE_ENV = "test";
require("dotenv").config();
const app = require("./app");
const pool = require("./config/database");

/**
 * StockSense Internal Transfers Verification Test Suite
 * Tests 42 comprehensive scenarios covering authentication, validation,
 * location checks, status transitions, atomic source deduction, destination increment,
 * dual ledger entries (transfer_out & transfer_in), insufficient stock protections,
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
        console.log("  StockSense Internal Transfers Verification");
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
        console.log("Setup: Registering authenticated user, warehouse, source/dest locations, products, and initial stock...");

        const userEmail = `transfer.officer.${Date.now()}@stocksense.test`;
        const resUser = await apiRequest("POST", "/api/auth/register", {
            name: "Internal Inventory Controller",
            email: userEmail,
            password: "SecurePassword123!"
        });
        const testUserId = resUser.body.data.id;

        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "SecurePassword123!"
        });
        const authToken = resLogin.body.token;

        const whCode = `WH-TRF-${Date.now()}`;
        const resWh = await apiRequest("POST", "/api/warehouses", {
            name: "Central Logistics Hub",
            code: whCode
        });
        const testWhId = resWh.body.data.id;

        // Source Location
        const resLocSource = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Main Storage Zone A",
            code: `ZONE-A-${Date.now()}`
        });
        const sourceLocId = resLocSource.body.data.id;

        // Destination Location
        const resLocDest = await apiRequest("POST", "/api/locations", {
            warehouse_id: testWhId,
            name: "Assembly Line Zone B",
            code: `ZONE-B-${Date.now()}`
        });
        const destLocId = resLocDest.body.data.id;

        // Products
        const resProd1 = await apiRequest("POST", "/api/products", {
            name: "High Precision Sensor",
            sku: `SKU-SENS-${Date.now()}`,
            unit_of_measure: "pcs",
            reorder_level: 20
        });
        const testProd1Id = resProd1.body.productId;

        const resProd2 = await apiRequest("POST", "/api/products", {
            name: "Steel Fastener M8",
            sku: `SKU-FAST-${Date.now()}`,
            unit_of_measure: "boxes",
            reorder_level: 50
        });
        const testProd2Id = resProd2.body.productId;

        // Set initial stock in source location: Product 1 = 100, Product 2 = 50.
        // Destination starts with NO stock for Product 1.
        await pool.query(
            "INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?), (?, ?, ?)",
            [testProd1Id, sourceLocId, 100, testProd2Id, sourceLocId, 50]
        );

        console.log(`Context ready: User ${testUserId}, Warehouse ${testWhId}, SourceLoc ${sourceLocId}, DestLoc ${destLocId}, Initial Source Stock [P1: 100, P2: 50]\n`);

        // ==================== TEST STEPS ====================

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with status message",
            JSON.stringify(resHealth.body)
        );

        // 2. Unauthenticated transfer creation rejected
        console.log("\nStep 2: Unauthenticated transfer creation rejected");
        const resNoAuth = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        });
        assert(
            resNoAuth.status === 401 && resNoAuth.body.success === false,
            "POST /api/transfers without Bearer token rejected with 401 Unauthorized",
            JSON.stringify(resNoAuth.body)
        );

        // 3. Invalid source location rejected
        console.log("\nStep 3: Invalid source location rejected");
        const resBadSource = await apiRequest("POST", "/api/transfers", {
            source_location_id: 999999,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resBadSource.status === 400 && resBadSource.body.message.includes("Source location"),
            "POST /api/transfers with non-existent source location rejected with 400",
            JSON.stringify(resBadSource.body)
        );

        // 4. Invalid destination location rejected
        console.log("\nStep 4: Invalid destination location rejected");
        const resBadDest = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: 999999,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resBadDest.status === 400 && resBadDest.body.message.includes("Destination location"),
            "POST /api/transfers with non-existent destination location rejected with 400",
            JSON.stringify(resBadDest.body)
        );

        // 5. Source == destination rejected
        console.log("\nStep 5: Source == destination rejected");
        const resSameLoc = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: sourceLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        assert(
            resSameLoc.status === 400 && resSameLoc.body.message.includes("different"),
            "POST /api/transfers with identical source and destination rejected with 400",
            JSON.stringify(resSameLoc.body)
        );

        // 6. Empty items rejected
        console.log("\nStep 6: Empty items rejected");
        const resEmptyItems = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: []
        }, authToken);
        assert(
            resEmptyItems.status === 400 && resEmptyItems.body.message.includes("at least one item"),
            "POST /api/transfers with empty items array rejected with 400",
            JSON.stringify(resEmptyItems.body)
        );

        // 7. Invalid product rejected
        console.log("\nStep 7: Invalid product rejected");
        const resBadProduct = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: 999999, quantity: 10 }]
        }, authToken);
        assert(
            resBadProduct.status === 400 && resBadProduct.body.message.includes("does not exist"),
            "POST /api/transfers with non-existent product rejected with 400",
            JSON.stringify(resBadProduct.body)
        );

        // 8. Zero quantity rejected
        console.log("\nStep 8: Zero quantity rejected");
        const resZeroQty = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 0 }]
        }, authToken);
        assert(
            resZeroQty.status === 400 && resZeroQty.body.message.includes("positive number"),
            "POST /api/transfers with quantity = 0 rejected with 400",
            JSON.stringify(resZeroQty.body)
        );

        // 9. Negative quantity rejected
        console.log("\nStep 9: Negative quantity rejected");
        const resNegQty = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: -15 }]
        }, authToken);
        assert(
            resNegQty.status === 400 && resNegQty.body.message.includes("positive number"),
            "POST /api/transfers with negative quantity rejected with 400",
            JSON.stringify(resNegQty.body)
        );

        // 10. Valid transfer creation
        console.log("\nStep 10: Valid transfer creation");
        const resCreate = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [
                { product_id: testProd1Id, quantity: 20 },
                { product_id: testProd2Id, quantity: 10 }
            ]
        }, authToken);
        assert(
            resCreate.status === 201 && resCreate.body.success === true && resCreate.body.data.id > 0,
            "POST /api/transfers creates transfer with 201 Created",
            JSON.stringify(resCreate.body)
        );
        const trf1Id = resCreate.body.data.id;

        // 11. created_by comes from JWT
        console.log("\nStep 11: created_by securely assigned from JWT");
        assert(
            resCreate.body.data.created_by === testUserId,
            "Transfer created_by matches authenticated user ID",
            `Created by: ${resCreate.body.data.created_by}, expected: ${testUserId}`
        );

        // 12. transfer number generated
        console.log("\nStep 12: Auto-generated transfer number");
        assert(
            typeof resCreate.body.data.transfer_number === "string" && resCreate.body.data.transfer_number.startsWith("TRF-"),
            "Transfer number automatically generated with 'TRF-' prefix",
            `Transfer number: ${resCreate.body.data.transfer_number}`
        );

        // 13. Get all transfers
        console.log("\nStep 13: Get all transfers");
        const resGetAll = await apiRequest("GET", "/api/transfers", null, authToken);
        assert(
            resGetAll.status === 200 && Array.isArray(resGetAll.body.data) && resGetAll.body.data.length > 0,
            "GET /api/transfers returns 200 with transfer summary list",
            `Transfers count: ${resGetAll.body.data?.length}`
        );

        // 14. Get transfer by ID
        console.log(`\nStep 14: Get transfer by ID (${trf1Id})`);
        const resGetById = await apiRequest("GET", `/api/transfers/${trf1Id}`, null, authToken);
        assert(
            resGetById.status === 200 &&
            resGetById.body.data.id === trf1Id &&
            resGetById.body.data.source_location_id === sourceLocId &&
            resGetById.body.data.destination_location_id === destLocId,
            "GET /api/transfers/:id returns 200 with matching header details",
            JSON.stringify(resGetById.body)
        );

        // 15. Transfer items returned correctly
        console.log("\nStep 15: Transfer items returned with product details");
        assert(
            Array.isArray(resGetById.body.data.items) &&
            resGetById.body.data.items.length === 2 &&
            resGetById.body.data.items[0].product_name !== undefined,
            "Transfer response includes line items with joined product details",
            `Items count: ${resGetById.body.data.items?.length}`
        );

        // 16. Draft -> ready transition
        console.log("\nStep 16: Draft -> ready transition");
        const resUpdateReady = await apiRequest("PUT", `/api/transfers/${trf1Id}`, {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            status: "ready",
            items: [
                { product_id: testProd1Id, quantity: 20 },
                { product_id: testProd2Id, quantity: 10 }
            ]
        }, authToken);
        assert(
            resUpdateReady.status === 200 && resUpdateReady.body.data.status === "ready",
            "PUT /api/transfers/:id successfully transitions status to 'ready'",
            `Status: ${resUpdateReady.body.data?.status}`
        );

        // 17. Successful transfer validation
        console.log(`\nStep 17: Successful transfer validation (Transfer ${trf1Id})`);
        const resValidate = await apiRequest("POST", `/api/transfers/${trf1Id}/validate`, null, authToken);
        assert(
            resValidate.status === 200 && resValidate.body.success === true,
            "POST /api/transfers/:id/validate returns 200 OK",
            JSON.stringify(resValidate.body)
        );

        // 18. Source stock decreases correctly
        console.log("\nStep 18: Source stock decreases correctly");
        const [sourceStockP1] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, sourceLocId]
        );
        const [sourceStockP2] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd2Id, sourceLocId]
        );
        assert(
            Number(sourceStockP1[0].quantity) === 80 && Number(sourceStockP2[0].quantity) === 40,
            "Source stock rows accurately decreased (P1: 100 - 20 = 80, P2: 50 - 10 = 40)",
            `P1: ${sourceStockP1[0]?.quantity}, P2: ${sourceStockP2[0]?.quantity}`
        );

        // 19. Destination stock increases correctly
        console.log("\nStep 19: Destination stock increases correctly");
        const [destStockP1] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, destLocId]
        );
        assert(
            Number(destStockP1[0].quantity) === 20,
            "Destination stock row quantity is exactly 20.00",
            `P1 Dest: ${destStockP1[0]?.quantity}`
        );

        // 20. Destination stock row created when missing
        console.log("\nStep 20: Destination stock row created when missing");
        assert(
            destStockP1.length === 1,
            "Destination stock row created when initially missing",
            `Dest rows: ${destStockP1.length}`
        );

        // 21. Existing destination stock increments correctly
        console.log("\nStep 21: Existing destination stock increments correctly");
        const resSecondTrf = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 15 }]
        }, authToken);
        const trf2Id = resSecondTrf.body.data.id;
        await apiRequest("POST", `/api/transfers/${trf2Id}/validate`, null, authToken);

        const [destStockP1After2nd] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, destLocId]
        );
        const [destRowsCount] = await pool.query(
            "SELECT COUNT(*) AS cnt FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, destLocId]
        );
        assert(
            Number(destStockP1After2nd[0].quantity) === 35 && Number(destRowsCount[0].cnt) === 1,
            "Existing destination stock row incremented from 20 to 35 without duplicate rows",
            `Quantity: ${destStockP1After2nd[0]?.quantity}, Rows: ${destRowsCount[0]?.cnt}`
        );

        // 22. Source never becomes negative
        console.log("\nStep 22: Source never becomes negative");
        const [sourceStockAfter2nd] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, sourceLocId]
        );
        assert(
            Number(sourceStockAfter2nd[0].quantity) === 65 && Number(sourceStockAfter2nd[0].quantity) >= 0,
            "Source stock remains strictly non-negative (80 - 15 = 65)",
            `Source balance: ${sourceStockAfter2nd[0]?.quantity}`
        );

        // 23. Transfer_out ledger created
        console.log("\nStep 23: transfer_out ledger created");
        const [outLedgerRows] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'transfer_out'",
            [trf1Id]
        );
        assert(
            outLedgerRows.length === 2,
            "Stock ledger records created with movement_type 'transfer_out' for source",
            `transfer_out count: ${outLedgerRows.length}`
        );

        // 24. Transfer_in ledger created
        console.log("\nStep 24: transfer_in ledger created");
        const [inLedgerRows] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ? AND movement_type = 'transfer_in'",
            [trf1Id]
        );
        assert(
            inLedgerRows.length === 2,
            "Stock ledger records created with movement_type 'transfer_in' for destination",
            `transfer_in count: ${inLedgerRows.length}`
        );

        // 25. Transfer_out quantity_change is negative
        console.log("\nStep 25: transfer_out quantity_change is negative");
        const outP1 = outLedgerRows.find((l) => l.product_id === testProd1Id);
        assert(
            Number(outP1.quantity_change) === -20,
            "transfer_out quantity_change is negative (-20)",
            `quantity_change: ${outP1?.quantity_change}`
        );

        // 26. Transfer_in quantity_change is positive
        console.log("\nStep 26: transfer_in quantity_change is positive");
        const inP1 = inLedgerRows.find((l) => l.product_id === testProd1Id);
        assert(
            Number(inP1.quantity_change) === 20,
            "transfer_in quantity_change is positive (+20)",
            `quantity_change: ${inP1?.quantity_change}`
        );

        // 27. Source balance_after correct
        console.log("\nStep 27: Source balance_after correct");
        assert(
            Number(outP1.balance_after) === 80,
            "Source balance_after matches final source stock balance snapshot (80)",
            `balance_after: ${outP1?.balance_after}`
        );

        // 28. Destination balance_after correct
        console.log("\nStep 28: Destination balance_after correct");
        assert(
            Number(inP1.balance_after) === 20,
            "Destination balance_after matches final destination stock balance snapshot (20)",
            `balance_after: ${inP1?.balance_after}`
        );

        // 29. Transfer becomes done
        console.log("\nStep 29: Transfer becomes done");
        const [trf1Check] = await pool.query("SELECT status FROM transfers WHERE id = ?", [trf1Id]);
        assert(
            trf1Check[0].status === "done",
            "Transfer status updated to 'done' after successful validation",
            `Status: ${trf1Check[0]?.status}`
        );

        // 30. Second validation rejected
        console.log("\nStep 30: Second validation rejected");
        const resSecondValidate = await apiRequest("POST", `/api/transfers/${trf1Id}/validate`, null, authToken);
        assert(
            resSecondValidate.status === 409 && resSecondValidate.body.success === false,
            "Second validation on a done transfer rejected with 409 Conflict",
            JSON.stringify(resSecondValidate.body)
        );

        // 31. Done transfer cannot be edited
        console.log("\nStep 31: Done transfer cannot be edited");
        const resEditDone = await apiRequest("PUT", `/api/transfers/${trf1Id}`, {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 5 }]
        }, authToken);
        assert(
            resEditDone.status === 400 && resEditDone.body.success === false,
            "PUT /api/transfers/:id on completed transfer rejected with 400 Bad Request",
            JSON.stringify(resEditDone.body)
        );

        // 32. Canceled transfer cannot be validated
        console.log("\nStep 32: Canceled transfer cannot be validated");
        const resCancelTrf = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 5 }]
        }, authToken);
        const cancelTrfId = resCancelTrf.body.data.id;
        await apiRequest("POST", `/api/transfers/${cancelTrfId}/cancel`, null, authToken);

        const resValidateCanceled = await apiRequest("POST", `/api/transfers/${cancelTrfId}/validate`, null, authToken);
        assert(
            resValidateCanceled.status === 409 && resValidateCanceled.body.success === false,
            "POST /api/transfers/:id/validate on canceled transfer rejected with 409 Conflict",
            JSON.stringify(resValidateCanceled.body)
        );

        // 33. Insufficient source stock rejected
        console.log("\nStep 33: Insufficient source stock rejected");
        // Source currently has 65 units of testProd1Id. Attempt to transfer 500 units.
        const resExcessTrf = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 500 }]
        }, authToken);
        const excessTrfId = resExcessTrf.body.data.id;

        const resValidateExcess = await apiRequest("POST", `/api/transfers/${excessTrfId}/validate`, null, authToken);
        assert(
            resValidateExcess.status === 409 && resValidateExcess.body.success === false,
            "Validation rejected with 409 Conflict when requested quantity exceeds available source stock",
            JSON.stringify(resValidateExcess.body)
        );

        // 34. Insufficient source stock leaves source unchanged
        console.log("\nStep 34: Insufficient source stock leaves source unchanged");
        const [sourceStockExcessCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, sourceLocId]
        );
        assert(
            Number(sourceStockExcessCheck[0].quantity) === 65,
            "Source stock quantity untouched at 65.00 after rejected excess transfer",
            `Current source quantity: ${sourceStockExcessCheck[0]?.quantity}`
        );

        // 35. Insufficient source stock leaves destination unchanged
        console.log("\nStep 35: Insufficient source stock leaves destination unchanged");
        const [destStockExcessCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, destLocId]
        );
        assert(
            Number(destStockExcessCheck[0].quantity) === 35,
            "Destination stock quantity untouched at 35.00 after rejected excess transfer",
            `Current destination quantity: ${destStockExcessCheck[0]?.quantity}`
        );

        // 36. Insufficient source stock creates no ledger
        console.log("\nStep 36: Insufficient source stock creates no ledger");
        const [ledgerExcessCheck] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ?",
            [excessTrfId]
        );
        assert(
            ledgerExcessCheck.length === 0,
            "Zero stock_ledger entries created for rejected excess transfer",
            `Ledger count: ${ledgerExcessCheck.length}`
        );

        // 37. Transaction rollback with simulated failure
        console.log("\nStep 37: Transaction rollback with simulated failure");
        const resRollbackTrf = await apiRequest("POST", "/api/transfers", {
            source_location_id: sourceLocId,
            destination_location_id: destLocId,
            items: [{ product_id: testProd1Id, quantity: 10 }]
        }, authToken);
        const rollbackTrfId = resRollbackTrf.body.data.id;

        const resSimulateFail = await apiRequest(
            "POST",
            `/api/transfers/${rollbackTrfId}/validate`,
            null,
            authToken,
            { "x-simulate-failure": "true" }
        );
        assert(
            resSimulateFail.status === 500 && resSimulateFail.body.success === false,
            "Simulated validation failure caught and returned 500 response",
            JSON.stringify(resSimulateFail.body)
        );

        // 38. Rollback leaves source unchanged
        console.log("\nStep 38: Rollback leaves source unchanged");
        const [sourceStockRollbackCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, sourceLocId]
        );
        assert(
            Number(sourceStockRollbackCheck[0].quantity) === 65,
            "Source stock quantity remains 65.00 (not deducted to 55) after rollback",
            `Current source quantity: ${sourceStockRollbackCheck[0]?.quantity}`
        );

        // 39. Rollback leaves destination unchanged
        console.log("\nStep 39: Rollback leaves destination unchanged");
        const [destStockRollbackCheck] = await pool.query(
            "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            [testProd1Id, destLocId]
        );
        assert(
            Number(destStockRollbackCheck[0].quantity) === 35,
            "Destination stock quantity remains 35.00 (not incremented to 45) after rollback",
            `Current destination quantity: ${destStockRollbackCheck[0]?.quantity}`
        );

        // 40. Rollback leaves ledger unchanged
        console.log("\nStep 40: Rollback leaves ledger unchanged");
        const [ledgerRollbackCheck] = await pool.query(
            "SELECT * FROM stock_ledger WHERE reference_id = ?",
            [rollbackTrfId]
        );
        assert(
            ledgerRollbackCheck.length === 0,
            "Zero stock_ledger entries created for rolled back transfer",
            `Ledger count: ${ledgerRollbackCheck.length}`
        );

        // 41. Rollback leaves transfer status unchanged
        console.log("\nStep 41: Rollback leaves transfer status unchanged");
        const [trfRollbackCheck] = await pool.query("SELECT status FROM transfers WHERE id = ?", [rollbackTrfId]);
        assert(
            trfRollbackCheck[0].status === "draft",
            "Transfer status remains 'draft' (not marked 'done') after transaction rollback",
            `Status: ${trfRollbackCheck[0]?.status}`
        );

        // 42. Temporary test data cleanup
        console.log("\nStep 42: Temporary test data cleanup");
        const allTestTransferIds = [trf1Id, trf2Id, cancelTrfId, excessTrfId, rollbackTrfId];

        await pool.query("DELETE FROM stock_ledger WHERE reference_id IN (?)", [allTestTransferIds]);
        await pool.query("DELETE FROM transfer_items WHERE transfer_id IN (?)", [allTestTransferIds]);
        await pool.query("DELETE FROM transfers WHERE id IN (?)", [allTestTransferIds]);
        await pool.query("DELETE FROM stock WHERE location_id IN (?, ?)", [sourceLocId, destLocId]);
        await pool.query("DELETE FROM locations WHERE id IN (?, ?)", [sourceLocId, destLocId]);
        await pool.query("DELETE FROM warehouses WHERE id = ?", [testWhId]);
        await pool.query("DELETE FROM products WHERE id IN (?, ?)", [testProd1Id, testProd2Id]);
        await pool.query("DELETE FROM users WHERE id = ?", [testUserId]);

        const [remTrfs] = await pool.query("SELECT id FROM transfers WHERE id IN (?)", [allTestTransferIds]);
        const [remStock] = await pool.query("SELECT id FROM stock WHERE location_id IN (?, ?)", [sourceLocId, destLocId]);
        assert(
            remTrfs.length === 0 && remStock.length === 0,
            "All test transfers, items, stock, and ledger entries successfully cleaned up",
            `Remaining transfers: ${remTrfs.length}, Stock: ${remStock.length}`
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
