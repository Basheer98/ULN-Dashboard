-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('expense', 'income', 'owner_draw', 'owner_contribution', 'loan_payment', 'loan_proceeds', 'transfer', 'reimbursement_payout');
CREATE TYPE "ExpenseStatus" AS ENUM ('draft', 'submitted', 'pending_review', 'approved', 'rejected', 'paid', 'reimbursed', 'voided');
CREATE TYPE "IncomeCategory" AS ENUM ('client_payment', 'advance_payment', 'partial_invoice_payment', 'travel_reimbursement', 'expense_reimbursement', 'loan_proceeds', 'owner_contribution', 'refund_received', 'other_income');
CREATE TYPE "ReceiptVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE "TripStatus" AS ENUM ('planned', 'active', 'completed', 'cancelled');
CREATE TYPE "ReconciliationStatus" AS ENUM ('in_progress', 'balanced', 'completed', 'reopened');
CREATE TYPE "LoanStatus" AS ENUM ('active', 'paid_off', 'defaulted', 'cancelled');
CREATE TYPE "PaidByType" AS ENUM ('company', 'employee');

-- CreateTable financial_settings
CREATE TABLE "financial_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_settings_key_key" ON "financial_settings"("key");

-- CreateTable expense_categories
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateTable expense_subcategories
CREATE TABLE "expense_subcategories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "expense_subcategories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_subcategories_category_id_name_key" ON "expense_subcategories"("category_id", "name");
ALTER TABLE "expense_subcategories" ADD CONSTRAINT "expense_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable payment_methods
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "account_nickname" TEXT,
    "last_four" TEXT,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "include_in_dashboard" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable vendors
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_type" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "default_category_id" TEXT,
    "default_payment_method_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_payment_method_id_fkey" FOREIGN KEY ("default_payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable vehicles
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable trips
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "state" TEXT,
    "city" TEXT,
    "purpose" TEXT,
    "budget" DECIMAL(14,2),
    "status" "TripStatus" NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_projects
CREATE TABLE "trip_projects" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "trip_projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trip_projects_trip_id_project_id_key" ON "trip_projects"("trip_id", "project_id");
ALTER TABLE "trip_projects" ADD CONSTRAINT "trip_projects_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_projects" ADD CONSTRAINT "trip_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable financial_transactions
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "transaction_type" "FinanceTransactionType" NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "business_purpose" TEXT,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "payment_method_id" TEXT,
    "project_id" TEXT,
    "fielder_id" TEXT,
    "client_id" TEXT,
    "invoice_id" TEXT,
    "vendor_id" TEXT,
    "trip_id" TEXT,
    "status" TEXT,
    "expense_status" "ExpenseStatus",
    "income_category" "IncomeCategory",
    "paid_by" "PaidByType",
    "card_last_four" TEXT,
    "is_reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "is_billable" BOOLEAN NOT NULL DEFAULT false,
    "is_tax_deductible" BOOLEAN NOT NULL DEFAULT true,
    "payment_reference" TEXT,
    "notes" TEXT,
    "submitted_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_transactions_transaction_number_key" ON "financial_transactions"("transaction_number");
CREATE INDEX "financial_transactions_transaction_type_transaction_date_idx" ON "financial_transactions"("transaction_type", "transaction_date");
CREATE INDEX "financial_transactions_expense_status_idx" ON "financial_transactions"("expense_status");
CREATE INDEX "financial_transactions_project_id_idx" ON "financial_transactions"("project_id");
CREATE INDEX "financial_transactions_fielder_id_idx" ON "financial_transactions"("fielder_id");
CREATE INDEX "financial_transactions_deleted_at_idx" ON "financial_transactions"("deleted_at");

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "expense_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_fielder_id_fkey" FOREIGN KEY ("fielder_id") REFERENCES "fielders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- expense_allocations, receipts, invoice_payments, mileage_entries, bank_reconciliations, reconciliation_items, loans, loan_payments, financial_audit_logs
CREATE TABLE "expense_allocations" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "percent" DECIMAL(5,2),
    CONSTRAINT "expense_allocations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "original_file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "storage_file_id" TEXT,
    "storage_url" TEXT,
    "file_hash" TEXT,
    "verification_status" "ReceiptVerificationStatus" NOT NULL DEFAULT 'pending',
    "project_id" TEXT,
    "vendor_id" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "receipts_file_hash_idx" ON "receipts"("file_hash");
CREATE INDEX "receipts_transaction_id_idx" ON "receipts"("transaction_id");
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "mileage_entries" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "start_location" TEXT,
    "destination" TEXT,
    "start_odometer" DECIMAL(10,1),
    "end_odometer" DECIMAL(10,1),
    "total_miles" DECIMAL(10,1) NOT NULL,
    "business_purpose" TEXT,
    "project_id" TEXT,
    "trip_id" TEXT,
    "is_reimbursable" BOOLEAN NOT NULL DEFAULT true,
    "mileage_rate" DECIMAL(10,4) NOT NULL,
    "reimbursement" DECIMAL(14,2) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'submitted',
    "notes" TEXT,
    "submitted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mileage_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mileage_entries_driver_id_date_idx" ON "mileage_entries"("driver_id", "date");
ALTER TABLE "mileage_entries" ADD CONSTRAINT "mileage_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "fielders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mileage_entries" ADD CONSTRAINT "mileage_entries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mileage_entries" ADD CONSTRAINT "mileage_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mileage_entries" ADD CONSTRAINT "mileage_entries_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "statement_date" TIMESTAMP(3) NOT NULL,
    "starting_balance" DECIMAL(14,2) NOT NULL,
    "ending_balance" DECIMAL(14,2) NOT NULL,
    "cleared_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'in_progress',
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "reconciliation_items" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "transaction_date" TIMESTAMP(3),
    "is_cleared" BOOLEAN NOT NULL DEFAULT false,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "original_amount" DECIMAL(14,2) NOT NULL,
    "remaining_balance" DECIMAL(14,2) NOT NULL,
    "interest_rate" DECIMAL(6,4),
    "start_date" TIMESTAMP(3),
    "payment_frequency" TEXT,
    "payment_amount" DECIMAL(14,2),
    "next_payment_date" TIMESTAMP(3),
    "purpose" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "principal_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "financial_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "financial_audit_logs_entity_type_entity_id_idx" ON "financial_audit_logs"("entity_type", "entity_id");
CREATE INDEX "financial_audit_logs_created_at_idx" ON "financial_audit_logs"("created_at");
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
