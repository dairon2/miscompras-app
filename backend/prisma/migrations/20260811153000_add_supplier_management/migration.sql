CREATE TYPE "SupplierManagement" AS ENUM (
  'UNCLASSIFIED',
  'COMMERCIAL',
  'ADMINISTRATIVE_PURCHASING',
  'PAYROLL',
  'SHARED'
);

ALTER TABLE "Supplier"
  ADD COLUMN "management" "SupplierManagement" NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "managementSource" TEXT,
  ADD COLUMN "managementClassifiedAt" TIMESTAMP(3),
  ADD COLUMN "managementClassifiedById" TEXT;

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_managementClassifiedById_fkey"
  FOREIGN KEY ("managementClassifiedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Supplier_management_idx" ON "Supplier"("management");
CREATE INDEX "Supplier_managementClassifiedById_idx" ON "Supplier"("managementClassifiedById");

-- Classify only suppliers whose complete invoice history has one recognized route.
WITH invoice_routes AS (
  SELECT
    "supplierId",
    CASE
      WHEN UPPER(TRIM("passToArea")) LIKE '%COMERCIAL%' THEN 'COMMERCIAL'
      WHEN UPPER(TRIM("passToArea")) LIKE '%COMPRA%' THEN 'ADMINISTRATIVE_PURCHASING'
      WHEN TRANSLATE(UPPER(TRIM("passToArea")), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%NOMINA%' THEN 'PAYROLL'
      ELSE NULL
    END AS route
  FROM "Invoice"
), certain_management AS (
  SELECT "supplierId", MIN(route) AS route
  FROM invoice_routes
  GROUP BY "supplierId"
  HAVING COUNT(*) = COUNT(route) AND COUNT(DISTINCT route) = 1
)
UPDATE "Supplier" AS supplier
SET
  "management" = certain.route::"SupplierManagement",
  "managementSource" = 'INVOICE_WORKFLOW_CONSISTENT',
  "managementClassifiedAt" = CURRENT_TIMESTAMP
FROM certain_management AS certain
WHERE supplier.id = certain."supplierId"
  AND supplier."management" = 'UNCLASSIFIED';
