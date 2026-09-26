const authService = require("../services/authService");

/**
 * Helper to handle auth controller errors cleanly
 */
function handleAuthError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "An account with this email already exists"
        });
    }

    if (next) {
        return next(error);
    }

    console.error("Unhandled auth error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res, next) => {
    try {
        const user = await authService.registerUser(req.body || {});

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: user
        });
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT
 */
const login = async (req, res, next) => {
    try {
        const result = await authService.loginUser(req.body || {});

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: result.token,
            user: result.user
        });
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

/**
 * GET /api/auth/me
 * Fetch authenticated user profile
 */
const getMe = async (req, res, next) => {
    try {
        const user = await authService.getCurrentUser(req.user.id);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

/**
 * POST /api/auth/forgot-password
 * Request a password reset OTP
 */
const forgotPassword = async (req, res, next) => {
    try {
        const result = await authService.requestPasswordReset(req.body?.email);

        res.status(200).json(result);
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

/**
 * POST /api/auth/verify-otp
 * Verify password reset OTP
 */
const verifyOtp = async (req, res, next) => {
    try {
        const result = await authService.verifyResetOtp(req.body?.email, req.body?.otp);

        res.status(200).json(result);
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

/**
 * POST /api/auth/reset-password
 * Reset password using verified token
 */
const resetPassword = async (req, res, next) => {
    try {
        const result = await authService.resetPassword({
            email: req.body?.email,
            resetToken: req.body?.resetToken,
            newPassword: req.body?.newPassword
        });

        res.status(200).json(result);
    } catch (error) {
        handleAuthError(error, res, next);
    }
};

module.exports = {
    register,
    login,
    getMe,
    forgotPassword,
    verifyOtp,
    resetPassword
};
