const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const env = require("../config/env");

// In-memory store for reset OTPs with expiration and attempt limiting.
// (Prevents schema alteration; in production cluster, recommend a password_resets table or Redis)
const resetStore = new Map();

/**
 * Validate email format using standard regex
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === "string" && emailRegex.test(email.trim());
}

/**
 * Register a new user
 */
const registerUser = async ({ name, email, password }) => {
    // 1. Validate name
    if (!name || typeof name !== "string" || name.trim().length < 2) {
        const error = new Error("Full name is required (minimum 2 characters)");
        error.status = 400;
        throw error;
    }

    // 2. Validate email
    if (!isValidEmail(email)) {
        const error = new Error("A valid email address is required");
        error.status = 400;
        throw error;
    }

    // 3. Validate password
    if (!password || typeof password !== "string" || password.length < 6) {
        const error = new Error("Password is required (minimum 6 characters)");
        error.status = 400;
        throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 4. Check for duplicate email
    const existingUser = await userModel.findUserByEmail(normalizedEmail);
    if (existingUser) {
        const error = new Error("An account with this email already exists");
        error.status = 409;
        throw error;
    }

    // 5. Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Persist user with default role 'staff'
    const userId = await userModel.createUser({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "staff"
    });

    // 7. Return user record without password
    const user = await userModel.findUserById(userId);
    return user;
};

/**
 * Login user and generate JWT
 */
const loginUser = async ({ email, password }) => {
    if (!email || !password) {
        const error = new Error("Email and password are required");
        error.status = 400;
        throw error;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userModel.findUserByEmail(normalizedEmail);

    if (!user) {
        const error = new Error("Invalid email or password");
        error.status = 401;
        throw error;
    }

    // Compare password using bcryptjs
    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
        const error = new Error("Invalid email or password");
        error.status = 401;
        throw error;
    }

    // Generate JWT token with user claims (excluding password)
    const secret = env.jwt.secret || process.env.JWT_SECRET;
    const expiresIn = env.jwt.expiresIn || process.env.JWT_EXPIRES_IN || "24h";

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        secret,
        { expiresIn }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            created_at: user.created_at
        }
    };
};

/**
 * Fetch authenticated user profile
 */
const getCurrentUser = async (userId) => {
    const user = await userModel.findUserById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
    }
    return user;
};

/**
 * Request password reset OTP
 * Never reveals whether an email exists.
 */
const requestPasswordReset = async (email) => {
    if (!email || !isValidEmail(email)) {
        const error = new Error("A valid email address is required");
        error.status = 400;
        throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userModel.findUserByEmail(normalizedEmail);

    let testOtp = null;

    if (user) {
        // Generate secure 6-digit numeric OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Hash OTP with SHA-256 so it is never stored in plaintext
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

        resetStore.set(normalizedEmail, {
            hashedOtp,
            expiresAt: Date.now() + 15 * 60 * 1000, // 15-minute expiration
            attempts: 0,
            verified: false
        });

        // In test environment, expose testOtp for automated verification without logging
        if (process.env.NODE_ENV === "test") {
            testOtp = otp;
        }
    }

    const response = {
        success: true,
        message: "If an account with that email exists, password reset instructions have been generated."
    };

    if (testOtp) {
        response._testOtp = testOtp;
    }

    return response;
};

/**
 * Verify reset OTP and generate single-use reset token
 */
const verifyResetOtp = async (email, otp) => {
    if (!email || !otp) {
        const error = new Error("Email and OTP are required");
        error.status = 400;
        throw error;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const record = resetStore.get(normalizedEmail);

    if (!record || record.expiresAt < Date.now()) {
        resetStore.delete(normalizedEmail);
        const error = new Error("Invalid or expired OTP");
        error.status = 400;
        throw error;
    }

    // Limit attempts to 5
    if (record.attempts >= 5) {
        resetStore.delete(normalizedEmail);
        const error = new Error("Too many failed attempts. Please request a new OTP.");
        error.status = 429;
        throw error;
    }

    record.attempts += 1;

    // Compare hashed OTP
    const incomingHashedOtp = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
    if (incomingHashedOtp !== record.hashedOtp) {
        const error = new Error("Invalid or expired OTP");
        error.status = 400;
        throw error;
    }

    // OTP verified: generate a single-use cryptographically random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    record.verified = true;
    record.resetTokenHash = resetTokenHash;
    record.expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes to reset password

    return {
        success: true,
        message: "OTP verified successfully",
        resetToken
    };
};

/**
 * Set a new password using verified reset token
 */
const resetPassword = async ({ email, resetToken, newPassword }) => {
    if (!email || !resetToken || !newPassword) {
        const error = new Error("Email, resetToken, and newPassword are required");
        error.status = 400;
        throw error;
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
        const error = new Error("New password must be at least 6 characters");
        error.status = 400;
        throw error;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const record = resetStore.get(normalizedEmail);

    if (!record || !record.verified || record.expiresAt < Date.now()) {
        resetStore.delete(normalizedEmail);
        const error = new Error("Invalid or expired password reset session");
        error.status = 400;
        throw error;
    }

    const incomingTokenHash = crypto.createHash("sha256").update(String(resetToken).trim()).digest("hex");
    if (incomingTokenHash !== record.resetTokenHash) {
        const error = new Error("Invalid or expired reset token");
        error.status = 400;
        throw error;
    }

    const user = await userModel.findUserByEmail(normalizedEmail);
    if (!user) {
        resetStore.delete(normalizedEmail);
        const error = new Error("User not found");
        error.status = 404;
        throw error;
    }

    // Hash new password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update in database
    await userModel.updateUserPassword(user.id, hashedPassword);

    // Clear reset session
    resetStore.delete(normalizedEmail);

    return {
        success: true,
        message: "Password has been reset successfully"
    };
};

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    requestPasswordReset,
    verifyResetOtp,
    resetPassword
};
