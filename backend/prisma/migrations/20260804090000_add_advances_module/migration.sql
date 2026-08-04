-- Dedicated advances module. All additions are new tables and nullable relations.
CREATE TYPE "AdvanceBeneficiaryType" AS ENUM ('SUPPLIER', 'EMPLOYEE');
CREATE TYPE "AdvanceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'LEGALIZED', 'REJECTED', 'CANCELLED');

CREATE TABLE "AdvanceSequence" (
    "year" INTEGER NOT NULL,
    "nextConsecutive" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvanceSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "consecutive" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beneficiaryType" "AdvanceBeneficiaryType" NOT NULL DEFAULT 'SUPPLIER',
    "beneficiaryDocument" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "supplierId" TEXT,
    "costCenter" TEXT,
    "costCenterCode" TEXT,
    "purpose" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "legalizationDueDate" TIMESTAMP(3),
    "legalizationNotes" TEXT,
    "requirementId" TEXT,
    "budgetId" TEXT,
    "projectId" TEXT,
    "areaId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "disbursedById" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "legalizedById" TEXT,
    "legalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvanceAttachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvanceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvanceAuditLog" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "AdvanceStatus",
    "toStatus" "AdvanceStatus",
    "details" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvanceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Advance_year_consecutive_key" ON "Advance"("year", "consecutive");
CREATE INDEX "Advance_status_idx" ON "Advance"("status");
CREATE INDEX "Advance_beneficiaryDocument_idx" ON "Advance"("beneficiaryDocument");
CREATE INDEX "Advance_supplierId_idx" ON "Advance"("supplierId");
CREATE INDEX "Advance_requirementId_idx" ON "Advance"("requirementId");
CREATE INDEX "Advance_requestDate_idx" ON "Advance"("requestDate");
CREATE INDEX "AdvanceAttachment_advanceId_idx" ON "AdvanceAttachment"("advanceId");
CREATE INDEX "AdvanceAuditLog_advanceId_idx" ON "AdvanceAuditLog"("advanceId");
CREATE INDEX "AdvanceAuditLog_createdAt_idx" ON "AdvanceAuditLog"("createdAt");

ALTER TABLE "Advance" ADD CONSTRAINT "Advance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_disbursedById_fkey" FOREIGN KEY ("disbursedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_legalizedById_fkey" FOREIGN KEY ("legalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceAttachment" ADD CONSTRAINT "AdvanceAttachment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvanceAuditLog" ADD CONSTRAINT "AdvanceAuditLog_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
