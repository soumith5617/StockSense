const stockLedgerModel = require("../models/stockLedgerModel");

const ALLOWED_MOVEMENT_TYPES = [
    "receipt",
    "delivery",
    "transfer_in",
    "transfer_out",
    "adjustment"
];

/**
 * Validate ISO/YYYY-MM-DD date string
 */
function isValidDateString(str) {
    if (!str || typeof str !== "string") return false;
    const trimmed = str.trim();
    // Support YYYY-MM-DD or full ISO 8601 strings
    const dateRegex = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z?)?$/;
    if (!dateRegex.test(trimmed)) return false;

    const parsed = new Date(trimmed);
    return !isNaN(parsed.getTime());
}

/**
 * Map raw database row to clean, enriched client-facing ledger record
 */
function formatLedgerRow(row) {
    return {
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name || null,
        sku: row.sku || null,
        location_id: row.location_id,
        location_name: row.location_name || null,
        warehouse_name: row.warehouse_name || null,
        movement_type: row.movement_type,
        reference_id: row.reference_id !== null ? Number(row.reference_id) : null,
        reference_number: row.reference_number || null,
        quantity_change: row.quantity_change !== null ? Number(row.quantity_change) : null,
        balance_after: row.balance_after !== null ? Number(row.balance_after) : null,
        created_by: row.created_by !== null ? Number(row.created_by) : null,
        created_by_name: row.created_by_name || null,
        created_at: row.created_at
    };
}

/**
 * Fetch and validate stock ledger movements with filters and pagination
 */
const getLedger = async (query = {}) => {
    const filters = {};

    // 1. Validate movement_type
    if (query.movement_type !== undefined && query.movement_type !== null && String(query.movement_type).trim() !== "") {
        const movementType = String(query.movement_type).trim().toLowerCase();
        if (!ALLOWED_MOVEMENT_TYPES.includes(movementType)) {
            const error = new Error(
                `Invalid movement_type '${movementType}'. Allowed values: ${ALLOWED_MOVEMENT_TYPES.join(", ")}`
            );
            error.status = 400;
            throw error;
        }
        filters.movement_type = movementType;
    }

    // 2. Validate location_id
    if (query.location_id !== undefined && query.location_id !== null && String(query.location_id).trim() !== "") {
        const rawLocId = String(query.location_id).trim();
        const locId = Number(rawLocId);
        if (!Number.isInteger(locId) || locId <= 0) {
            const error = new Error("Invalid location_id. Must be a positive integer");
            error.status = 400;
            throw error;
        }
        filters.location_id = locId;
    }

    // 3. Validate product_id
    if (query.product_id !== undefined && query.product_id !== null && String(query.product_id).trim() !== "") {
        const rawProdId = String(query.product_id).trim();
        const prodId = Number(rawProdId);
        if (!Number.isInteger(prodId) || prodId <= 0) {
            const error = new Error("Invalid product_id. Must be a positive integer");
            error.status = 400;
            throw error;
        }
        filters.product_id = prodId;
    }

    // 4. Validate start_date and end_date
    let startDateObj = null;
    let endDateObj = null;

    if (query.start_date !== undefined && query.start_date !== null && String(query.start_date).trim() !== "") {
        const rawStart = String(query.start_date).trim();
        if (!isValidDateString(rawStart)) {
            const error = new Error("Invalid start_date format. Expected YYYY-MM-DD or ISO timestamp");
            error.status = 400;
            throw error;
        }
        startDateObj = new Date(rawStart);
        // If YYYY-MM-DD, set to start of day
        filters.start_date = rawStart.length === 10 ? `${rawStart} 00:00:00` : rawStart;
    }

    if (query.end_date !== undefined && query.end_date !== null && String(query.end_date).trim() !== "") {
        const rawEnd = String(query.end_date).trim();
        if (!isValidDateString(rawEnd)) {
            const error = new Error("Invalid end_date format. Expected YYYY-MM-DD or ISO timestamp");
            error.status = 400;
            throw error;
        }
        endDateObj = new Date(rawEnd);
        // If YYYY-MM-DD, set to end of day
        filters.end_date = rawEnd.length === 10 ? `${rawEnd} 23:59:59` : rawEnd;
    }

    if (startDateObj && endDateObj && startDateObj > endDateObj) {
        const error = new Error("start_date cannot be later than end_date");
        error.status = 400;
        throw error;
    }

    // 5. Search filter
    if (query.search !== undefined && query.search !== null && String(query.search).trim() !== "") {
        filters.search = String(query.search).trim();
    }

    // 6. Pagination parameters
    let page = 1;
    let pageSize = 25;

    if (query.page !== undefined && query.page !== null && String(query.page).trim() !== "") {
        const parsedPage = Number(String(query.page).trim());
        if (!Number.isInteger(parsedPage) || parsedPage < 1) {
            const error = new Error("Invalid page parameter. Must be a positive integer greater than or equal to 1");
            error.status = 400;
            throw error;
        }
        page = parsedPage;
    }

    if (query.pageSize !== undefined && query.pageSize !== null && String(query.pageSize).trim() !== "") {
        const parsedPageSize = Number(String(query.pageSize).trim());
        if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 1000) {
            const error = new Error("Invalid pageSize parameter. Must be an integer between 1 and 1000");
            error.status = 400;
            throw error;
        }
        pageSize = parsedPageSize;
    }

    const offset = (page - 1) * pageSize;

    // Coordinate model calls
    const [total, rows] = await Promise.all([
        stockLedgerModel.countLedgerEntries(filters),
        stockLedgerModel.getLedgerEntries(filters, { limit: pageSize, offset })
    ]);

    const formattedData = rows.map(formatLedgerRow);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
        data: formattedData,
        total,
        page,
        pageSize,
        totalPages
    };
};

/**
 * Fetch a single stock ledger movement by ID
 */
const getLedgerById = async (id) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
        const error = new Error("Invalid ledger ID. Must be a positive integer");
        error.status = 400;
        throw error;
    }

    const row = await stockLedgerModel.getLedgerEntryById(numericId);
    if (!row) {
        const error = new Error(`Stock ledger entry with ID ${numericId} not found`);
        error.status = 404;
        throw error;
    }

    return formatLedgerRow(row);
};

module.exports = {
    getLedger,
    getLedgerById
};
