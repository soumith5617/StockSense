process.env.NODE_ENV = "test";
require("dotenv").config();
const express = require("express");
const app = require("./app");
const pool = require("./config/database");
const { authenticate, requireRole } = require("./middleware/authMiddleware");

/**
 * StockSense User Authentication Verification Test Suite
 * Tests full authentication lifecycle, JWT issuance, middleware, role authorization,
 * password hashing, password reset foundation, and safe cleanup.
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
        console.log("  StockSense User Authentication Verification");
        console.log("=================================================\n");

        // Start temporary HTTP test server on an ephemeral port
        server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;
        console.log(`Temporary test server running on ${baseUrl}\n`);

        const apiRequest = async (method, endpoint, body = null, token = null) => {
            const options = {
                method,
                headers: { "Content-Type": "application/json" }
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

        // 1. Health check
        console.log("Step 1: Backend health check");
        const resHealth = await apiRequest("GET", "/api/health");
        assert(
            resHealth.status === 200 && resHealth.body.message === "StockSense API is running",
            "GET /api/health returns 200 with status message",
            JSON.stringify(resHealth.body)
        );

        // 2. Validation: Registration missing name
        console.log("\nStep 2: Registration validation - missing name");
        const resNoName = await apiRequest("POST", "/api/auth/register", {
            email: "alice@stocksense.test",
            password: "SecurePassword123!"
        });
        assert(
            resNoName.status === 400 && resNoName.body.success === false,
            "POST /api/auth/register rejects missing name with 400",
            JSON.stringify(resNoName.body)
        );

        // 3. Validation: Registration invalid email
        console.log("\nStep 3: Registration validation - invalid email");
        const resBadEmail = await apiRequest("POST", "/api/auth/register", {
            name: "Alice Johnson",
            email: "not-an-email",
            password: "SecurePassword123!"
        });
        assert(
            resBadEmail.status === 400 && resBadEmail.body.success === false,
            "POST /api/auth/register rejects invalid email format with 400",
            JSON.stringify(resBadEmail.body)
        );

        // 4. Validation: Registration short password
        console.log("\nStep 4: Registration validation - short password");
        const resShortPass = await apiRequest("POST", "/api/auth/register", {
            name: "Alice Johnson",
            email: "alice@stocksense.test",
            password: "123"
        });
        assert(
            resShortPass.status === 400 && resShortPass.body.success === false,
            "POST /api/auth/register rejects password shorter than 6 chars with 400",
            JSON.stringify(resShortPass.body)
        );

        // 5. Successful User Registration
        console.log("\nStep 5: Successful user registration");
        const userEmail = `alice.${Date.now()}@stocksense.test`;
        const rawPassword = "SecurePassword123!";
        const resRegister = await apiRequest("POST", "/api/auth/register", {
            name: "Alice Johnson",
            email: userEmail,
            password: rawPassword
        });
        assert(
            resRegister.status === 201 && resRegister.body.success === true && resRegister.body.data.id > 0,
            "POST /api/auth/register creates user with 201 Created",
            JSON.stringify(resRegister.body)
        );
        const registeredUser = resRegister.body.data;
        const userId = registeredUser.id;

        // 6. Response does not expose password
        console.log("\nStep 6: Registration response password privacy");
        assert(
            registeredUser.password === undefined,
            "User registration response never exposes password or hash",
            JSON.stringify(registeredUser)
        );

        // 7. Verify password hashing in database (never plaintext)
        console.log("\nStep 7: Direct database verification of password hashing");
        const [dbRows] = await pool.query("SELECT id, email, password, role FROM users WHERE id = ?", [userId]);
        const dbUser = dbRows[0];
        assert(
            dbUser && dbUser.password !== rawPassword && dbUser.password.startsWith("$2"),
            "Database stores bcrypt hash and NEVER plaintext password",
            `Stored hash: ${dbUser?.password?.substring(0, 15)}...`
        );
        assert(
            dbUser && dbUser.role === "staff",
            "New user defaults to role 'staff'",
            `Role: ${dbUser?.role}`
        );

        // 8. Duplicate email rejection
        console.log("\nStep 8: Duplicate email rejection");
        const resDuplicate = await apiRequest("POST", "/api/auth/register", {
            name: "Alice Imposter",
            email: userEmail.toUpperCase(), // also tests case normalization
            password: "DifferentPassword456!"
        });
        assert(
            resDuplicate.status === 409 && resDuplicate.body.success === false,
            "POST /api/auth/register rejects duplicate email with 409 Conflict",
            JSON.stringify(resDuplicate.body)
        );

        // 9. Login validation: missing credentials
        console.log("\nStep 9: Login validation - missing credentials");
        const resLoginEmpty = await apiRequest("POST", "/api/auth/login", {});
        assert(
            resLoginEmpty.status === 400 && resLoginEmpty.body.success === false,
            "POST /api/auth/login rejects empty credentials with 400",
            JSON.stringify(resLoginEmpty.body)
        );

        // 10. Login failure: wrong password
        console.log("\nStep 10: Login failure - wrong password");
        const resWrongPass = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: "WrongPassword999!"
        });
        assert(
            resWrongPass.status === 401 && resWrongPass.body.success === false,
            "POST /api/auth/login rejects incorrect password with 401 Unauthorized",
            JSON.stringify(resWrongPass.body)
        );

        // 11. Login failure: non-existent email
        console.log("\nStep 11: Login failure - non-existent email");
        const resNoUser = await apiRequest("POST", "/api/auth/login", {
            email: "nobody@stocksense.test",
            password: rawPassword
        });
        assert(
            resNoUser.status === 401 && resNoUser.body.success === false,
            "POST /api/auth/login rejects non-existent email with generic 401",
            JSON.stringify(resNoUser.body)
        );

        // 12. Successful Login & JWT issuance
        console.log("\nStep 12: Successful login and JWT issuance");
        const resLogin = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: rawPassword
        });
        assert(
            resLogin.status === 200 && resLogin.body.token && typeof resLogin.body.token === "string",
            "POST /api/auth/login succeeds with 200 and returns JWT token string",
            JSON.stringify(resLogin.body)
        );
        const authToken = resLogin.body.token;
        const loggedInUser = resLogin.body.user;
        assert(
            loggedInUser && loggedInUser.password === undefined && loggedInUser.email === userEmail,
            "Login response contains user object without password",
            JSON.stringify(loggedInUser)
        );

        // 13. Protected /api/auth/me without token -> 401
        console.log("\nStep 13: Protected /api/auth/me without token");
        const resMeNoToken = await apiRequest("GET", "/api/auth/me");
        assert(
            resMeNoToken.status === 401 && resMeNoToken.body.success === false,
            "GET /api/auth/me without Authorization header returns 401",
            JSON.stringify(resMeNoToken.body)
        );

        // 14. Protected /api/auth/me with invalid token -> 401
        console.log("\nStep 14: Protected /api/auth/me with invalid token");
        const resMeBadToken = await apiRequest("GET", "/api/auth/me", null, "invalid.bearer.token");
        assert(
            resMeBadToken.status === 401 && resMeBadToken.body.success === false,
            "GET /api/auth/me with malformed/invalid token returns 401",
            JSON.stringify(resMeBadToken.body)
        );

        // 15. Protected /api/auth/me with valid token -> 200
        console.log("\nStep 15: Protected /api/auth/me with valid JWT token");
        const resMeValid = await apiRequest("GET", "/api/auth/me", null, authToken);
        assert(
            resMeValid.status === 200 && resMeValid.body.data && resMeValid.body.data.email === userEmail,
            "GET /api/auth/me returns 200 with authenticated user profile",
            JSON.stringify(resMeValid.body)
        );
        assert(
            resMeValid.body.data.password === undefined,
            "GET /api/auth/me profile does NOT expose password",
            JSON.stringify(resMeValid.body.data)
        );

        // 16. Role-based authorization middleware
        console.log("\nStep 16: Role authorization middleware behavior");
        const roleApp = express();
        roleApp.use(express.json());
        roleApp.get("/staff-only", authenticate, requireRole("staff"), (req, res) => res.json({ success: true }));
        roleApp.get("/admin-only", authenticate, requireRole("admin"), (req, res) => res.json({ success: true }));
        const roleServer = await new Promise((resolve) => {
            const s = roleApp.listen(0, () => resolve(s));
        });
        const roleBaseUrl = `http://localhost:${roleServer.address().port}`;

        const resStaffResponse = await fetch(`${roleBaseUrl}/staff-only`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const resStaffAllowed = await resStaffResponse.json();
        assert(
            resStaffResponse.status === 200 && resStaffAllowed.success === true,
            "requireRole('staff') allows user with 'staff' role with 200 OK",
            JSON.stringify(resStaffAllowed)
        );

        const resAdminResponse = await fetch(`${roleBaseUrl}/admin-only`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const resAdminForbidden = await resAdminResponse.json();
        assert(
            resAdminResponse.status === 403 && resAdminForbidden.success === false,
            "requireRole('admin') forbids user with 'staff' role with 403 Forbidden",
            JSON.stringify(resAdminForbidden)
        );
        roleServer.close();

        // 17. Password Reset Foundation Flow
        console.log("\nStep 17: Password Reset Foundation flow");
        // Request reset for non-existent email (never reveal email existence)
        const resForgotNonExistent = await apiRequest("POST", "/api/auth/forgot-password", {
            email: "doesnotexist@stocksense.test"
        });
        assert(
            resForgotNonExistent.status === 200 && resForgotNonExistent.body.success === true,
            "POST /api/auth/forgot-password returns generic success for non-existent email",
            JSON.stringify(resForgotNonExistent.body)
        );

        // Request reset for existing email
        const resForgot = await apiRequest("POST", "/api/auth/forgot-password", {
            email: userEmail
        });
        assert(
            resForgot.status === 200 && resForgot.body.success === true && resForgot.body._testOtp,
            "POST /api/auth/forgot-password generates secure OTP session",
            JSON.stringify(resForgot.body)
        );
        const testOtp = resForgot.body._testOtp;

        // Verify with invalid OTP -> 400
        const resVerifyBad = await apiRequest("POST", "/api/auth/verify-otp", {
            email: userEmail,
            otp: "000000"
        });
        assert(
            resVerifyBad.status === 400 && resVerifyBad.body.success === false,
            "POST /api/auth/verify-otp rejects invalid OTP with 400",
            JSON.stringify(resVerifyBad.body)
        );

        // Verify with correct OTP -> 200 + resetToken
        const resVerifyOk = await apiRequest("POST", "/api/auth/verify-otp", {
            email: userEmail,
            otp: testOtp
        });
        assert(
            resVerifyOk.status === 200 && resVerifyOk.body.resetToken && typeof resVerifyOk.body.resetToken === "string",
            "POST /api/auth/verify-otp returns single-use resetToken with 200",
            JSON.stringify(resVerifyOk.body)
        );
        const resetToken = resVerifyOk.body.resetToken;

        // Reset password with new password
        const newPassword = "BrandNewPassword2026!";
        const resReset = await apiRequest("POST", "/api/auth/reset-password", {
            email: userEmail,
            resetToken,
            newPassword
        });
        assert(
            resReset.status === 200 && resReset.body.success === true,
            "POST /api/auth/reset-password sets new password with 200",
            JSON.stringify(resReset.body)
        );

        // Verify login with old password fails
        const resLoginOld = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: rawPassword
        });
        assert(
            resLoginOld.status === 401,
            "Login with old password fails after password reset",
            JSON.stringify(resLoginOld.body)
        );

        // Verify login with new password succeeds
        const resLoginNew = await apiRequest("POST", "/api/auth/login", {
            email: userEmail,
            password: newPassword
        });
        assert(
            resLoginNew.status === 200 && resLoginNew.body.token,
            "Login with new password succeeds after password reset",
            JSON.stringify(resLoginNew.body)
        );

        // 18. Cleanup of test user
        console.log("\nStep 18: Cleanup test user from database");
        await pool.query("DELETE FROM users WHERE id = ?", [userId]);
        const [remainingUsers] = await pool.query("SELECT id FROM users WHERE id = ?", [userId]);
        assert(
            remainingUsers.length === 0,
            "Test user cleanly purged from database",
            `Remaining: ${remainingUsers.length}`
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
