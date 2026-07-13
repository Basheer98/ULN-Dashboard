-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dispatcher', 'accountant', 'fielder');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('contractor_1099', 'w2');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'assigned', 'in_progress', 'complete', 'invoiced', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'accepted', 'in_progress', 'complete', 'cancelled');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('client_billing', 'fielder_payout');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'paid');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('photo', 'document', 'as_built', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'admin',
    "fielder_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "default_sqft_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "billing_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fielders" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'contractor_1099',
    "default_sqft_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "region" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fielders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "project_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "site_address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "job_type" TEXT,
    "description" TEXT,
    "sqft" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "client_sqft_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_line_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "fielder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "fielder_id" TEXT NOT NULL,
    "fielder_sqft_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "sqft_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_items_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fielder_payments" (
    "id" TEXT NOT NULL,
    "fielder_id" TEXT NOT NULL,
    "project_id" TEXT,
    "sqft_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_items_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employment_type" "EmploymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "reference_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fielder_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'photo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_fielder_id_key" ON "users"("fielder_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_number_key" ON "projects"("project_number");

-- CreateIndex
CREATE INDEX "projects_client_id_status_idx" ON "projects"("client_id", "status");

-- CreateIndex
CREATE INDEX "projects_status_due_date_idx" ON "projects"("status", "due_date");

-- CreateIndex
CREATE INDEX "assignments_fielder_id_status_idx" ON "assignments"("fielder_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_project_id_fielder_id_key" ON "assignments"("project_id", "fielder_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_due_at_idx" ON "invoices"("status", "due_at");

-- CreateIndex
CREATE INDEX "fielder_payments_fielder_id_status_idx" ON "fielder_payments"("fielder_id", "status");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_fielder_id_fkey" FOREIGN KEY ("fielder_id") REFERENCES "fielders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_items" ADD CONSTRAINT "project_line_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_items" ADD CONSTRAINT "project_line_items_fielder_id_fkey" FOREIGN KEY ("fielder_id") REFERENCES "fielders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_fielder_id_fkey" FOREIGN KEY ("fielder_id") REFERENCES "fielders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fielder_payments" ADD CONSTRAINT "fielder_payments_fielder_id_fkey" FOREIGN KEY ("fielder_id") REFERENCES "fielders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fielder_payments" ADD CONSTRAINT "fielder_payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

