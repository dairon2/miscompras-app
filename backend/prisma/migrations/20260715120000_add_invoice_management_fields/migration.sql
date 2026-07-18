-- Additive invoice management fields.
-- Existing invoices remain valid because every new column is nullable.

ALTER TABLE "Invoice"
ADD COLUMN "purchaseOrderNumber" TEXT,
ADD COLUMN "budgetId" TEXT,
ADD COLUMN "observations" TEXT,
ADD COLUMN "causationNumber" TEXT,
ADD COLUMN "causationDate" TIMESTAMP(3),
ADD COLUMN "leaderApproval" BOOLEAN,
ADD COLUMN "subtotal" DECIMAL(15, 2),
ADD COLUMN "taxAmount" DECIMAL(15, 2),
ADD COLUMN "commercialAreaId" TEXT,
ADD COLUMN "policyApproverName" TEXT,
ADD COLUMN "policyReviewObservations" TEXT,
ADD COLUMN "causationObservations" TEXT,
ADD COLUMN "requirementNumber" TEXT;

CREATE TABLE "InvoiceAttachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_budgetId_idx" ON "Invoice"("budgetId");
CREATE INDEX "Invoice_commercialAreaId_idx" ON "Invoice"("commercialAreaId");
CREATE INDEX "Invoice_causationNumber_idx" ON "Invoice"("causationNumber");
CREATE INDEX "Invoice_purchaseOrderNumber_idx" ON "Invoice"("purchaseOrderNumber");
CREATE INDEX "InvoiceAttachment_invoiceId_idx" ON "InvoiceAttachment"("invoiceId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_budgetId_fkey"
FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_commercialAreaId_fkey"
FOREIGN KEY ("commercialAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceAttachment"
ADD CONSTRAINT "InvoiceAttachment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
