-- AlterTable: Añadir de manera segura, no destructiva y retroactiva las 7 columnas del módulo y reporte Excel de facturas.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "itemNumber" SERIAL NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "passToArea" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "costCenterOrProject" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "purchaseObservations" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "commercialValidation" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "legalValidation" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "legalObservations" TEXT;
