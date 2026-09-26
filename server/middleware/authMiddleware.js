const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Authentication middleware that verifies Bearer JWT tokens.
 * Extracts claims and attaches user info to req.user without unnecessary DB queries.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authorization token is required (format: Bearer <token>)"
        });
    }

    const token = authHeader.split(" ")[1]?.trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authorization token is missing"
        });
    }

    try {
        const secret = env.jwt.secret || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        // Attach authenticated user claims to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Authorization token has expired"
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid authorization token"
        });
    }
}

/**
 * Role-based authorization middleware.
 * Supports usage such as: requireRole("admin"), requireRole("admin", "manager")
 */
function requireRole(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: requires one of the following roles: ${allowedRoles.join(", ")}`
            });
        }

        next();
    };
}

module.exports = {
    authenticate,
    requireRole
};
