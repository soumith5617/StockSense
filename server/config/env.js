const dotenv = require("dotenv");

dotenv.config();

module.exports = {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    database: {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 3306,
        name: process.env.DB_NAME || "stocksense",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || ""
    },
    jwt: {
        secret: process.env.JWT_SECRET || "stocksense_default_jwt_secret_key",
        expiresIn: process.env.JWT_EXPIRES_IN || "24h"
    }
};
