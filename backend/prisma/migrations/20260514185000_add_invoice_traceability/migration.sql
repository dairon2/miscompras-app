-- Additive invoice traceability changes.
-- This migration only adds nullable columns, a new audit table, optional relationships, and indexes.

ALTER TABLE "Invoice"
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paidById" TEXT,
ADD COLUMN "transactionNumber" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "invoiceId" TEXT;

CREATE TABLE "InvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "InvoiceStatus",
    "toStatus" "InvoiceStatus",
    "details" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_supplierId_invoiceNumber_idx" ON "Invoice"("supplierId", "invoiceNumber");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_paidAt_idx" ON "Invoice"("paidAt");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "InvoiceAuditLog_invoiceId_idx" ON "InvoiceAuditLog"("invoiceId");
CREATE INDEX "InvoiceAuditLog_action_idx" ON "InvoiceAuditLog"("action");
CREATE INDEX "InvoiceAuditLog_createdAt_idx" ON "InvoiceAuditLog"("createdAt");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceAuditLog"
ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
