# StockSense — Modern Inventory & Warehouse Management System

StockSense is an enterprise-grade inventory, warehouse, and supply chain management system built with **React (Vite)** on the frontend and **Node.js, Express, and MySQL** on the backend.

---

## Key Modules & Features

- **Authentication & RBAC**: JWT-based authentication, role-based authorization (`admin`, `manager`, `staff`), and secure password reset foundation.
- **Product Master Catalog**: SKU tracking, category mapping, barcode standards, and reorder safety thresholds.
- **Warehouse Facilities**: Multi-facility management, physical distribution hubs, and location aggregations.
- **Internal Locations**: Storage zone hierarchy, racks, shelves, and bin-level location tracking.
- **Supplier Directory**: Vendor management with email, phone, and dispatch address records.
- **Incoming Stock Receipts**: Lifecycle management (`draft` → `waiting` → `ready` → `done`), multi-item purchase receiving, and atomic stock increment with transaction rollback protection.
- **Outgoing Stock Deliveries**: Inventory allocation, insufficient-stock checks, atomic decrement, and dispatch validation.
- **Internal Transfers**: Safe, atomic relocation of inventory between internal warehouse locations and bins.
- **Physical Adjustments**: Cycle counting, reconciliation between system quantities and counted physical stock, and discrepancy tracking.
- **Stock Ledger Audit Trail**: Immutable transaction movement history tracking every unit adjustment with snapshot balance-after values.

---

## Technology Stack

- **Frontend**:
  - React 19 + Vite
  - React Router DOM v7
  - Axios centralized API client with automatic JWT token attachment
  - Custom responsive enterprise SaaS design system (pure CSS tokens)
- **Backend**:
  - Node.js & Express
  - MySQL with connection pool & ACID transactions
  - `bcryptjs` for secure password hashing
  - `jsonwebtoken` (JWT) for authentication
- **Testing & Verification**:
  - 7 comprehensive regression test suites (227 verified automated tests)

---

## Project Structure

```text
StockSense/
├── client/                     # React + Vite frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI, layout, and modal components
│   │   ├── context/            # AuthContext and state providers
│   │   ├── pages/              # Product, Warehouse, Location, Receipt, Dashboard views
│   │   ├── routes/             # AppRoutes and protected route guards
│   │   └── services/           # Centralized Axios services (product, warehouse, etc.)
│   └── package.json
└── server/                     # Express + MySQL backend REST API
    ├── config/                 # MySQL database pool configuration
    ├── controllers/            # Route controllers
    ├── middleware/             # Auth, role check, and error handlers
    ├── models/                 # Parameterized MySQL database queries
    ├── routes/                 # Express API route declarations
    ├── services/               # Business logic, validations, and transactions
    └── test_*.js               # Comprehensive automated test suites
```

---

## Getting Started

### 1. Backend Setup

```bash
cd server
npm install
# Configure MySQL credentials in .env
npm run dev # or node server.js
```

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running Verification Tests

```bash
cd server
node test_product_module.js
node test_auth_module.js
node test_warehouse_location_module.js
node test_receipt_module.js
node test_delivery_module.js
node test_transfer_module.js
node test_adjustment_module.js
```
