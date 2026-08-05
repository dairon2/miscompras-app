-- Link invoices to advances and the user responsible for leader approval.
ALTER TABLE "Invoice" ADD COLUMN "advanceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "advanceAmount" DECIMAL(15,2);
ALTER TABLE "Invoice" ADD COLUMN "leaderResponsibleId" TEXT;

CREATE INDEX "Invoice_advanceId_idx" ON "Invoice"("advanceId");
CREATE INDEX "Invoice_leaderResponsibleId_idx" ON "Invoice"("leaderResponsibleId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaderResponsibleId_fkey" FOREIGN KEY ("leaderResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
