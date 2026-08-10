ALTER TYPE "Role" ADD VALUE 'INVOICE_VALIDATOR';

CREATE TYPE "InvoiceValidationScope" AS ENUM ('COMMERCIAL', 'LEGAL', 'ACCOUNTING');

ALTER TABLE "User" ADD COLUMN "invoiceValidationScope" "InvoiceValidationScope";
