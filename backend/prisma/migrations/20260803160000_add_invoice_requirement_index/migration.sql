-- Speeds up the reconciliation dashboard and requirement-to-invoice lookups.
CREATE INDEX IF NOT EXISTS "Invoice_requirementId_idx" ON "Invoice"("requirementId");
